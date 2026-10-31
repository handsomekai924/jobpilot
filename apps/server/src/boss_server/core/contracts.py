"""过渡壳：契约已迁到 `boss_core.contracts`，Phase 9 删除。"""

from __future__ import annotations

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

__all__ = [
    "ApplyGate",
    "ApplyReceipt",
    "AuthCaps",
    "ConversationState",
    "DeliveryCaps",
    "DeliverFault",
    "JobRef",
    "LoginHandle",
    "LoginState",
    "NavExtra",
    "PageResult",
    "ResumeRef",
    "SearchCriteria",
    "SearchParams",
    "SendReceipt",
    "SessionRef",
    "SiteFilterOptions",
    "SourceCaps",
]
