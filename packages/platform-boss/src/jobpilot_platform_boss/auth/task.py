"""BOSS 登录任务状态机：短信 / APP 扫码的人机协作流程。

「发码 → 输码 →（滑块）→ 登录成功」与 APP 扫码流的细节见
`notes/jobpilot_server/services/login_task.md`。滑块只是人机协作管道，不认缺口、不伪造轨迹。

平台侧只认注入的 `LoginRuntime`（占用检查、进度登记、URL 拼装、等待超时），
不 import 任何 server 模块。

Attributes:
    ST_PENDING: 任务状态：待启动。
    ST_SENDING: 任务状态：发短信中。
    ST_NEED_CODE: 任务状态：等验证码。
    ST_NEED_SLIDER: 任务状态：等滑块票据。
    ST_LOGGING_IN: 任务状态：登录中。
    ST_NEED_SCAN: 任务状态：扫码登录，二维码已出好，等手机扫。
    ST_DONE: 任务状态：完成。
    ST_ERROR: 任务状态：失败。
    ST_CANCELLED: 任务状态：已取消。
    _TERMINAL: 终态集合。
    SITE: 本平台站点 id；默认 URL 拼装用。
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Protocol

from . import create_client, persist_login
from .config import QR_DEFAULT_PK
from .errors import (
    AccountBlocked,
    BossLoginError,
    CodeRejected,
    RateLimited,
    RiskControlRequired,
    ValidationError,
)
from .models import LoginResult
from .qrcode import AppScanLogin, render_qr_png
from .verify import (
    SliderChallenge,
    SliderSolution,
    SliderSolver,
    build_helper_html,
    parse_solution,
)

logger = logging.getLogger(__name__)

SITE = "boss"

ST_PENDING = "pending"
ST_SENDING = "sending_sms"
ST_NEED_CODE = "need_code"
ST_NEED_SLIDER = "need_slider"
ST_LOGGING_IN = "logging_in"
ST_NEED_SCAN = "need_scan"
ST_DONE = "done"
ST_ERROR = "error"
ST_CANCELLED = "cancelled"

_TERMINAL = {ST_DONE, ST_ERROR, ST_CANCELLED}


class AuthError(RuntimeError):
    """登录任务平台侧错误基类。"""


class AuthConflict(AuthError):
    """任务状态冲突（已在跑 / 已结束 / 没有待办）。"""


class AuthNotFound(AuthError):
    """任务或产物不存在。"""


class AuthValidation(AuthError):
    """入参不合法（手机号、验证码、滑块票据）。"""


class AuthUpstream(AuthError):
    """本地登录客户端 / 二维码渲染失败。"""


UrlBuilder = Callable[..., str]


class LoginRuntime(Protocol):
    """任务中心注入面。"""

    def occupy(self, kind: str) -> None:
        """提交前的占用检查；冲突抛 server 侧异常。"""
        ...

    def track(self, task: "LoginTask") -> None:
        """登记任务并接管进度广播。"""
        ...

    def build_url(self, action: str, task_id: str, *, suffix: str = "") -> str:
        """拼任务相关页面的对外 URL。"""
        ...

    def wait_timeout(self) -> float:
        """等验证码 / 滑块的超时秒数。"""
        ...


def _default_url(action: str, task_id: str, *, suffix: str = "") -> str:
    """默认 URL：站点作用域 `/api/sites/{site}/auth/...`。"""
    tail = f"{action}/{task_id}" + (f"/{suffix}" if suffix else "")
    return f"/api/sites/{SITE}/auth/{tail}"


@dataclass
class LoginTask:
    """一次网页登录的全部状态。

    Attributes:
        kind: 任务类型：`sms` 短信 / `qr` APP 扫码；前端必须按它分派界面。
        status: 任务状态。
        retry_after: 限频建议等待秒数。
        code_event: 验证码等待事件；`code_box` 是投递箱。
        slider_event: 滑块票据等待事件；`slider_box` 是投递箱。
        slider_refresher: 重新拉一张滑块挑战的回调。
        qr_revision: 二维码重画版本号。
        url_for: 任务页面 URL 拼装函数（server 可注入）。
    """

    task_id: str
    phone: str
    dial_code: str = "86"
    kind: str = "sms"
    status: str = ST_PENDING
    created_at: float = field(default_factory=time.time)
    events: deque[dict[str, Any]] = field(default_factory=lambda: deque(maxlen=50))
    error: str | None = None
    result: dict[str, Any] | None = None
    retry_after: float = 0.0
    attempts: int = 0

    code_event: threading.Event = field(default_factory=threading.Event)
    code_box: dict[str, Any] = field(default_factory=dict)

    slider_event: threading.Event = field(default_factory=threading.Event)
    slider_box: dict[str, Any] = field(default_factory=dict)
    slider_challenge: SliderChallenge | None = None
    slider_html: str | None = None
    slider_needed: bool = False
    slider_refresher: Callable[[], SliderChallenge] | None = None

    lock: threading.RLock = field(default_factory=threading.RLock)
    cancel_flag: bool = False

    qr_payload: str = ""
    qr_head_img: str = ""
    qr_scanned: bool = False
    qr_confirmed: bool = False
    qr_pk: str = ""
    qr_revision: int = 0

    url_for: UrlBuilder = _default_url

    def record(self, name: str, payload: Mapping[str, Any] | None = None) -> None:
        """记一条事件。

        Args:
            name: 事件名。
            payload: 事件载荷。
        """
        with self.lock:
            self.events.append(
                {"at": time.time(), "name": name, "payload": dict(payload or {})}
            )

    def set_status(self, status: str) -> None:
        """改任务状态。

        Args:
            status: 新状态。
        """
        with self.lock:
            self.status = status

    @property
    def finished(self) -> bool:
        """是否已到终态。"""
        return self.status in _TERMINAL

    def snapshot(self) -> dict[str, Any]:
        """当前状态副本。

        Returns:
            含 status / slider / qr / events 的 dict。
        """
        with self.lock:
            return {
                "task_id": self.task_id,
                "kind": self.kind,
                "status": self.status,
                "phone": self.phone,
                "phone_masked": _mask_phone(self.phone),
                "dial_code": self.dial_code,
                "created_at": self.created_at,
                "attempts": self.attempts,
                "retry_after": self.retry_after,
                "error": self.error,
                "result": self.result,
                "slider": {
                    "needed": self.slider_needed,
                    "solved": bool(self.slider_box.get("solution")),
                    "page_url": self.url_for("slider", self.task_id),
                },
                "qr": {
                    "active": self.status == ST_NEED_SCAN or self.qr_scanned,
                    "payload": self.qr_payload,
                    "scanned": self.qr_scanned,
                    "confirmed": self.qr_confirmed,
                    "head_img": self.qr_head_img,
                    "pk": self.qr_pk,
                    "revision": self.qr_revision,
                    "image_url": (
                        self.url_for("qr", self.task_id, suffix="image")
                        + f"?v={self.qr_revision}"
                        if self.qr_payload
                        else ""
                    ),
                },
                "events": list(self.events),
            }


def _mask_phone(phone: str) -> str:
    """手机号打码成 `138****1234`。

    Args:
        phone: 手机号。

    Returns:
        打码后的手机号。
    """
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 7:
        return phone
    return f"{digits[:3]}****{digits[-4:]}"


class LoginTaskRunner:
    """登录任务执行器：同一时刻只跑一个任务（本机单用户工具）。

    Attributes:
        _runtime: 注入的任务中心。
        _session_path: 会话落盘路径覆盖。
        _lock: 任务槽锁。
        _tasks: 任务字典。
        _current: 当前任务。
    """

    def __init__(self, runtime: LoginRuntime, *, session_path: Any = None) -> None:
        """初始化。"""
        self._runtime = runtime
        self._session_path = session_path
        self._lock = threading.Lock()
        self._tasks: dict[str, LoginTask] = {}
        self._current: LoginTask | None = None

    def current(self) -> LoginTask | None:
        """当前任务；没有则 `None`。

        Returns:
            当前任务或 `None`。
        """
        with self._lock:
            return self._current

    def get(self, task_id: str) -> LoginTask:
        """按 id 取任务；任务不存在时抛 `AuthNotFound`。

        Args:
            task_id: 任务 id。

        Returns:
            登录任务。
        """
        task = self._tasks.get(task_id)
        if task is None:
            raise AuthNotFound(f"登录任务不存在：{task_id}")
        return task

    def snapshot(self, task_id: str | None = None) -> dict[str, Any]:
        """查询进度快照。

        Args:
            task_id: 可选任务 id；不传取当前任务。

        Returns:
            任务快照；没有任务则空 dict。
        """
        if task_id:
            return self.get(task_id).snapshot()
        task = self.current()
        return task.snapshot() if task else {}

    def start_send(self, phone: str, *, dial_code: str = "86") -> LoginTask:
        """起短信登录线程；手机号位数不对抛 `AuthValidation`，已有流程在跑抛 `AuthConflict`。

        Args:
            phone: 手机号。
            dial_code: 区号。

        Returns:
            新建的登录任务。
        """
        digits = "".join(ch for ch in phone if ch.isdigit())
        if len(digits) < 11:
            raise AuthValidation("手机号看起来不对，请填 11 位数字")

        self._runtime.occupy("sms")
        with self._lock:
            if self._current is not None and not self._current.finished:
                raise AuthConflict("已有登录流程在进行中，请先完成或取消")

            task = LoginTask(
                task_id=uuid.uuid4().hex[:12],
                phone=digits,
                dial_code=dial_code,
                kind="sms",
                url_for=self._runtime.build_url,
            )
            self._tasks[task.task_id] = task
            self._current = task
        self._runtime.track(task)

        thread = threading.Thread(
            target=self._run_sms_login, args=(task,), daemon=True, name=f"login-{task.task_id}"
        )
        thread.start()
        return task

    def start_qr(self, *, pk: str = "") -> LoginTask:
        """起一条 APP 扫码登录：后台出二维码、等手机扫、等 App 确认；已有流程在跑抛 `AuthConflict`。

        Args:
            pk: 扫码登录 pk；空则用默认。

        Returns:
            新建的登录任务。
        """
        self._runtime.occupy("qr")
        with self._lock:
            if self._current is not None and not self._current.finished:
                raise AuthConflict("已有登录流程在进行中，请先完成或取消")

            task = LoginTask(
                task_id=uuid.uuid4().hex[:12],
                phone="",
                dial_code="",
                kind="qr",
                url_for=self._runtime.build_url,
            )
            task.qr_pk = pk
            self._tasks[task.task_id] = task
            self._current = task
        self._runtime.track(task)

        thread = threading.Thread(
            target=self._run_qr_login, args=(task,), daemon=True, name=f"qr-{task.task_id}"
        )
        thread.start()
        return task

    def qr_png(self, task_id: str) -> bytes:
        """把任务当前的二维码画成 PNG；没有二维码抛 `AuthNotFound`，渲染失败抛 `AuthUpstream`。

        Args:
            task_id: 任务 id。

        Returns:
            PNG 字节。
        """
        task = self.get(task_id)
        payload = task.qr_payload
        if not payload:
            raise AuthNotFound("本次登录还没有二维码")
        try:
            return render_qr_png(payload, scale=10, border=1)
        except RuntimeError as exc:
            raise AuthUpstream(str(exc)) from exc

    def submit_code(self, task_id: str, code: str) -> LoginTask:
        """把验证码塞给阻塞中的 `code_provider`；空码抛 `AuthValidation`，已结束抛 `AuthConflict`。

        Args:
            task_id: 任务 id。
            code: 验证码。

        Returns:
            登录任务。
        """
        task = self.get(task_id)
        code = (code or "").strip()
        if not code:
            raise AuthValidation("验证码不能为空")
        if task.finished:
            raise AuthConflict("本次登录已结束，请重新发起")
        with task.lock:
            task.code_box["code"] = code
            task.attempts += 1
            task.code_event.set()
            task.set_status(ST_LOGGING_IN)
        task.record("code_submitted", {"attempt": task.attempts})
        return task

    def solve_slider(self, task_id: str, payload: Mapping[str, Any]) -> LoginTask:
        """把极验票据塞给阻塞中的 `slider_solver`；已结束抛 `AuthConflict`，票据不完整抛 `AuthValidation`。

        Args:
            task_id: 任务 id。
            payload: 票据载荷。

        Returns:
            登录任务。
        """
        task = self.get(task_id)
        if task.finished:
            raise AuthConflict("本次登录已结束")
        try:
            solution = parse_solution(payload)
        except ValidationError as exc:
            raise AuthValidation(f"滑块票据不完整：{exc}") from exc
        with task.lock:
            task.slider_box["solution"] = solution
            task.slider_needed = False
            task.slider_event.set()
            task.set_status(ST_LOGGING_IN if task.attempts else ST_SENDING)
        task.record("slider_solved", {"challenge": solution.challenge})
        return task

    def refresh_slider(self, task_id: str) -> LoginTask:
        """帮助页「重新加载」：换一张新的极验挑战，重建帮助页。

        Args:
            task_id: 任务 id。

        Returns:
            登录任务。
        """
        task = self.get(task_id)
        if task.finished:
            raise AuthConflict("本次登录已结束，请重新发起")
        refresher = task.slider_refresher
        if refresher is None:
            raise AuthConflict("当前没有待完成的滑块验证")
        try:
            challenge = refresher()
        except BossLoginError as exc:
            raise AuthUpstream(
                "没能取到新的滑块验证。请在滑块弹窗里点「重新加载」，"
                "还不行就关掉弹窗，回「登录」页重新走一遍。"
            ) from exc
        html = build_helper_html(
            challenge,
            post_url=self._runtime.build_url("slider", task.task_id, suffix="solution"),
        )
        with task.lock:
            task.slider_challenge = challenge
            task.slider_html = html
            task.slider_needed = True
            task.slider_box.clear()
            task.slider_event.clear()
            task.set_status(ST_NEED_SLIDER)
        task.record("slider_refreshed", {"gt": challenge.gt})
        return task

    def cancel(self, task_id: str) -> LoginTask:
        """取消登录任务并唤醒阻塞回调。

        Args:
            task_id: 任务 id。

        Returns:
            被取消的任务。
        """
        task = self.get(task_id)
        with task.lock:
            task.cancel_flag = True
            task.code_box["code"] = None
            task.code_event.set()
            task.slider_box["solution"] = None
            task.slider_event.set()
            task.set_status(ST_CANCELLED)
        task.record("cancelled", {})
        return task

    def _web_slider_solver(self, task: LoginTask, client: Any) -> SliderSolver:
        """`slider_solver` 回调：挂出帮助页，等人拖完把票据送回来。

        Args:
            task: 登录任务。
            client: 登录客户端（「重新加载」要回服务端拉新挑战）。

        Returns:
            solver 回调。
        """
        def fetch_challenge() -> SliderChallenge:
            """回服务端重新拉一张极验挑战。"""
            return client.fetch_slider_challenge()

        def solver(challenge: SliderChallenge) -> SliderSolution | None:
            """挂帮助页并等票据；超时 / 取消回 `None`。"""
            if task.cancel_flag:
                return None
            html = build_helper_html(
                challenge,
                post_url=self._runtime.build_url("slider", task.task_id, suffix="solution"),
            )
            with task.lock:
                task.slider_challenge = challenge
                task.slider_html = html
                task.slider_needed = True
                task.slider_refresher = fetch_challenge
                task.slider_box.clear()
                task.slider_event.clear()
                task.set_status(ST_NEED_SLIDER)
            task.record("slider_required", {"gt": challenge.gt})

            if not task.slider_event.wait(self._runtime.wait_timeout()):
                task.record("slider_timeout", {})
                return None
            if task.cancel_flag:
                return None
            return task.slider_box.get("solution")

        return solver

    def _code_provider(self, task: LoginTask):
        """`code_provider` 回调：等网页表单把验证码塞进来。

        Args:
            task: 登录任务。

        Returns:
            provider 回调。
        """
        def provider(attempt: int, _ticket: Any) -> str | None:
            """等验证码；超时 / 取消回 `None`。"""
            with task.lock:
                task.attempts = max(task.attempts, attempt)
                task.set_status(ST_NEED_CODE)
            task.record("need_code", {"attempt": attempt})
            if not task.code_event.wait(self._runtime.wait_timeout()):
                task.record("code_timeout", {})
                return None
            if task.cancel_flag:
                return None
            code = task.code_box.get("code")
            task.code_event.clear()
            return code

        return provider

    def _run_sms_login(self, task: LoginTask) -> None:
        """短信登录的后台线程。

        Args:
            task: 登录任务。
        """
        kwargs: dict[str, Any] = {"load_stored": True}
        if self._session_path is not None:
            kwargs["session_path"] = self._session_path
        client = create_client(**kwargs)
        solver = self._web_slider_solver(task, client)

        def on_event(name: str, payload: dict[str, Any]) -> None:
            """把底层事件写进任务流水。"""
            task.record(name, payload)

        try:
            task.set_status(ST_SENDING)
            task.record("started", {"phone_masked": _mask_phone(task.phone)})
            result = client.run_sms_login(
                task.phone,
                self._code_provider(task),
                dial_code=task.dial_code,
                slider_solver=solver,
                on_event=on_event,
            )
            if task.cancel_flag:
                task.set_status(ST_CANCELLED)
                return
            self._finish_ok(task, client, result)
        except CodeRejected as exc:
            self._finish_err(task, f"验证码不对：{exc}")
        except RateLimited as exc:
            with task.lock:
                task.retry_after = float(getattr(exc, "retry_after", 60) or 60)
            self._finish_err(task, f"发送太频繁：{exc}")
        except RiskControlRequired as exc:
            self._finish_err(task, f"触发风控，需要人工处理：{exc}")
        except ValidationError as exc:
            self._finish_err(task, str(exc))
        except BossLoginError as exc:
            if task.cancel_flag:
                task.set_status(ST_CANCELLED)
            else:
                self._finish_err(task, str(exc))
        except Exception as exc:  # noqa: BLE001 - 兜住线程里的意外
            logger.exception("登录任务 %s 崩了", task.task_id)
            self._finish_err(task, f"登录流程出错：{exc}")

    def _run_qr_login(self, task: LoginTask) -> None:
        """APP 扫码登录的后台线程：出二维码 → 等手机扫 → 等 App 确认 → 落盘。

        Args:
            task: 登录任务。
        """
        kwargs: dict[str, Any] = {"load_stored": True}
        if self._session_path is not None:
            kwargs["session_path"] = self._session_path
        client = create_client(**kwargs)
        login = AppScanLogin(client, pk=task.qr_pk or QR_DEFAULT_PK)

        def on_payload(payload: str) -> None:
            """收到二维码内容时写进任务。"""
            with task.lock:
                task.qr_payload = payload
                task.qr_revision += 1
                task.set_status(ST_NEED_SCAN)
            task.record("qr_ready", {"revision": task.qr_revision})

        def on_event(name: str, payload: dict[str, Any]) -> None:
            """把扫码关心的状态写进任务快照。"""
            with task.lock:
                if name == "qr_scanned":
                    task.qr_scanned = True
                    task.set_status(ST_LOGGING_IN)
                elif name == "qr_head":
                    task.qr_head_img = str(payload.get("head_img") or "")
                elif name == "qr_confirmed":
                    task.qr_confirmed = True
                elif name in ("qr_cancelled", "qr_expired"):
                    task.cancel_flag = True
            task.record(name, payload)

        try:
            task.record("started", {"kind": "qr"})
            result = login.run(
                on_event=on_event,
                on_payload=on_payload,
                should_cancel=lambda: task.cancel_flag,
            )
            if task.cancel_flag:
                task.set_status(ST_CANCELLED)
                return
            self._finish_ok(task, client, result)
        except AccountBlocked as exc:
            self._finish_err(task, f"账号或 IP 被限制，别再扫了：{exc}")
        except BossLoginError as exc:
            if task.cancel_flag:
                task.set_status(ST_CANCELLED)
            else:
                self._finish_err(task, str(exc))
        except Exception as exc:  # noqa: BLE001 - 兜住线程里的意外
            logger.exception("扫码登录任务 %s 崩了", task.task_id)
            self._finish_err(task, f"扫码登录出错：{exc}")

    def _finish_ok(self, task: LoginTask, client: Any, result: LoginResult) -> None:
        """登录成功：落盘会话并写成功状态。

        Args:
            task: 登录任务。
            client: 登录客户端。
            result: 登录结果。
        """
        try:
            persist_login(client, result, session_path=self._session_path)
        except Exception as exc:  # noqa: BLE001 - 落盘失败不该把登录说成失败
            logger.warning("登录成功但写状态库失败：%s", exc)
        with task.lock:
            task.result = {
                "logged_in": True,
                "phone_masked": getattr(result, "phone_masked", "") or _mask_phone(task.phone),
                "user": getattr(result, "user", None) or {},
            }
            task.set_status(ST_DONE)
        task.record("success", task.result)

    @staticmethod
    def _finish_err(task: LoginTask, message: str) -> None:
        """登录失败：写错误状态。

        Args:
            task: 登录任务。
            message: 错误文案。
        """
        with task.lock:
            task.error = message
            task.set_status(ST_ERROR)
        task.record("error", {"message": message})
