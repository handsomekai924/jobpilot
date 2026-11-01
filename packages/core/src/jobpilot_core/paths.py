"""仓库根与数据目录的调用期解析。

打包后源码位于 `_MEIPASS` 或 `packages/*/src`，不能再靠 `Path(__file__).parent.parent`
猜仓库根，所以这里统一按「显式环境变量 → 冻结态 → 向上找工程标记」解析。

Attributes:
    APP_ROOT_ENV: 显式覆盖仓库根的环境变量。
    APP_DATA_ENV: 显式覆盖数据目录的环境变量（与 server 的 runtime 保持一致）。
    LEGACY_ENV_ALIASES: 旧品牌环境变量到新名的映射，仅供一次性迁移读取。
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

APP_ROOT_ENV = "JOBPILOT_APP_ROOT"

APP_DATA_ENV = "JOBPILOT_APP_DATA"

LEGACY_ENV_ALIASES: dict[str, str] = {
    "JOBPILOT_APP_ROOT": "BOSS_APP_ROOT",
    "JOBPILOT_APP_DATA": "BOSS_APP_DATA",
    "JOBPILOT_DB": "BOSS_DB",
    "JOBPILOT_CDP_PORT": "BOSS_CDP_PORT",
    "JOBPILOT_CDP_KEEP": "BOSS_CDP_KEEP",
    "JOBPILOT_CDP_CLOSE_ON_EXIT": "BOSS_CDP_CLOSE_ON_EXIT",
    "JOBPILOT_CHROME_BIN": "BOSS_CHROME_BIN",
    "JOBPILOT_CHROME_PROFILE": "BOSS_CHROME_PROFILE",
    "JOBPILOT_CHROME_MODE": "BOSS_CHROME_MODE",
    "JOBPILOT_NODE_BIN": "BOSS_NODE_BIN",
    "JOBPILOT_ZP_STOKEN": "BOSS_ZP_STOKEN",
    "JOBPILOT_STOKEN_STORE": "BOSS_STOKEN_STORE",
    "JOBPILOT_SEARCH_FILTER": "BOSS_SEARCH_FILTER",
}

_DATA_DIR_NAME = "data"

_warned_legacy: set[str] = set()


def apply_legacy_env() -> tuple[str, ...]:
    """把旧 `BOSS_*` 环境变量复制到对应的 `JOBPILOT_*`。

    新变量已设置时以新变量为准；每个旧变量只提示一次。

    Returns:
        本次实际复制到新名的变量名。
    """
    applied: list[str] = []
    for new, old in LEGACY_ENV_ALIASES.items():
        value = os.environ.get(old, "").strip()
        if not value or os.environ.get(new, "").strip():
            continue
        os.environ[new] = value
        applied.append(new)
        if old not in _warned_legacy:
            _warned_legacy.add(old)
            logger.warning("环境变量 %s 已改名，请改用 %s（本次已自动兼容）", old, new)
    return tuple(applied)


def _is_frozen() -> bool:
    """是不是 PyInstaller 冻结态。"""
    return bool(getattr(sys, "frozen", False))


def repo_root() -> Path:
    """仓库根目录。

    Returns:
        显式环境变量优先；冻结态回 `_MEIPASS`；开发态向上找同时含
        `pyproject.toml` 与 `apps/web/` 的工程根。
    """
    apply_legacy_env()
    env = os.environ.get(APP_ROOT_ENV, "").strip()
    if env:
        return Path(env).expanduser().resolve()
    if _is_frozen():
        meipass = getattr(sys, "_MEIPASS", None)
        return Path(meipass) if meipass else Path(sys.executable).resolve().parent
    here = Path(__file__).resolve()
    for parent in (here, *here.parents):
        if (parent / "pyproject.toml").is_file() and (parent / "apps" / "web").is_dir():
            return parent
    return Path.cwd().resolve()


def default_data_dir() -> Path:
    """默认数据目录：开发态在仓库根 `data/`，冻结态在 exe 同目录 `data/`。"""
    apply_legacy_env()
    env = os.environ.get(APP_DATA_ENV, "").strip()
    if env:
        return Path(env).expanduser()
    if _is_frozen():
        return Path(sys.executable).resolve().parent / _DATA_DIR_NAME
    return repo_root() / _DATA_DIR_NAME
