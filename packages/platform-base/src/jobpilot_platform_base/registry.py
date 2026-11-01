"""站点适配器注册表（工厂 + 注册表）。

新增站点只加一个 adapter 包、server 装配点多一行 import；`get_adapter(site_id)` 是唯一的取用口。
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Mapping

from jobpilot_core.contracts import NavExtra
from jobpilot_core.protocols import SiteAdapter

logger = logging.getLogger(__name__)

_REGISTRY: dict[str, SiteAdapter] = {}

_LOADER: Callable[[], None] | None = None


def set_loader(loader: Callable[[], None]) -> None:
    """注册站点装配函数；由 server 启动时调用，import 各平台包触发 `@register`。

    Args:
        loader: 幂等装配函数。
    """
    global _LOADER
    _LOADER = loader


def _ensure_loaded() -> None:
    """执行已注册的装配函数（懒做，避免 import 期碰登录态）。"""
    if _LOADER is not None:
        _LOADER()


def register(site_id: str):
    """把适配器类挂进注册表的类装饰器；`site_id` 重复注册时抛 `ValueError`。

    Args:
        site_id: 站点标识（`"boss"` / `"51job"` / …），路由与数据行都用它。

    Returns:
        装饰器：原样返回类，顺手实例化并注册。
    """

    def deco(cls: type) -> type:
        """实例化适配器并登记到注册表。"""
        existing = _REGISTRY.get(site_id)
        if existing is not None and type(existing) is not cls:
            raise ValueError(f"站点已注册：{site_id}")
        adapter = cls()
        _REGISTRY[site_id] = adapter
        logger.info("注册站点适配器：%s (%s)", site_id, cls.__name__)
        return cls

    return deco


def get_adapter(site_id: str) -> SiteAdapter:
    """按站点取适配器；没这个站点时抛 `KeyError`。

    Args:
        site_id: 站点标识。

    Returns:
        站点适配器。
    """
    _ensure_loaded()
    adapter = _REGISTRY.get(site_id)
    if adapter is None:
        raise KeyError(f"未注册的站点：{site_id}")
    return adapter


def registered_sites() -> tuple[str, ...]:
    """已注册站点 id，按注册顺序。"""
    _ensure_loaded()
    return tuple(_REGISTRY)


def all_adapters() -> tuple[SiteAdapter, ...]:
    """全部适配器，按注册顺序。"""
    _ensure_loaded()
    return tuple(_REGISTRY.values())


def build_descriptor(
    adapter: SiteAdapter, session: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    """把适配器的自述拼成 `GET /api/platforms` 的一条描述符。

    能力降级、切换器、侧边栏全部吃这一个形状，前端不许写死平台清单。

    Args:
        adapter: 站点适配器。
        session: 会话摘要（`logged_in` / `phone_masked` / `busy`）；不传则调
            `adapter.session_summary()`。

    Returns:
        描述符 dict。
    """
    auth = adapter.auth.caps()
    source = adapter.jobs.caps()
    delivery = adapter.applier.caps()
    extras: tuple[NavExtra, ...] = adapter.nav_extras()
    summary = dict(session if session is not None else adapter.session_summary())
    return {
        "site_id": adapter.site_id,
        "display_name": adapter.display_name,
        "icon": adapter.icon,
        "caps": {
            "auth": {
                "sms": auth.supports_sms,
                "slider": auth.supports_slider,
                "qr": auth.supports_qr,
            },
            "source": {
                "expect_flow": source.has_expect_flow,
                "tags": source.has_tags,
                "skills": source.has_skills,
            },
            "catalog": {"unsupported": list(adapter.catalog.unsupported())},
            "delivery": {
                "apply_gate": delivery.apply_gate.value,
                "apply_channel": delivery.apply_channel,
            },
        },
        "session": {
            "logged_in": bool(summary.get("logged_in")),
            "phone_masked": str(summary.get("phone_masked") or ""),
            "busy": bool(summary.get("busy")),
        },
        "nav_extras": [
            {"key": n.key, "label": n.label, "route": n.route} for n in extras
        ],
    }


def reset_registry() -> None:
    """清空注册表（测试隔离用）。"""
    _REGISTRY.clear()
