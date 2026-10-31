"""站点适配器包：装配点——`load()` 让平台包完成自身注册。

新增站点 = 平台包里加一个 `@register` 适配器，这里按包导入即可。
"""

from __future__ import annotations

from boss_platform_base.registry import register


def load() -> None:
    """幂等装配：导入平台包并登记 BOSS 适配器（注册表被清后也能重装）。"""
    from boss_platform_boss.adapter import SITE_ID, BossAdapter

    register(SITE_ID)(BossAdapter)


__all__ = ["load"]
