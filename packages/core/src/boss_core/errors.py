"""`boss_*` 各包共用的错误基类。"""

from __future__ import annotations


class BossError(Exception):
    """所有 `boss_*` 包的通用错误基类。"""
