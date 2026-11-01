"""登录任务中心（server 侧）：把平台登录状态机接到网页路由与任务总线上。

状态机本体在 `jobpilot_platform_boss.auth.task`；这里只保留 server 职责：
任务类型登记、`TaskHub` 占用/广播、会话自检、web 错误映射、URL 站点作用域。
滑块只是人机协作管道，不认缺口、不伪造轨迹。

Attributes:
    ST_PENDING: 任务状态：待启动（转发平台常量）。
    login_tasks: 模块级单例，app 启动时直接用。
"""

from __future__ import annotations

from typing import Any, Callable, Mapping, TypeVar

import jobpilot_db

from jobpilot_platform_boss.auth.gateway import bind_gateway
from jobpilot_platform_boss.auth.session import load_session
from jobpilot_platform_boss.auth.task import (
    ST_CANCELLED,
    ST_DONE,
    ST_ERROR,
    ST_LOGGING_IN,
    ST_NEED_CODE,
    ST_NEED_SCAN,
    ST_NEED_SLIDER,
    ST_PENDING,
    ST_SENDING,
    AuthConflict,
    AuthError,
    AuthNotFound,
    AuthUpstream,
    AuthValidation,
    LoginTask,
    LoginTaskRunner,
)

from .. import config as C
from ..errors import ConflictError, NotFoundError, UpstreamError, ValidationWebError
from .task_runtime import POLICY_GLOBAL_SINGLE, TaskTypeSpec, hub

T = TypeVar("T")

SITE = "boss"

hub.register(
    TaskTypeSpec(
        "login",
        title="登录",
        policy=POLICY_GLOBAL_SINGLE,
        title_fn=lambda req: f"登录（{req.get('kind') or 'sms'}）",
        site=SITE,
    )
)


class _ServerLoginRuntime:
    """`LoginRuntime` 的 server 实现：占用/广播走 TaskHub，URL 带站点前缀。"""

    def __init__(self, wait_timeout: Callable[[], float]) -> None:
        """初始化。"""
        self._wait_timeout = wait_timeout

    def occupy(self, kind: str) -> None:
        """提交前的占用检查。"""
        hub.occupy("login", request={"kind": kind})

    def track(self, task: LoginTask) -> None:
        """把任务登记进 Hub，状态变化自动广播。"""
        request: dict[str, Any] = {"kind": task.kind}
        if task.kind == "sms":
            request["phone"] = task.phone
        hub.track(task, task_type="login", request=request)

    def build_url(self, action: str, task_id: str, *, suffix: str = "") -> str:
        """站点作用域的登录任务 URL。"""
        tail = f"{action}/{task_id}" + (f"/{suffix}" if suffix else "")
        return f"/api/sites/{SITE}/auth/{tail}"

    def wait_timeout(self) -> float:
        """等验证码 / 滑块的超时秒数。"""
        return self._wait_timeout()


def _translate(call: Callable[[], T]) -> T:
    """把平台侧 Auth* 错误翻成网页可读错误。"""
    try:
        return call()
    except AuthNotFound as exc:
        raise NotFoundError(str(exc)) from exc
    except AuthConflict as exc:
        raise ConflictError(str(exc)) from exc
    except AuthValidation as exc:
        raise ValidationWebError(str(exc)) from exc
    except AuthUpstream as exc:
        raise UpstreamError(str(exc)) from exc


