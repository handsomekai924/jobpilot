"""BOSS 直聘 `__zp_stoken__` 的账本与 CDP 供给器。

用真 Chrome 经 CDP 让站点自算令牌，只读调试口里的 Cookie，不解密；
滑块 / 风控不在此处理。通用浏览器生命周期在 `boss_browser_pool.cdp`。

Attributes:
    SITE_ID: 令牌账本归属的站点 id。
    EXPIRY_MARGIN: 快过期就提前换新的余量（秒）。
    RENEW_COOLDOWN: 强制换新的冷却（秒），免得连环拉 Chrome 惹风控。
    ACQUIRE_TIMEOUT: 等站点写出令牌的超时（秒）。
    COOKIE_DOMAIN: 登录 Cookie 灌进 Chrome 时用的域。
    TARGET_HOST: 复用页面 target 时认的域名片段。
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final, Mapping

import boss_db
from boss_browser_pool.cdp import BrowserError, connect_or_launch, keep_browser

SITE_ID: Final[str] = "boss"

logger = logging.getLogger(__name__)

__all__ = [
    "ACQUIRE_TIMEOUT",
    "CdpStokenProvider",
    "DEFAULT_DB_PATH",
    "EXPIRY_MARGIN",
    "RENEW_COOLDOWN",
    "SITE_ID",
    "StokenRecord",
    "StokenStore",
]

DEFAULT_DB_PATH: Path = boss_db.DEFAULT_DB_PATH

EXPIRY_MARGIN: int = 5 * 60

RENEW_COOLDOWN: float = 5.0

ACQUIRE_TIMEOUT: float = 40.0

COOKIE_DOMAIN: Final[str] = ".zhipin.com"

TARGET_HOST: Final[str] = "zhipin.com"

_NON_COOKIE_KEYS: frozenset[str] = frozenset({"__zp_stoken__"})


def _config():
    """延迟取站点常量，避免平台包与 jobs 在导入期互等。"""
    from .jobs import config

    return config


def _stoken_max_age() -> int:
    """延迟取令牌有效期，避免导入期互等。"""
    from .stoken import STOKEN_MAX_AGE

    return STOKEN_MAX_AGE


@dataclass(frozen=True)
class StokenRecord:
    """一枚 `__zp_stoken__` 及其有效期。

    Attributes:
        token: 令牌本体。
        minted_at: 拿到手的 Unix 时间戳（秒）。
        expires_at: 过期时间戳（秒）；站点给 Cookie `expires`，没有就按 max-age 从 `minted_at` 推。
        source: 怎么来的（`cdp` / `manual`）。
    """

    token: str
    minted_at: float
    expires_at: float
    source: str = "cdp"

    @classmethod
    def from_cookie(
        cls,
        cookie: Mapping[str, Any],
        *,
        minted_at: float | None = None,
        source: str = "cdp",
    ) -> "StokenRecord":
        """从 CDP 的 Cookie 结构建一条记录（认 `expires`，没有就按 max-age 推）。"""
        now = minted_at if minted_at is not None else time.time()
        raw = cookie.get("expires")
        try:
            expires_at = float(raw) if raw is not None else -1.0
        except (TypeError, ValueError):
            expires_at = -1.0
        if expires_at <= 0:
            expires_at = now + _stoken_max_age()
        return cls(
            token=str(cookie.get("value") or ""),
            minted_at=now,
            expires_at=expires_at,
            source=source,
        )

    @property
    def is_usable(self) -> bool:
        """有没有非空的令牌本体。"""
        return bool(self.token)

    def is_fresh(self, *, margin: int = EXPIRY_MARGIN) -> bool:
        """还没到该换新的时候吗？（留 `margin` 秒余量）"""
        return self.is_usable and time.time() < (self.expires_at - margin)

    @property
    def ttl_left(self) -> float:
        """距过期还剩多少秒（不会为负）。"""
        return max(0.0, self.expires_at - time.time())

    def to_dict(self) -> dict[str, Any]:
        """转成可 JSON 序列化的 dict。"""
        return {
            "token": self.token,
            "minted_at": self.minted_at,
            "expires_at": self.expires_at,
            "source": self.source,
        }

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any] | None) -> "StokenRecord | None":
        """从落盘的 dict 还原；不像一条完整记录就返回 `None`。"""
        if not isinstance(payload, Mapping):
            return None
        token = payload.get("token")
        if not token:
            return None
        try:
            minted_at = float(payload.get("minted_at") or 0.0)
            expires_at = float(payload.get("expires_at") or 0.0)
        except (TypeError, ValueError):
            return None
        return cls(
            token=str(token),
            minted_at=minted_at,
            expires_at=expires_at,
            source=str(payload.get("source") or "cdp"),
        )


class StokenStore:
    """`doc('stoken')` 的读写：一次 fetch 一份过期账本。

    跟登录态分开放——`doc('session')` 的 `cookies` 是纯 `str → str`，
    塞不进过期时间。取出的 token 会另外镜像进 `doc('session')`。

    Args:
        path: 状态库路径；省略 = `BOSS_DB` = `data/boss.db`。
    """

    def __init__(self, path: Path | str | None = None) -> None:
        """初始化。"""
        self.path = boss_db.resolve_db_path(path)

    def load(self) -> StokenRecord | None:
        """读账本；没有、坏 JSON 或读盘失败都当没有。"""
        try:
            raw = boss_db.doc_get_raw(boss_db.DOC_STOKEN, self.path, site=SITE_ID)
        except (OSError, sqlite3.Error) as exc:
            logger.warning("读 %s 的 %s 失败（当没有）：%s", self.path, boss_db.DOC_STOKEN, exc)
            return None
        if raw is None:
            return None
        try:
            payload = json.loads(raw)
        except ValueError:
            logger.warning("状态库里的 %s 不是合法 JSON，丢弃重取", boss_db.DOC_STOKEN)
            return None
        return StokenRecord.from_dict(payload)

    def save(self, record: StokenRecord) -> None:
        """写账本；写失败只告警，不拦主流程。"""
        try:
            resolved = boss_db.doc_set(boss_db.DOC_STOKEN, record.to_dict(), self.path, site=SITE_ID)
        except (OSError, sqlite3.Error) as exc:
            logger.warning("写 %s 失败（不拦主流程）：%s", self.path, exc)
        else:
            logger.debug(
                "已落盘 %s（%s，剩 %.0f 分钟）", resolved, record.source, record.ttl_left / 60
            )

    def clear(self) -> None:
        """删掉账本这一行；失败忽略。"""
        try:
            boss_db.doc_delete(boss_db.DOC_STOKEN, self.path, site=SITE_ID)
        except (OSError, sqlite3.Error):
            pass


@dataclass
class CdpStokenProvider:
    """fetch 用的 `__zp_stoken__` 供给器：判过期，过期才拉 Chrome。

    Attributes:
        http: 带 `cookies` 的会话；里面的登录 Cookie 会被灌进 Chrome。
        store: 过期账本；不传就用 `BOSS_DB` 的 `doc('stoken')`。
        session_path: 镜像进 `doc('session')` 的库路径；`None` = 不镜像。
        page_url: 跑站点 JS 取令牌的页面；空 = 站点职位页。
        timeout: 等站点写出 token 的超时（秒）。
        acquire: 换新令牌的实现（测试里替换掉真 Chrome）。
        port: 调试端口。
        chrome: Chrome 可执行文件。
        profile_dir: 独立 user-data-dir。
        mode: 自拉 Chrome 时的窗口档位（`CHROME_MODES`）。
        _last_renew_at: 上次真去 Chrome 换新的时间戳，给 `RENEW_COOLDOWN` 用。
    """

    http: Any
    store: StokenStore | None = None
    session_path: Path | str | None = None
    page_url: str = ""
    timeout: float = ACQUIRE_TIMEOUT
    acquire: Any | None = None
    port: int | None = None
    chrome: str | None = None
    profile_dir: Path | str | None = None
    mode: str | None = None
    _last_renew_at: float = 0.0

    def __post_init__(self) -> None:
        """补上默认的 `store`、`acquire` 与取令牌页面。"""
        if self.store is None:
            self.store = StokenStore()
        if self.acquire is None:
            self.acquire = self._acquire_from_chrome
        if not self.page_url:
            self.page_url = f"{_config().BASE_URL}/web/geek/jobs"

    def ensure(self, *, force: bool = False) -> str:
        """确保会话里有一枚没过期的 `__zp_stoken__`，并返回它。

        顺序：账本新鲜直接用；账本没有但会话里已有就先用着；其余
        （过期 / `force`）拉 Chrome 换新并落盘。已是同一枚时不再 `_persist`；
        `force` 也有 `RENEW_COOLDOWN` 冷却。

        Args:
            force: 无视过期强制换新。
        """
        C = _config()
        record = self.store.load() if self.store else None
        if not force:
            if record and record.is_fresh():
                logger.debug(
                    "%s 还新鲜（剩 %.0f 分钟），不拉 Chrome",
                    C.STOKEN_COOKIE,
                    record.ttl_left / 60,
                )
                if _read_cookie(self.http, C.STOKEN_COOKIE) != record.token:
                    self._persist(record.token, record.expires_at, record.minted_at, record.source)
                return record.token
            if record is None:
                existing = _read_cookie(self.http, C.STOKEN_COOKIE)
                if existing:
                    logger.debug("会话里已有 %s（手工拷的），先用着", C.STOKEN_COOKIE)
                    return existing

        if force and self._last_renew_at and record is not None and record.is_usable:
            since = time.time() - self._last_renew_at
            if since < RENEW_COOLDOWN:
                logger.info(
                    "%s 换新冷却中（%.0fs 前刚换过），先用现有这枚顶一下",
                    C.STOKEN_COOKIE,
                    since,
                )
                if _read_cookie(self.http, C.STOKEN_COOKIE) != record.token:
                    self._persist(record.token, record.expires_at, record.minted_at, record.source)
                return record.token

        reason = "强制换新" if force else ("已过期" if record else "还没有")
        logger.info("%s %s，拉 Chrome（CDP）重取一枚", C.STOKEN_COOKIE, reason)
        new = self._to_record(self.acquire())
        if not new.is_usable:
            raise BrowserError(f"Chrome 那边没取到 {C.STOKEN_COOKIE}")
        self._last_renew_at = time.time()
        self._persist(new.token, new.expires_at, new.minted_at, new.source)
        return new.token

    @staticmethod
    def _to_record(raw: Any) -> StokenRecord:
        """`acquire` 的三种回包：CDP 的 Cookie 结构 / 记录 / 光字符串。"""
        if isinstance(raw, StokenRecord):
            return raw
        if isinstance(raw, Mapping):
            return StokenRecord.from_cookie(raw)
        now = time.time()
        return StokenRecord(
            token=str(raw or ""),
            minted_at=now,
            expires_at=now + _stoken_max_age(),
            source="cdp",
        )

    def _acquire_from_chrome(self) -> dict[str, Any]:
        """拉 Chrome 算一枚，返回 CDP 的 Cookie 结构（含 `expires`）。

        先把旧的过期掉再重载，逼站点重算。
        """
        C = _config()
        client = connect_or_launch(
            chrome=self.chrome, port=self.port, profile_dir=self.profile_dir, mode=self.mode
        )
        try:
            login = _session_cookies(self.http)
            client.set_login_cookies(login, domain=COOKIE_DOMAIN, skip=_NON_COOKIE_KEYS)
            _, session_id = client.open_page(self.page_url, target_host=TARGET_HOST)
            client.clear_cookie(C.STOKEN_COOKIE, session_id=session_id, domain=COOKIE_DOMAIN)
            client.reload(session_id=session_id)
            cookie = client.wait_for_cookie(C.STOKEN_COOKIE, timeout=self.timeout)
            if not cookie.get("value"):
                raise BrowserError(f"站点写了 {C.STOKEN_COOKIE} 但值是空的")
            return dict(cookie)
        finally:
            if keep_browser():
                client.close()
            else:
                try:
                    client.call("Browser.close", timeout=5.0)
                except BrowserError:  # pragma: no cover - 已经退了也算
                    pass
                finally:
                    client.close()

    def _persist(self, token: str, expires_at: float, minted_at: float, source: str) -> None:
        """把令牌写进账本、会话 Cookie，并镜像回 `doc('session')`。"""
        record = StokenRecord(
            token=token, minted_at=minted_at, expires_at=expires_at, source=source
        )
        if self.store is not None:
            self.store.save(record)
        self._apply_cookie(token, expires_at)
        self._mirror_session(token)

    def _apply_cookie(self, token: str, expires_at: float) -> None:
        """把令牌写进会话 cookiejar（带过期时间）。"""
        from .stoken import put_cookie

        put_cookie(self.http.cookies, _config().STOKEN_COOKIE, token, expires=int(expires_at))

    def _mirror_session(self, token: str) -> None:
        """把 token 写回 `doc('session')`，让 `http_from_session` 老规矩继续生效。"""
        if not self.session_path:
            return
        try:
            from .auth.session import StoredSession, load_session, save_session
        except ImportError:  # pragma: no cover
            return
        C = _config()
        path = Path(self.session_path)
        try:
            stored = load_session(path)
            cookies = dict(stored.cookies)
            cookies[C.STOKEN_COOKIE] = token
            save_session(
                StoredSession(
                    token=stored.token,
                    cookies=cookies,
                    phone_masked=stored.phone_masked,
                    user=stored.user,
                    saved_at=stored.saved_at,
                ),
                path,
            )
        except Exception as exc:  # noqa: BLE001 - 镜像失败不拦主流程
            logger.debug("镜像 %s 到 %s 失败（忽略）：%s", C.STOKEN_COOKIE, path, exc)


def _read_cookie(http: Any, name: str) -> str:
    """从会话 cookiejar 取一枚 cookie 的值；取不到或异常都返回空串。"""
    jar = getattr(http, "cookies", None)
    if jar is None:
        return ""
    getter = getattr(jar, "get", None)
    if getter is None:
        return ""
    try:
        return str(getter(name) or "")
    except Exception:  # noqa: BLE001 - cookiejar 对非法字符会抛
        return ""


def _session_cookies(http: Any) -> dict[str, str]:
    """从会话 cookiejar 里把登录 Cookie 抠出来。"""
    jar = getattr(http, "cookies", None)
    if jar is None:
        return {}
    out: dict[str, str] = {}
    try:
        for cookie in jar:
            name = getattr(cookie, "name", None)
            value = getattr(cookie, "value", None)
            if name and value:
                out[str(name)] = str(value)
    except Exception:  # noqa: BLE001 # pragma: no cover
        return {}
    return out
