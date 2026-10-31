"""BOSS 直聘站点适配器：包本包内 `jobs` / `auth` / `catalog` 能力实现。

能力方法往下委派现成实现，不搬业务；平台私有检索路径留在本模块。
"""

from __future__ import annotations

import logging
from typing import Any, Iterator, Mapping

from boss_core.contracts import (
    ApplyGate,
    ApplyReceipt,
    AuthCaps,
    ConversationState,
    DeliveryCaps,
    DeliverFault,
    JobRef,
    LoginHandle,
    LoginState,
    NavExtra,
    PageResult,
    ResumeRef,
    SearchCriteria,
    SearchParams,
    SendReceipt,
    SessionRef,
    SiteFilterOptions,
    SourceCaps,
)
from boss_core.protocols import AuthSink
from boss_platform_base.registry import register

logger = logging.getLogger(__name__)

SITE_ID = "boss"


def _core_page(result: Any, *, page: int, has_more: bool | None = None) -> PageResult:
    """把 `boss_platform_boss.jobs.models.PageResult` 换成核心层的一页形状。"""
    jobs = tuple(getattr(result, "jobs", ()) or ())
    more = bool(getattr(result, "has_more", False)) if has_more is None else has_more
    return PageResult(items=jobs, page=page, has_more=more)


class BossAdapter:
    """BOSS 站点门面：五能力 + 故障分类 + 私有入口。"""

    site_id = SITE_ID
    display_name = "BOSS直聘"
    icon = "boss"

    def __init__(self) -> None:
        """初始化；能力对象懒建，不在 import 期碰网络/登录态。"""
        self.auth = BossAuthFlow()
        self.catalog = BossCatalog()
        self.jobs = BossJobSource()
        self.messenger = BossMessenger()
        self.applier = BossApplier()

    def nav_extras(self) -> tuple[NavExtra, ...]:
        """BOSS 私有入口：求职期望流。"""
        return (NavExtra(key="expect", label="求职期望", route="expect"),)

    def session_summary(self) -> Mapping[str, Any]:
        """从登录网关抽会话三件套。"""
        from .auth.gateway import get_gateway

        gateway = get_gateway()
        payload = gateway.status_payload() if gateway is not None else {}
        task = payload.get("task") or {}
        busy = bool(task) and str(task.get("status") or "") not in (
            "done",
            "error",
            "cancelled",
            "",
        )
        return {
            "logged_in": bool(payload.get("logged_in")),
            "phone_masked": payload.get("phone_masked") or "",
            "busy": busy,
        }

    def classify_fault(self, err: Exception) -> DeliverFault:
        """BOSS 业务码 → 统一故障类（发对话/投递共用）。"""
        from .jobs.errors import ChatSendError, JobApiError, JobTransportError

        if isinstance(err, JobApiError):
            if err.is_session_expired:
                return DeliverFault.SESSION_CLOSED
            if err.is_risk_control or err.is_browser_check:
                return DeliverFault.RISK_CONTROL
            if err.is_chat_remind:
                return DeliverFault.QUOTA
            message = err.message or ""
            if any(word in message for word in ("频繁", "限频", "太快", "稍后")):
                return DeliverFault.RATE_LIMIT
            if any(word in message for word in ("次数", "配额", "额度")):
                return DeliverFault.QUOTA
            return DeliverFault.UNKNOWN
        if isinstance(err, ChatSendError):
            return DeliverFault.UNKNOWN
        if isinstance(err, JobTransportError):
            return DeliverFault.UNKNOWN
        return DeliverFault.UNKNOWN

    def fetch_expects(self) -> Any:
        """拉当前账号的求职期望列表（`boss_platform_boss.jobs.ExpectList`）。"""
        from .jobs.client import create_client

        return create_client().fetch_expect_list()

    def expect_search_params(
        self, *, kind: str, encrypt_expect_id: str = "", page: int = 1, page_size: int = 15
    ) -> SearchParams:
        """期望流检索参数（站点私有）。"""
        from .catalog.expect import JobExpectFilter

        f = JobExpectFilter(
            kind=kind, encrypt_expect_id=encrypt_expect_id, page=page, page_size=page_size
        )
        return f.to_params()

    def fetch_expect_page(self, params: SearchParams, page: int) -> PageResult:
        """期望流一页。"""
        from .jobs.client import create_client

        class _Stub:
            """把已拼好的参数串喂给 client（client 只认 `to_params`/`for_page`）。"""

            def __init__(self, base: Mapping[str, Any], p: int) -> None:
                """收下参数串副本与页码。"""
                self._params = {**dict(base), "page": str(p)}

            def to_params(self) -> dict[str, str]:
                """回查询参数。"""
                return {k: str(v) for k, v in self._params.items()}

            def for_page(self, p: int) -> "_Stub":
                """回换了页码的新对象。"""
                return _Stub(self._params, p)

        result = create_client().fetch_expect_page(_Stub(params, page), page=page)
        return _core_page(result, page=page)


