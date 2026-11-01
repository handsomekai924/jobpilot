"""旧品牌环境变量兼容层的单元测试。"""

from __future__ import annotations

import os

from jobpilot_core.paths import apply_legacy_env, default_data_dir


def _use_env(monkeypatch, values: dict[str, str]) -> dict[str, str]:
    """把进程环境换成一份隔离副本，返回它供断言。"""
    env = dict(values)
    monkeypatch.setattr(os, "environ", env)
    return env


def test_旧变量复制到新名(monkeypatch):
    """老用户只设了 `BOSS_*` 时仍能定位到同一路径。"""
    env = _use_env(monkeypatch, {"BOSS_DB": "D:/old/boss.db", "BOSS_ZP_STOKEN": "tok"})

    applied = apply_legacy_env()

    assert env["JOBPILOT_DB"] == "D:/old/boss.db"
    assert env["JOBPILOT_ZP_STOKEN"] == "tok"
    assert "JOBPILOT_DB" in applied
    assert "JOBPILOT_ZP_STOKEN" in applied


def test_新变量优先_旧变量不覆盖(monkeypatch):
    """新旧同时存在时以新名为准。"""
    env = _use_env(monkeypatch, {"BOSS_DB": "old.db", "JOBPILOT_DB": "new.db"})

    applied = apply_legacy_env()

    assert env["JOBPILOT_DB"] == "new.db"
    assert "JOBPILOT_DB" not in applied


def test_空值旧变量忽略(monkeypatch):
    """空字符串不算设置，不复制也不返回。"""
    env = _use_env(monkeypatch, {"BOSS_DB": "   "})

    applied = apply_legacy_env()

    assert "JOBPILOT_DB" not in env
    assert "JOBPILOT_DB" not in applied


def test_default_data_dir认显式环境变量(monkeypatch, tmp_path):
    """`JOBPILOT_APP_DATA` 优先于仓库 / exe 推断。"""
    target = tmp_path / "custom"
    _use_env(monkeypatch, {"JOBPILOT_APP_DATA": str(target)})

    assert default_data_dir() == target
