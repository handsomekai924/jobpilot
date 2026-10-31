"""过渡壳：已迁到 `boss_platform_boss.adapter`。"""

from __future__ import annotations

from boss_platform_boss import adapter as _target
from boss_platform_boss.adapter import BossAdapter  # noqa: F401


def __getattr__(name: str):
    """私有名也照旧可取。"""
    return getattr(_target, name)