class BossAuthFlow:
    """登录：只认 `auth.gateway` 注入的登录任务中心（server 实现）。"""

    def caps(self) -> AuthCaps:
        """BOSS 三样都有：短信 / 人机协作滑块 / APP 扫码。"""
        return AuthCaps(supports_sms=True, supports_slider=True, supports_qr=True)

    def start_sms(self, phone: str, sink: AuthSink) -> LoginHandle:
        """起短信登录。"""
        gateway = _gateway()
        task = gateway.start_send(phone)
        return str(task.task_id)

    def submit_code(self, handle: LoginHandle, code: str) -> None:
        """塞验证码。"""
        _gateway().submit_code(handle, code)

    def submit_slider(self, handle: LoginHandle, ticket: str | Mapping[str, Any]) -> None:
        """塞滑块票据；字符串票据当 `geetest_validate` 收。"""
        payload: Mapping[str, Any]
        if isinstance(ticket, Mapping):
            payload = ticket
        else:
            payload = {"geetest_validate": ticket}
        _gateway().solve_slider(handle, payload)

    def start_qr(self, sink: AuthSink) -> LoginHandle:
        """起 APP 扫码登录。"""
        gateway = _gateway()
        task = gateway.start_qr()
        return str(task.task_id)

    def poll(self, handle: LoginHandle) -> LoginState:
        """看登录任务状态。"""
        snap = _gateway().snapshot(handle)
        status = str(snap.get("status") or "running")
        return LoginState(
            status=status,
            message=str(snap.get("error") or ""),
            payload=snap,
        )


def _gateway() -> Any:
    """取已绑定的登录任务中心；未绑定（平台包单测）时报清楚。"""
    from .auth.gateway import get_gateway

    gateway = get_gateway()
    if gateway is None:
        raise RuntimeError("登录任务中心未绑定：先在 server 侧 import boss_server.services.login_task")
    return gateway


class BossCatalog:
    """筛选：薄壳包 `catalog`（选项表 + 通用条件 → 参数串）。"""

    def fetch_filter_options(self) -> SiteFilterOptions:
        """`GET /filters/conditions` 同源。"""
        from .catalog import get_filter_conditions

        cond = get_filter_conditions()
        data = cond.to_dict()
        data["source"] = getattr(cond, "source", "")
        data["degraded"] = getattr(cond, "degraded", {})
        return data

    def unsupported(self) -> tuple[str, ...]:
        """BOSS 搜索流维度齐全。"""
        return ()

    def to_search_params(self, criteria: SearchCriteria) -> SearchParams:
        """通用检索维度 → BOSS 查询串参数（空值不进串，让站点走默认）。"""
        from .catalog.search import JobSearchFilter

        f = JobSearchFilter.from_codes(
            query=criteria.keyword,
            city=criteria.city,
            job_type=criteria.job_type,
            salary=criteria.salary,
            experience=criteria.experience,
            degree=criteria.degree,
            industry=criteria.industry,
            scale=criteria.scale,
            pay_type=criteria.pay_type,
            part_time=criteria.part_time,
            stage=criteria.stage,
            page=criteria.page,
            page_size=criteria.page_size,
        )
        return f.to_params()


