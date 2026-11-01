"""多平台核心契约：零依赖的数据类与枚举。

这里只描述形状，不 import 任何 `boss_*` 包；server 编排层只认这里。

Attributes:
    LoginHandle: 登录任务句柄（BOSS 是 `login_task` 的 task_id）。
    SiteFilterOptions: 站点筛选选项表，形状站点私有，核心层不解析。
    SearchParams: 站点私有检索参数串，server 当不透明对象传递。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping


class ApplyGate(Enum):
    """投递门槛：管什么时候允许投简历，不是要不要发对话。

    Attributes:
        AFTER_MUTUAL_CONVERSATION: 默认，双方对话成立后才投简历。
        AFTER_GREETING: 发完对话即可投简历。
    """

    AFTER_MUTUAL_CONVERSATION = "after_mutual_conversation"
    AFTER_GREETING = "after_greeting"


class ConversationState(Enum):
    """会话阶段（发对话与投递之间的门槛判据）。

    Attributes:
        WAITING_REPLY: 对话已发出，对方未回。
        REPLIED: 双方对话成立。
        CLOSED: 会话关闭/对方拒绝。
    """

    WAITING_REPLY = "waiting_reply"
    REPLIED = "replied"
    CLOSED = "closed"


class DeliverFault(Enum):
    """发对话/投递共用的故障分类（站点自述映射，前端按类渲染统一文案）。

    Attributes:
        QUOTA: 配额用尽。
        RATE_LIMIT: 限频。
        RISK_CONTROL: 风控/安全。
        SESSION_CLOSED: 登录态失效。
        UNKNOWN: 未归类。
    """

    QUOTA = "quota"
    RATE_LIMIT = "rate_limit"
    RISK_CONTROL = "risk_control"
    SESSION_CLOSED = "session_closed"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class AuthCaps:
    """登录能力自述：缺哪项 UI 就降级哪项入口。

    Attributes:
        supports_slider: 人机协作滑块（不是绕过）。
        supports_qr: 扫码。
    """

    supports_sms: bool = True
    supports_slider: bool = True
    supports_qr: bool = False


@dataclass(frozen=True)
class SourceCaps:
    """职位来源能力自述。

    Attributes:
        has_expect_flow: BOSS 求职期望流这类站点私有检索路径。
    """

    has_expect_flow: bool = False
    has_tags: bool = False
    has_skills: bool = False


@dataclass(frozen=True)
class DeliveryCaps:
    """投递能力自述。

    Attributes:
        apply_channel: 站点投递机制自述（onekeydeliver / 站内表单 / …）。
    """

    apply_gate: ApplyGate = ApplyGate.AFTER_MUTUAL_CONVERSATION
    apply_channel: str = ""


@dataclass(frozen=True)
class SearchCriteria:
    """通用检索维度；code 语义沿用 `jobpilot_platform_boss.catalog`（字符串 code，空 = 站点默认）。

    站点差异由 `Catalog.unsupported()` 声明，UI 置灰不硬塞。
    """

    keyword: str = ""
    city: str = ""
    job_type: str = ""
    salary: str = ""
    experience: tuple[str, ...] = ()
    degree: tuple[str, ...] = ()
    industry: tuple[str, ...] = ()
    scale: tuple[str, ...] = ()
    pay_type: tuple[str, ...] = ()
    part_time: tuple[str, ...] = ()
    stage: tuple[str, ...] = ()
    page: int = 1
    page_size: int = 15

    def is_blank(self) -> bool:
        """检索维度是否全空（空 = 站点默认全量，抓取前应拦）。"""
        return not any([
            self.keyword.strip(), self.city, self.job_type, self.salary,
            self.experience, self.degree, self.industry, self.scale,
            self.pay_type, self.part_time, self.stage,
        ])


@dataclass(frozen=True)
class JobRef:
    """职位引用：跨站点唯一定位 = (site_id, job_id)；站点私有键进 `extra`。"""

    site_id: str
    job_id: str
    extra: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PageResult:
    """一页职位结果（核心层只看形状，item 是站点私有职位对象）。"""

    items: tuple[Any, ...] = ()
    page: int = 1
    has_more: bool = False


@dataclass(frozen=True)
class SessionRef:
    """发对话会话引用（BOSS：friend/add 建起来的会话）。"""

    site_id: str
    session_id: str
    extra: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SendReceipt:
    """发对话回执：只表示「话发出去了」。"""

    ok: bool
    message: str = ""


@dataclass(frozen=True)
class ResumeRef:
    """投递用简历引用：能走站内简历就用站内简历 ID（`site_resume_id`）。"""

    site_resume_id: str
    extra: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ApplyReceipt:
    """投递回执。"""

    ok: bool
    message: str = ""


@dataclass(frozen=True)
class LoginState:
    """登录状态轮询结果（poll 的返回）。

    Attributes:
        status: `running` / `need_code` / `need_slider` / `need_scan` / `done` / `error`。
    """

    status: str
    message: str = ""
    payload: Mapping[str, Any] = field(default_factory=dict)


LoginHandle = str


@dataclass(frozen=True)
class NavExtra:
    """平台私有入口（BOSS 求职期望流），注册进 `/:siteId/:route`。"""

    key: str
    label: str
    route: str


SiteFilterOptions = Mapping[str, Any]

SearchParams = Mapping[str, Any]
