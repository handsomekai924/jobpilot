"""旧版 `boss.db` 迁移的单元测试。"""

from __future__ import annotations

import sqlite3

from jobpilot_db.legacy import (
    LEGACY_DB_NAME,
    find_legacy_database,
    migrate_legacy_database,
)


def _make_database(path, *, rows: int = 3, wal: bool = False) -> sqlite3.Connection | None:
    """造一份带 `doc` / `job` 两张表的旧库；`wal=True` 时保持连接打开以便读到 WAL。"""
    conn = sqlite3.connect(path)
    if wal:
        conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("CREATE TABLE doc (key TEXT PRIMARY KEY, value TEXT)")
    conn.execute("CREATE TABLE job (id INTEGER PRIMARY KEY)")
    conn.executemany("INSERT INTO doc VALUES (?, ?)", [(f"k{i}", "v") for i in range(rows)])
    conn.executemany("INSERT INTO job VALUES (?)", [(i,) for i in range(rows)])
    conn.commit()
    if wal:
        return conn
    conn.close()
    return None


def _counts(path) -> tuple[int, int]:
    """返回 `(doc 行数, job 行数)`，同时校验完整性。"""
    with sqlite3.connect(path) as conn:
        assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        doc = conn.execute("SELECT COUNT(*) FROM doc").fetchone()[0]
        job = conn.execute("SELECT COUNT(*) FROM job").fetchone()[0]
    return doc, job


def test_迁移_把含wal的旧库完整复制(tmp_path):
    """WAL 里尚未 checkpoint 的行也要迁过去，旧文件原样保留。"""
    source = tmp_path / LEGACY_DB_NAME
    holder = _make_database(source, rows=4, wal=True)
    try:
        assert (tmp_path / f"{LEGACY_DB_NAME}-wal").exists(), "前置条件：WAL 文件在位"
        target = tmp_path / "jobpilot.db"
        result = migrate_legacy_database(target, sources=[source])
    finally:
        if holder is not None:
            holder.close()

    assert result.migrated is True
    assert result.reason == "migrated"
    assert result.source == source
    assert result.rows == 8
    assert source.is_file(), "旧库必须保留，方便回滚"
    assert _counts(target) == (4, 4)


def test_目标已存在时不重复迁移(tmp_path):
    """新库已经能用就跳过，不能拿旧库覆盖用户现有数据。"""
    target = tmp_path / "jobpilot.db"
    _make_database(target, rows=2)
    source = tmp_path / LEGACY_DB_NAME
    _make_database(source, rows=9)

    result = migrate_legacy_database(target, sources=[source])

    assert result.migrated is False
    assert result.reason == "target_exists"
    assert _counts(target) == (2, 2)


def test_没有旧库时跳过(tmp_path, monkeypatch):
    """找不到任何旧库时安静返回，不建目标文件。"""
    monkeypatch.delenv("BOSS_DB", raising=False)
    monkeypatch.delenv("BOSS_APP_DATA", raising=False)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "empty"))

    target = tmp_path / "jobpilot.db"
    result = migrate_legacy_database(target)

    assert result.migrated is False
    assert result.reason == "no_source"
    assert not target.exists()


def test_旧库损坏时不阻塞启动(tmp_path):
    """旧库不是合法 SQLite 时只记 warning，不抛异常、不留半成品。"""
    source = tmp_path / LEGACY_DB_NAME
    source.write_bytes(b"this is not a database")
    target = tmp_path / "jobpilot.db"

    result = migrate_legacy_database(target, sources=[source])

    assert result.migrated is False
    assert result.reason == "error"
    assert not target.exists()
    assert not list(tmp_path.glob("*.tmp")), "临时文件要清干净"


def test_有别的进程在迁移时返回locked(tmp_path):
    """锁文件存在时让出，避免两个进程同时写目标库。"""
    source = tmp_path / LEGACY_DB_NAME
    _make_database(source, rows=1)
    target = tmp_path / "jobpilot.db"
    lock = target.with_name(f".{target.name}.migrate.lock")
    lock.write_text("busy", encoding="utf-8")

    result = migrate_legacy_database(target, sources=[source])

    assert result.reason == "locked"
    assert not target.exists()


def test_find_legacy_database_优先认旧环境变量(tmp_path, monkeypatch):
    """旧 `BOSS_DB` 指到哪，就迁哪份。"""
    custom = tmp_path / "custom" / "old.db"
    custom.parent.mkdir()
    _make_database(custom, rows=1)
    monkeypatch.setenv("BOSS_DB", str(custom))

    assert find_legacy_database(tmp_path / "data" / "jobpilot.db") == custom


def test_find_legacy_database_认目标同目录的boss_db(tmp_path, monkeypatch):
    """最常见的情况：旧库就躺在同一数据目录里。"""
    monkeypatch.delenv("BOSS_DB", raising=False)
    monkeypatch.delenv("BOSS_APP_DATA", raising=False)
    data = tmp_path / "data"
    data.mkdir()
    legacy = data / LEGACY_DB_NAME
    _make_database(legacy, rows=1)

    assert find_legacy_database(data / "jobpilot.db") == legacy


def test_find_legacy_database_忽略空文件(tmp_path, monkeypatch):
    """零字节的 `boss.db` 不当作可迁移来源。"""
    monkeypatch.delenv("BOSS_DB", raising=False)
    monkeypatch.delenv("BOSS_APP_DATA", raising=False)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "empty"))
    data = tmp_path / "data"
    data.mkdir()
    (data / LEGACY_DB_NAME).touch()

    assert find_legacy_database(data / "jobpilot.db") is None
