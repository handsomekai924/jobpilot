"""`jobpilot_core` — 多平台契约与能力协议。

约定：本包零外部依赖，且不 import 任何其他 `boss_*` 包。
"""

from __future__ import annotations

from .contracts import (
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
from .errors import BossError
from .paths import default_data_dir, repo_root
from .protocols import (
    Applier,
    AuthFlow,
    AuthSink,
    Catalog,
    JobSource,
    Messenger,
    SiteAdapter,
)

__all__ = [
    "Applier",
    "ApplyGate",
    "ApplyReceipt",
    "AuthCaps",
    "AuthFlow",
    "AuthSink",
    "BossError",
    "Catalog",
    "ConversationState",
    "DeliveryCaps",
    "DeliverFault",
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
    "SourceCaps",
    "default_data_dir",
    "repo_root",
]
