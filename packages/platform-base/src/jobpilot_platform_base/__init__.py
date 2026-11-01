"""`jobpilot_platform_base` — 站点适配器基座与注册表。"""

from __future__ import annotations

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
    "all_adapters",
    "build_descriptor",
    "get_adapter",
    "register",
    "registered_sites",
    "reset_registry",
    "set_loader",
]
