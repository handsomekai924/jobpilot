"""运行环境探测：开发模式与打包成 exe 两种形态的路径差异收在一处。

只依赖标准库；环境变量名延迟导入，免得拖进 `jobpilot_browser_pool.cdp` 整条依赖链。
打包形态必须先调 `bootstrap` 再碰 store / Chrome。明细见 `notes/jobpilot_server/runtime.md`。

Attributes:
    DATA_DIR_NAME: 数据目录名。
    APP_DIR_NAME: 退回用户目录时用的子目录名。
    LEGACY_APP_DIR_NAME: 旧版本在用户目录下的子目录名，仅用于迁移识别。
    APP_DATA_ENV: 覆盖数据目录的环境变量名。
"""

from __future__ import annotations

import logging
import os
import sys
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR_NAME = "data"

APP_DIR_NAME = "JobPilot"

LEGACY_APP_DIR_NAME = "BossAutoDelivery"

APP_DATA_ENV = "JOBPILOT_APP_DATA"


def is_frozen() -> bool:
    """是不是 PyInstaller 打出来的可执行文件。"""
    return bool(getattr(sys, "frozen", False))


def force_utf8_streams() -> None:
    """把 stdout/stderr 切成 UTF-8；必须在第一次 `print` 之前调用。"""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:  # pragma: no branch
            reconfigure(encoding="utf-8", errors="replace")


def resource_root() -> Path:
    """只读资源的根目录：开发态为仓库根，打包态为 `sys._MEIPASS`。"""
    if is_frozen():
        meipass = getattr(sys, "_MEIPASS", None)
        return Path(meipass) if meipass else Path(sys.executable).resolve().parent
    from jobpilot_core.paths import repo_root

    return repo_root()


def executable_dir() -> Path:
    """exe 所在目录；开发态退回仓库根。"""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return resource_root()


def app_data_dir() -> Path:
    """期望的数据目录：打包态为 exe 同目录下的 `data/`，开发态为仓库 `data/`。

    只算路径、不建目录、不保证可写；真正落地用 `ensure_writable`。
    """
    env = os.environ.get(APP_DATA_ENV, "").strip()
    if env:
        return Path(env)
    return executable_dir() / DATA_DIR_NAME


def _user_app_dir(name: str = APP_DIR_NAME) -> Path:
    """用户目录下的应用文件夹：Windows 用 `%LOCALAPPDATA%`，其他平台用家目录点目录。"""
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        root = Path(base) if base else Path.home() / "AppData" / "Local"
        return root / name
    return Path.home() / f".{name.lower()}"


def fallback_data_dir() -> Path:
    """exe 同目录写不了时的备选；新目录还没建、旧目录已有数据时沿用旧目录。"""
    current = _user_app_dir() / DATA_DIR_NAME
    if current.is_dir():
        return current
    legacy = _user_app_dir(LEGACY_APP_DIR_NAME) / DATA_DIR_NAME
    if legacy.is_dir():
        logger.info("新用户目录还没建，沿用旧版数据目录：%s", legacy)
        return legacy
    return current


def temp_data_dir() -> Path:
    """最后的兜底：临时目录。能跑，但退出后不保证还在。"""
    return Path(tempfile.gettempdir()) / APP_DIR_NAME / DATA_DIR_NAME


def is_writable(folder: Path) -> bool:
    """真写一个探针文件再删掉；比 `os.access` 可靠。"""
    try:
        folder.mkdir(parents=True, exist_ok=True)
        probe = folder / ".write_test"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def ensure_writable(folder: Path) -> Path:
    """`folder` 可写就用它，否则依次退到用户目录、临时目录；都写不了时抛 `RuntimeError`。"""
    for candidate in (folder, fallback_data_dir(), temp_data_dir()):
        if is_writable(candidate):
            return candidate
    raise RuntimeError(f"找不到可写的数据目录，试过：{folder}")


def is_temp_run() -> bool:
    """exe 是不是在临时目录里跑（多半是直接从压缩包预览双击）。"""
    if not is_frozen():
        return False
    try:
        exe_dir = executable_dir()
        temp = Path(tempfile.gettempdir()).resolve()
        return exe_dir == temp or temp in exe_dir.parents
    except OSError:  # pragma: no cover - 路径解析失败不该拦住启动
        return False


def _env_names() -> tuple[str, str]:
    """`(库路径环境变量, Chrome profile 环境变量)`，延迟导入取自各包常量。"""
    from jobpilot_browser_pool.cdp import CHROME_PROFILE_ENV
    from jobpilot_db import DB_ENV

    return DB_ENV, CHROME_PROFILE_ENV


def _migrate_database(data: Path) -> dict[str, str]:
    """把旧 `boss.db` 一次性迁到 `data/jobpilot.db`，返回可打日志的摘要。"""
    from jobpilot_db.legacy import migrate_legacy_database

    result = migrate_legacy_database(data / "jobpilot.db")
    info = {"db_migrated": "1" if result.migrated else "0", "db_migration": result.reason}
    if result.migrated:
        info["db_migrated_from"] = str(result.source)
        info["db_migrated_rows"] = str(result.rows)
    return info


def _chrome_profile_path(data: Path) -> Path:
    """Chrome profile 目录；新版目录没有而旧版用户目录有，就直接复用旧目录。"""
    current = data / "chrome_profile"
    if current.is_dir():
        return current
    legacy = _user_app_dir(LEGACY_APP_DIR_NAME) / DATA_DIR_NAME / "chrome_profile"
    if legacy.is_dir():
        logger.info("复用旧版 Chrome profile：%s", legacy)
        return legacy
    return current


def bootstrap(*, force: bool = False) -> dict[str, str]:
    """把数据目录钉进环境变量；返回一份可打日志 / 可给界面看的摘要。

    开发态什么都不设，除非显式 `force=True` 或设了 `APP_DATA_ENV`；
    打包态一律设为 `<exe 同目录>/data/`，写不进去就退到用户目录。
    用 `setdefault`：用户（或测试）显式设过的环境变量优先。
    钉住数据目录时才迁移旧 `boss.db`；开发态交由 `resolve_db_path()` 按需触发。
    """
    from jobpilot_core.paths import apply_legacy_env

    apply_legacy_env()
    expected = app_data_dir()
    info: dict[str, str] = {
        "frozen": "1" if is_frozen() else "0",
        "expected_data_dir": str(expected),
    }

    if not (is_frozen() or force or os.environ.get(APP_DATA_ENV, "").strip()):
        info["data_dir"] = str(expected)
        return info

    data = ensure_writable(expected)
    db_env, profile_env = _env_names()
    info.update(_migrate_database(data))
    os.environ.setdefault(db_env, str(data / "jobpilot.db"))
    os.environ.setdefault(profile_env, str(_chrome_profile_path(data)))
    (data / "logs").mkdir(parents=True, exist_ok=True)

    info.update(
        {
            "data_dir": str(data),
            "db": os.environ[db_env],
            "chrome_profile": os.environ[profile_env],
            "portable": "1" if data == expected else "0",
        }
    )
    if is_temp_run():
        info["warning"] = "temp_run"
    return info


def log_dir() -> Path:
    """日志目录（`data/logs`）；顺手建出来。"""
    folder = app_data_dir() / "logs"
    try:
        folder.mkdir(parents=True, exist_ok=True)
    except OSError:  # pragma: no cover - 日志目录建不出来不该拦住启动
        return temp_data_dir() / "logs"
    return folder
