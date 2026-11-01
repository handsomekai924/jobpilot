"""多平台核心：契约 + 能力协议 + 注册表。

server 编排层只认这里的 Protocol/registry，站点实现在 `adapters/`。
"""

from __future__ import annotations

from jobpilot_core.contracts import (
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
from .flow import (
    CrawlHooks,
    CrawlReport,
    DeliverHooks,
    DeliverReport,
    DeliverTarget,
    GateOutcome,
    run_crawl,
    run_deliver,
)
from .limits import (
    BREAKER_TRIP,
    Breaker,
    FaultAction,
    SiteLimits,
    fault_action,
    throttle_hook,
)
from jobpilot_core.protocols import (
    Applier,
    AuthFlow,
    AuthSink,
    Catalog,
    JobSource,
    Messenger,
    SiteAdapter,
)
from .registry import (
    all_adapters,
    build_descriptor,
    get_adapter,
    register,
    registered_sites,
    reset_registry,
    set_loader,
)

__all__ = [
    "Applier",
    "ApplyGate",
    "ApplyReceipt",
    "AuthCaps",
    "AuthFlow",
    "AuthSink",
    "BREAKER_TRIP",
    "Breaker",
    "Catalog",
    "ConversationState",
    "CrawlHooks",
    "CrawlReport",
    "DeliveryCaps",
    "DeliverFault",
    "DeliverHooks",
    "DeliverReport",
    "DeliverTarget",
    "FaultAction",
    "GateOutcome",
    "JobRef",
    "JobSource",
    "LoginHandle",
    "LoginState",
    "Messenger",
    "NavExtra",
    "PageResult",
    "ResumeRef",
    "SearchCriteria",
    "SearchParams",
    "SendReceipt",
    "SessionRef",
    "SiteAdapter",
    "SiteFilterOptions",
    "SiteLimits",
    "SourceCaps",
    "all_adapters",
    "build_descriptor",
    "fault_action",
    "get_adapter",
    "register",
    "registered_sites",
    "reset_registry",
    "run_crawl",
    "run_deliver",
    "set_loader",
    "throttle_hook",
]

from .adapters import load as _load_adapters  # noqa: E402

set_loader(_load_adapters)
