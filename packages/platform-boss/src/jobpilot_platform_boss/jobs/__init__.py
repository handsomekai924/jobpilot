"""BOSS直聘职位分页获取：即时清洗 + 入库 + 翻页节流。

每条职位保留（岗位名称 / 公司名称 / 工作地点 / 薪资待遇 /
工作经验要求 / 学历要求 / 公司行业 / 公司规模）。清洗入库同步按页做，中途断了
已到手的页不会丢；页间默认硬睡 1 秒（`--interval` 可调）把频率压到人手滚动的量级。
登录态复用 `jobpilot_platform_boss.auth` 落盘的 `doc('session')`。

    python -m jobpilot_platform_boss.jobs fetch                 # 翻页抓，每页洗完就入库
    python -m jobpilot_platform_boss.jobs fetch --max-pages 3
    python -m jobpilot_platform_boss.jobs stats
    python -m jobpilot_platform_boss.jobs list --city 广州

    from jobpilot_platform_boss.jobs import create_client, open_store
    with open_store() as store:               # 默认 data/jobpilot.db
        report = client.crawl(store=store)    # 抓一页存一页，页间睡 1 秒
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .client import (
    BossData,
    CrawlBlacklistContext,
    CrawlReport,
    CrawlStats,
    GreetResult,
    GreetingDelivery,
    JobClient,
    JobDetail,
    create_client,
    http_from_session,
)
from .chat import ChatCredentials, ChatSocket, encode_presence, encode_text_message
from .config import (
    BASE_URL,
    CHAT_TOPIC,
    CHAT_WS_HOST,
    CHAT_WS_PATH,
    CHAT_WS_PORT,
    CODE_BROWSER_CHECK,
    CODE_RISK_CONTROL,
    DEFAULT_DB_PATH,
    DEFAULT_MAX_PAGES,
    DEFAULT_PAGE_INTERVAL,
    DELIVER_INTERVAL,
    DETAIL_INTERVAL,
    ENDPOINTS,
    PAGE_SIZE,
    STOKEN_COOKIE,
    STOKEN_ENV,
)
from .errors import (
    ChatSendError,
    JobApiError,
    JobDataError,
    JobError,
    JobTransportError,
)
from jobpilot_browser_pool.cdp import CdpClient, connect_or_launch, find_chrome

from ..stoken_cdp import (
    CdpStokenProvider,
    StokenRecord,
    StokenStore,
)
from .models import (
    ExpectItem,
    ExpectList,
    Job,
    PageResult,
    clean_expects,
    clean_page,
    clean_pages,
    clean_salary,
    clean_text,
)
if TYPE_CHECKING:
    from ..stoken import (
        StokenChallenge,
        StokenError,
        StokenProvider,
        compute_stoken,
        load_security_js,
        mint_offline,
        parse_challenge,
    )
from .store import JobStore, SaveOutcome, open_store

__version__ = "0.1.0"

__all__ = [
    "JobClient",
    "create_client",
    "http_from_session",
    "CrawlBlacklistContext",
    "CrawlReport",
    "CrawlStats",
    "GreetResult",
    "BossData",
    "GreetingDelivery",
    "JobDetail",
    "ChatCredentials",
    "ChatSocket",
    "encode_presence",
    "encode_text_message",
    "CdpClient",
    "CdpStokenProvider",
    "StokenRecord",
    "StokenStore",
    "connect_or_launch",
    "find_chrome",
    "StokenChallenge",
    "StokenError",
    "StokenProvider",
    "compute_stoken",
    "load_security_js",
    "mint_offline",
    "parse_challenge",
    "Job",
    "PageResult",
    "ExpectItem",
    "ExpectList",
    "clean_expects",
    "clean_page",
    "clean_pages",
    "clean_salary",
    "clean_text",
    "JobStore",
    "SaveOutcome",
    "open_store",
    "ChatSendError",
    "JobApiError",
    "JobDataError",
    "JobError",
    "JobTransportError",
    "BASE_URL",
    "CHAT_TOPIC",
    "CHAT_WS_HOST",
    "CHAT_WS_PATH",
    "CHAT_WS_PORT",
    "CODE_BROWSER_CHECK",
    "CODE_RISK_CONTROL",
    "DEFAULT_DB_PATH",
    "DEFAULT_MAX_PAGES",
    "DEFAULT_PAGE_INTERVAL",
    "DELIVER_INTERVAL",
    "DETAIL_INTERVAL",
    "ENDPOINTS",
    "PAGE_SIZE",
    "STOKEN_COOKIE",
    "STOKEN_ENV",
    "__version__",
]

_STOKEN_EXPORTS: frozenset[str] = frozenset(
    {
        "StokenChallenge",
        "StokenError",
        "StokenProvider",
        "compute_stoken",
        "load_security_js",
        "mint_offline",
        "parse_challenge",
    }
)


def __getattr__(name: str) -> Any:
    """延迟转发 `jobpilot_platform_boss.stoken` 的公开名，避免它先导入时和本包循环卡死。"""
    if name in _STOKEN_EXPORTS:
        from .. import stoken as _stoken

        return getattr(_stoken, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
