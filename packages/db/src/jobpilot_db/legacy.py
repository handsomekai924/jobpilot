"""旧版 `boss.db` 到 `jobpilot.db` 的一次性迁移。

改名后默认库文件名从 `boss.db` 换成 `jobpilot.db`；老用户的登录态、简历、
职位与配置都在旧库里，首次启动时用 SQLite backup API 复制一份，旧文件原样
保留，方便回滚到旧版本。

Attributes:
    LEGACY_DB_NAME: 旧版状态库文件名。
    LEGACY_APP_DIR_NAME: 旧版在用户目录下的数据文件夹名。
"""

from __future__ import annotations

import logging
import os
import sqlite3
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Iterable
from urllib.parse import quote

logger = logging.getLogger(__name__)

LEGACY_DB_NAME: Final[str] = "boss.db"

LEGACY_APP_DIR_NAME: Final[str] = "BossAutoDelivery"

_LOCK_STALE_SECONDS: Final[float] = 600.0

_lock = threading.Lock()

_checked: set[str] = set()


@dataclass(frozen=True)
class MigrationResult:
    """一次迁移尝试的结果。

    Attributes:
        migrated: 是否真的复制过。
        source: 来源库；没找到来源时为 `None`。
        target: 目标库路径。
        reason: `migrated` / `target_exists` / `no_source` / `locked` / `error`。
        rows: 目标库各表行数之和；未迁移时为 0。
    """

    migrated: bool
    source: Path | None
    target: Path
    reason: str
    rows: int = 0


def find_legacy_database(target: Path) -> Path | None:
    """按优先级找旧版状态库。

    顺序：旧 `BOSS_DB` 环境变量 → 目标同目录 `boss.db` → 旧 `BOSS_APP_DATA`
    目录 → 用户目录下旧安装的 `data/boss.db`。

    Args:
        target: 新状态库路径，用来推断同目录位置。

    Returns:
        第一个存在且非空的旧库；都没有则 `None`。
    """
    candidates: list[Path] = []
    legacy_db_env = os.environ.get("BOSS_DB", "").strip()
    if legacy_db_env and legacy_db_env != ":memory:":
        candidates.append(Path(legacy_db_env))
    candidates.append(target.parent / LEGACY_DB_NAME)
    legacy_data_env = os.environ.get("BOSS_APP_DATA", "").strip()
    if legacy_data_env:
        candidates.append(Path(legacy_data_env) / LEGACY_DB_NAME)
    candidates.append(_legacy_fallback_db())

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)
        try:
            if candidate.is_file() and candidate.stat().st_size > 0:
                return candidate
        except OSError:
            continue
    return None


def migrate_legacy_database(
    target: Path, *, sources: Iterable[Path] | None = None
) -> MigrationResult:
    """把旧库完整复制到新路径；幂等，失败不抛异常。

    Args:
        target: 新状态库路径，如 `data/jobpilot.db`。
        sources: 显式来源候选；省略时委托 `find_legacy_database`。

    Returns:
        迁移结果；`reason` 说明是复制成功、目标已存在、无来源还是失败。
    """
    target = Path(target)
    key = str(target)
    with _lock:
        if key in _checked:
            reason = "target_exists" if _is_usable(target) else "no_source"
            return MigrationResult(False, None, target, reason)
        _checked.add(key)

    if _is_usable(target):
        return MigrationResult(False, None, target, "target_exists")

    source = _pick_source(sources) or find_legacy_database(target)
    if source is None:
        return MigrationResult(False, None, target, "no_source")

    lock_path = target.with_name(f".{target.name}.migrate.lock")
    if not _acquire_lock(lock_path):
        return MigrationResult(False, source, target, "locked")

    tmp = target.with_name(f"{target.name}.{os.getpid()}.tmp")
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        rows = _copy_database(source, tmp)
        os.replace(tmp, target)
    except (OSError, sqlite3.Error) as exc:
        tmp.unlink(missing_ok=True)
        logger.warning("旧状态库迁移失败，继续使用新库：%s", exc)
        return MigrationResult(False, source, target, "error")
    finally:
        lock_path.unlink(missing_ok=True)

    logger.info("已把旧状态库 %s 迁移到 %s（%d 行），旧文件保留", source, target, rows)
    return MigrationResult(True, source, target, "migrated", rows)


def _legacy_fallback_db() -> Path:
    """旧版装在不可写目录时用的用户目录库路径。"""
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        root = Path(base) if base else Path.home() / "AppData" / "Local"
        return root / LEGACY_APP_DIR_NAME / "data" / LEGACY_DB_NAME
    return Path.home() / f".{LEGACY_APP_DIR_NAME.lower()}" / "data" / LEGACY_DB_NAME


def _is_usable(path: Path) -> bool:
    """目标文件是否存在且非空。"""
    try:
        return path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


def _pick_source(sources: Iterable[Path] | None) -> Path | None:
    """从显式候选里挑第一个可用文件。"""
    for candidate in sources or ():
        path = Path(candidate)
        if _is_usable(path):
            return path
    return None


def _acquire_lock(lock_path: Path) -> bool:
    """建独占锁文件；超过 10 分钟的陈旧锁直接清掉重试一次。"""
    for attempt in range(2):
        try:
            fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            try:
                age = os.path.getmtime(lock_path)
            except OSError:
                age = 0.0

            if attempt == 0 and time.time() - age > _LOCK_STALE_SECONDS:
                lock_path.unlink(missing_ok=True)
                continue
            return False
        except OSError as exc:
            logger.warning("迁移锁创建失败，跳过迁移：%s", exc)
            return False
        os.close(fd)
        return True
    return False


def _copy_database(source: Path, tmp: Path) -> int:
    """用 backup API 复制整库并校验完整性，返回行数总和。"""
    uri = "file:" + quote(str(source.resolve()).replace("\\", "/"), safe="/:") + "?mode=ro"
    src = sqlite3.connect(uri, uri=True)
    dst = sqlite3.connect(tmp)
    try:
        src.backup(dst)
        check = dst.execute("PRAGMA integrity_check").fetchone()
        if not check or check[0] != "ok":
            raise sqlite3.DatabaseError(f"完整性校验失败：{check}")
        return _count_rows(dst)
    finally:
        src.close()
        dst.close()


def _count_rows(conn: sqlite3.Connection) -> int:
    """统计所有业务表的行数之和。"""
    names = [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
    ]
    total = 0
    for name in names:
        quoted = '"' + name.replace('"', '""') + '"'
        total += conn.execute(f"SELECT COUNT(*) FROM {quoted}").fetchone()[0]
    return total
