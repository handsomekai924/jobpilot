"""`jobpilot_server` — BOSS 直聘控制台的后端 API 服务。

把登录 / 抓取 / 筛选 / LLM / 简历分析收进一套 HTTP 接口，能力层全部复用
`jobpilot_platform_boss.auth` / `jobpilot_platform_boss.jobs` / `jobpilot_platform_boss.catalog`，本包只做编排与展示。

启动：

    python -m jobpilot_server            # API http://127.0.0.1:8787，文档 /api/docs
"""

from __future__ import annotations

from typing import TYPE_CHECKING

__version__ = "2.0.0"

if TYPE_CHECKING:  # pragma: no cover - 只给类型检查器看
    from .app import create_app

__all__ = ["create_app", "__version__"]


def __getattr__(name: str):
    """惰性导出 `create_app`，避免导入期拉起 `jobpilot_platform_boss.jobs` 依赖链。"""
    if name == "create_app":
        from .app import create_app as factory

        return factory
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