class BossJobSource:
    """职位发现：薄壳包 `jobs.JobClient`（搜索流 + 详情）。"""

    def caps(self) -> SourceCaps:
        """BOSS 有期望流、标签、技能。"""
        return SourceCaps(has_expect_flow=True, has_tags=True, has_skills=True)

    def search_page(self, params: SearchParams, page: int) -> PageResult:
        """按参数串抓一页。"""
        from .jobs.client import create_client

        result = create_client().fetch_search_page(_ParamFilter(params), page=page)
        return _core_page(result, page=page)

    def iter_pages(self, params: SearchParams) -> Iterator[PageResult]:
        """翻页迭代；页间硬睡在 client 里。"""
        from .jobs.client import create_client

        for result in create_client().iter_pages(search_filter=_ParamFilter(params)):
            yield _core_page(result, page=int(getattr(result, "page", 1)))

    def fetch_detail(self, ref: JobRef) -> Any:
        """抓 JD 正文；`ref.extra` 带 `security_id`/`lid`。"""
        from .jobs.client import create_client

        return create_client().fetch_job_detail(
            security_id=str(ref.extra.get("security_id") or ""),
            lid=str(ref.extra.get("lid") or ""),
        )


class BossMessenger:
    """发对话：建会话（friend/add）→ 换 boss uid → MQTT 发正文。"""

    def open_session(self, ref: JobRef) -> SessionRef:
        """只建会话，不发正文。"""
        from .jobs.client import create_client

        result = create_client().greet(
            security_id=str(ref.extra.get("security_id") or ""),
            encrypt_job_id=ref.job_id,
            lid=str(ref.extra.get("lid") or ""),
            encrypt_boss_id=str(ref.extra.get("encrypt_boss_id") or ""),
            session_id=str(ref.extra.get("session_id") or ""),
        )
        return SessionRef(
            site_id=SITE_ID,
            session_id=ref.job_id,
            extra={
                **dict(ref.extra),
                "greet_message": getattr(result, "message", ""),
            },
        )

    def send_text(self, session: SessionRef, text: str) -> SendReceipt:
        """真·打招呼（建会话 → 换 uid → 发正文）。"""
        from .jobs.client import create_client

        delivery = create_client().deliver_greeting(
            security_id=str(session.extra.get("security_id") or ""),
            encrypt_job_id=str(session.session_id or ""),
            lid=str(session.extra.get("lid") or ""),
            encrypt_boss_id=str(session.extra.get("encrypt_boss_id") or ""),
            greeting=text,
            session_id=str(session.extra.get("session_id") or ""),
        )
        return SendReceipt(ok=True, message=getattr(delivery, "text", "") or "")

    def conversation_state(self, session: SessionRef) -> ConversationState:
        """按聊天历史判门槛：对方有回话 = `REPLIED`；只有我方 = 等回复。"""
        from .jobs.client import create_client

        encrypt_boss_id = str(session.extra.get("encrypt_boss_id") or "")
        if not encrypt_boss_id:
            return ConversationState.WAITING_REPLY
        client = create_client()
        boss = client.fetch_boss_data(encrypt_boss_id)
        messages = client.fetch_chat_history(boss.uid)
        me = client.fetch_me().user_id
        for msg in messages:
            from_uid = int(msg.get("fromUid") or msg.get("from") or 0)
            if from_uid and from_uid != me:
                return ConversationState.REPLIED
        return ConversationState.WAITING_REPLY


class BossApplier:
    """投递简历：门槛 + 通道自述；onekeydeliver 通道尚未接入，`apply()` 明确拒绝。"""

    def caps(self) -> DeliveryCaps:
        """默认双方对话后才可投；通道名自述 onekeydeliver。"""
        return DeliveryCaps(
            apply_gate=ApplyGate.AFTER_MUTUAL_CONVERSATION,
            apply_channel="onekeydeliver",
        )

    def apply(self, session: SessionRef, resume: ResumeRef) -> ApplyReceipt:
        """投递简历。"""
        raise NotImplementedError(
            "BOSS 投递通道 onekeydeliver 尚未接入：先走发对话，过门槛后投递"
        )


class _ParamFilter:
    """把 `Catalog.to_search_params` 产出的参数串喂给 `JobClient`。"""

    def __init__(self, params: Mapping[str, Any]) -> None:
        """收下参数串副本。"""
        self._params = dict(params)

    def to_params(self) -> dict[str, str]:
        """回查询参数。"""
        return {str(k): str(v) for k, v in self._params.items()}

    def for_page(self, page: int) -> "_ParamFilter":
        """回换了页码的新对象。"""
        return _ParamFilter({**self._params, "page": str(page)})


register(SITE_ID)(BossAdapter)
