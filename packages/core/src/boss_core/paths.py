"""仓库根与数据目录的调用期解析。

打包后源码位于 `_MEIPASS` 或 `packages/*/src`，不能再靠 `Path(__file__).parent.parent`
猜仓库根，所以这里统一按「显式环境变量 → 冻结态 → 向上找工程标记」解析。

Attributes:
    APP_ROOT_ENV: 显式覆盖仓库根的环境变量。
    APP_DATA_ENV: 显式覆盖数据目录的环境变量（与 server 的 runtime 保持一致）。
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

APP_ROOT_ENV = "BOSS_APP_ROOT"

APP_DATA_ENV = "BOSS_APP_DATA"

_DATA_DIR_NAME = "data"


def _is_frozen() -> bool:
    """是不是 PyInstaller 冻结态。"""
    return bool(getattr(sys, "frozen", False))


def repo_root() -> Path:
    """仓库根目录。

    Returns:
        显式环境变量优先；冻结态回 `_MEIPASS`；开发态向上找同时含
        `pyproject.toml` 与 `apps/web/` 的工程根。
    """
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
    env = os.environ.get(APP_DATA_ENV, "").strip()
    if env:
        return Path(env).expanduser()
    if _is_frozen():
        return Path(sys.executable).resolve().parent / _DATA_DIR_NAME
    return repo_root() / _DATA_DIR_NAME