class LoginTaskManager:
    """同一时刻只跑一个登录任务（本机单用户工具）。

    Attributes:
        _session_path: 会话落盘路径覆盖。
        _wait_timeout: 等验证码 / 滑块的超时。
        _runner: 平台登录任务执行器。
    """

    def __init__(self, *, session_path: Any = None, wait_timeout: float | None = None) -> None:
        """初始化。"""
        self._session_path = session_path
        self._wait_timeout = wait_timeout or C.LOGIN_WAIT_TIMEOUT
        self._runner = LoginTaskRunner(
            _ServerLoginRuntime(lambda: self._wait_timeout),
            session_path=session_path,
        )

    @property
    def _tasks(self) -> dict[str, LoginTask]:
        """任务字典（执行器持有）。"""
        return self._runner._tasks

    @_tasks.setter
    def _tasks(self, value: dict[str, LoginTask]) -> None:
        """替换任务字典（测试隔离用）。"""
        self._runner._tasks = value

    @property
    def _current(self) -> LoginTask | None:
        """当前任务（执行器持有）。"""
        return self._runner._current

    @_current.setter
    def _current(self, value: LoginTask | None) -> None:
        """直接设当前任务（测试隔离用）。"""
        self._runner._current = value

    def current(self) -> LoginTask | None:
        """当前任务；没有则 `None`。

        Returns:
            当前任务或 `None`。
        """
        return self._runner.current()

    def get(self, task_id: str) -> LoginTask:
        """按 id 取任务；任务不存在时抛 `NotFoundError`。

        Args:
            task_id: 任务 id。

        Returns:
            登录任务。
        """
        return _translate(lambda: self._runner.get(task_id))

    def snapshot(self, task_id: str | None = None) -> dict[str, Any]:
        """查询进度快照。

        Args:
            task_id: 可选任务 id；不传取当前任务。

        Returns:
            任务快照；没有任务则空 dict。
        """
        return _translate(lambda: self._runner.snapshot(task_id))

    def status_payload(self) -> dict[str, Any]:
        """`GET /api/auth/status` 用：本地会话 + 当前任务 + 启动自检结论。

        Returns:
            登录状态载荷。
        """
        from . import session_check

        path = jobpilot_db.resolve_db_path(self._session_path)
        stored = load_session(path)
        task = self.current()
        check = session_check.snapshot()
        expired = str(check.get("state") or "") == session_check.ST_EXPIRED
        return {
            "logged_in": (not expired) and bool(stored.cookies or stored.token),
            "phone_masked": stored.phone_masked,
            "user": stored.user,
            "saved_at": stored.saved_at,
            "session_path": str(path),
            "check": {
                "state": check.get("state") or "",
                "checked_at": check.get("checked_at") or 0.0,
                "message": check.get("message") or "",
                "cleared": bool(check.get("cleared")),
            },
            "task": task.snapshot() if task else None,
        }

    def start_send(self, phone: str, *, dial_code: str = "86") -> LoginTask:
        """起短信登录线程；手机号位数不对抛 `ValidationWebError`，已有流程在跑抛 `ConflictError`。

        Args:
            phone: 手机号。
            dial_code: 区号。

        Returns:
            新建的登录任务。
        """
        return _translate(lambda: self._runner.start_send(phone, dial_code=dial_code))

    def start_qr(self, *, pk: str = "") -> LoginTask:
        """起一条 APP 扫码登录；已有流程在跑抛 `ConflictError`。

        Args:
            pk: 扫码登录 pk；空则用默认。

        Returns:
            新建的登录任务。
        """
        return _translate(lambda: self._runner.start_qr(pk=pk))

    def qr_png(self, task_id: str) -> bytes:
        """把任务当前的二维码画成 PNG；没有二维码抛 `NotFoundError`，渲染失败抛 `UpstreamError`。

        Args:
            task_id: 任务 id。

        Returns:
            PNG 字节。
        """
        return _translate(lambda: self._runner.qr_png(task_id))

    def submit_code(self, task_id: str, code: str) -> LoginTask:
        """把验证码塞给阻塞中的 `code_provider`。

        Args:
            task_id: 任务 id。
            code: 验证码。

        Returns:
            登录任务。
        """
        return _translate(lambda: self._runner.submit_code(task_id, code))

    def solve_slider(self, task_id: str, payload: Mapping[str, Any]) -> LoginTask:
        """把极验票据塞给阻塞中的 `slider_solver`。

        Args:
            task_id: 任务 id。
            payload: 票据载荷。

        Returns:
            登录任务。
        """
        return _translate(lambda: self._runner.solve_slider(task_id, payload))

    def refresh_slider(self, task_id: str) -> LoginTask:
        """帮助页「重新加载」：换一张新的极验挑战。

        Args:
            task_id: 任务 id。

        Returns:
            登录任务。
        """
        return _translate(lambda: self._runner.refresh_slider(task_id))

    def cancel(self, task_id: str) -> LoginTask:
        """取消登录任务并唤醒阻塞回调。

        Args:
            task_id: 任务 id。

        Returns:
            被取消的任务。
        """
        return _translate(lambda: self._runner.cancel(task_id))


login_tasks = LoginTaskManager()

bind_gateway(login_tasks)

__all__ = [
    "AuthError",
    "LoginTask",
    "LoginTaskManager",
    "ST_CANCELLED",
    "ST_DONE",
    "ST_ERROR",
    "ST_LOGGING_IN",
    "ST_NEED_CODE",
    "ST_NEED_SCAN",
    "ST_NEED_SLIDER",
    "ST_PENDING",
    "ST_SENDING",
    "login_tasks",
]
