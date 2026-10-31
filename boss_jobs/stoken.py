"""过渡壳：已迁到 `boss_platform_boss.stoken`。"""

from __future__ import annotations

from boss_platform_boss import stoken as _target
from boss_platform_boss.stoken import *  # noqa: F401,F403
from boss_platform_boss.stoken import __all__  # noqa: F401


def __getattr__(name: str):
    """未在 `__all__` 里的常量/私有名也照旧可取。"""
    return getattr(_target, name)
