"""过渡壳：已迁到 `boss_platform_boss.auth.verify`。"""

from __future__ import annotations

from boss_platform_boss.auth import verify as _target
from boss_platform_boss.auth.verify import *  # noqa: F401,F403


def __getattr__(name: str):
    """私有名也照旧可取。"""
    return getattr(_target, name)
