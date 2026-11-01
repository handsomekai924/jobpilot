"""过渡壳：注册表已迁到 `jobpilot_platform_base.registry`，Phase 9 删除。"""

from __future__ import annotations

from jobpilot_platform_base.registry import (
    all_adapters,
    build_descriptor,
    get_adapter,
    register,
    registered_sites,
    reset_registry,
    set_loader,
)

__all__ = [
    "all_adapters",
    "build_descriptor",
    "get_adapter",
    "register",
    "registered_sites",
    "reset_registry",
    "set_loader",
]
