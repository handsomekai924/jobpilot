"""登录态持久化，落进状态库 `data/jobpilot.db` 的 `doc('session')` 行。

按仓库根定位状态库，与当前工作目录无关。

Attributes:
    SITE_ID: 登录态归属的站点 id。
    PROJECT_ROOT: 项目根目录（`jobpilot_core.paths.repo_root()`）。
    DEFAULT_DB_PATH: 状态库路径，环境变量 `JOBPILOT_DB` 可覆盖。
"""

from __future__ import annotations

import logging
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final

import jobpilot_db

logger = logging.getLogger(__name__)

PROJECT_ROOT = jobpilot_db.PROJECT_ROOT

DEFAULT_DB_PATH = jobpilot_db.DEFAULT_DB_PATH

SITE_ID: Final[str] = "boss"


@dataclass
class StoredSession:
    """落盘的登录态。

    Attributes:
        token: 会话 token。
        cookies: Cookie 名到值的映射。
        phone_masked: 脱敏手机号。
        user: 用户信息摘要。
        saved_at: 保存时刻（epoch 秒）。
    """

    token: str = ""
    cookies: dict[str, str] = field(default_factory=dict)
    phone_masked: str = ""
    user: dict[str, Any] = field(default_factory=dict)
    saved_at: float = 0.0

    @property
    def is_empty(self) -> bool:
        """是否没有任何可用凭证。"""
        return not self.token and not self.cookies

    @property
    def age_seconds(self) -> float:
        """距离保存过去了多少秒；未保存过则为 0。"""
        return max(0.0, time.time() - self.saved_at) if self.saved_at else 0.0


def save_session(
    session: StoredSession, path: Path | str | None = None
) -> Path:
    """写入登录态，返回状态库路径。"""
    payload = {
        "token": session.token,
        "cookies": session.cookies,
        "phone_masked": session.phone_masked,
        "user": session.user,
        "saved_at": session.saved_at or time.time(),
    }
    resolved = jobpilot_db.doc_set(jobpilot_db.DOC_SESSION, payload, path, site=SITE_ID)
    logger.info("登录态已保存到 %s", resolved)
    return resolved


def load_session(path: Path | str | None = None) -> StoredSession:
    """读取登录态；库里没有、payload 坏了、库文件打不开，都按未登录处理。"""
    try:
        payload = jobpilot_db.doc_get(jobpilot_db.DOC_SESSION, path, site=SITE_ID)
    except (OSError, sqlite3.Error) as exc:
        logger.warning("状态库打不开，按未登录处理：%s", exc)
        return StoredSession()
    if payload is None:
        return StoredSession()

    return StoredSession(
        token=str(payload.get("token") or ""),
        cookies={str(k): str(v) for k, v in (payload.get("cookies") or {}).items()},
        phone_masked=str(payload.get("phone_masked") or ""),
        user=payload.get("user") or {},
        saved_at=float(payload.get("saved_at") or 0.0),
    )


def clear_session(path: Path | str | None = None) -> bool:
    """删除本地登录态，返回是否真的删掉了东西。"""
    try:
        removed = jobpilot_db.doc_delete(jobpilot_db.DOC_SESSION, path, site=SITE_ID)
    except (OSError, sqlite3.Error) as exc:
        logger.warning("状态库打不开，登录态没删成：%s", exc)
        return False
    if removed:
        logger.info("本地登录态已清除：%s", jobpilot_db.resolve_db_path(path))
    return removed


def has_session_row(path: Path | str | None = None) -> bool:
    """库里有没有 `doc('session')` 这一行。

    与 `load_session` 的「内容是不是空」是两回事；打不开的库按「没有」处理。
    """
    try:
        return jobpilot_db.doc_get_raw(jobpilot_db.DOC_SESSION, path, site=SITE_ID) is not None
    except (OSError, sqlite3.Error):
        return False
