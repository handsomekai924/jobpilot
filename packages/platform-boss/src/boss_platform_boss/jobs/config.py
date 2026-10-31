"""职位获取相关接口地址、请求头、节流参数等常量。

列表路由只剩搜索流与求职期望流；接口、业务码与聊天通道常量的实测细节见
`notes/boss_jobs/config.md`。
"""

from __future__ import annotations

from pathlib import Path
from typing import Final

import boss_db
from boss_core.paths import repo_root

BASE_URL: Final[str] = "https://www.zhipin.com"

GEEK_JOBS_REFERER: Final[str] = f"{BASE_URL}/web/geek/jobs"

ENDPOINTS: Final[dict[str, str]] = {
    "job_search": "/wapi/zpgeek/search/joblist.json",
    "business_district": "/wapi/zpgeek/businessDistrict.json",
    "job_expect_flow": "/wapi/zpgeek/pc/recommend/job/list.json",
    "job_expect_list": "/wapi/zpgeek/pc/recommend/expect/list.json",
    "job_detail": "/wapi/zpgeek/job/detail.json",
    "friend_add": "/wapi/zpgeek/friend/add.json",
    "get_wt": "/wapi/zppassport/get/wt",
    "get_user_info": "/wapi/zpuser/wap/getUserInfo.json",
    "get_boss_data": "/wapi/zpchat/geek/getBossData",
    "chat_history": "/wapi/zpchat/geek/historyMsg",
    "chatremind_log": "/wapi/zpCommon/actionLog/geek/chatremind.json",
}

DEFAULT_HEADERS: Final[dict[str, str]] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": GEEK_JOBS_REFERER,
    "X-Requested-With": "XMLHttpRequest",
}

CODE_OK: Final[int] = 0

CODE_SESSION_EXPIRED: Final[frozenset[int]] = frozenset({7})

CODE_BROWSER_CHECK: Final[int] = 37

CODE_RISK_CONTROL: Final[int] = 36

STOKEN_COOKIE: Final[str] = "__zp_stoken__"

ZP_TOKEN_COOKIE: Final[str] = "bst"
ZP_TOKEN_HEADER: Final[str] = "zp_token"

CHAT_REMIND_CONFIRM_CID: Final[int] = 1

STOKEN_ENV: Final[str] = "BOSS_ZP_STOKEN"

DEFAULT_TIMEOUT: Final[float] = 10.0

DEFAULT_RETRIES: Final[int] = 2

DEFAULT_BACKOFF: Final[float] = 0.8


PAGE_SIZE: Final[int] = 15

DEFAULT_PAGE_INTERVAL: Final[float] = 1.0

DETAIL_INTERVAL: Final[float] = 1.0

DELIVER_INTERVAL: Final[float] = 1.0

CHAT_WS_HOST: Final[str] = "ws6.zhipin.com"
CHAT_WS_PORT: Final[int] = 443
CHAT_WS_PATH: Final[str] = "/chatws"
CHAT_TOPIC: Final[str] = "chat"

CHAT_KEEPALIVE: Final[int] = 25
CHAT_TIMEOUT: Final[float] = 15.0

CHAT_PUSH_WAIT: Final[float] = 4.0

CHAT_MID_FLOOR: Final[int] = 394_000_000_000_000

CHAT_MID_RANGE: Final[tuple[int, int]] = (10**13, 10**17)

CHAT_PUBACK_WAIT: Final[float] = 0.0

CHAT_FLUSH_WAIT: Final[float] = 0.15

CHAT_FLUSH_DEADLINE: Final[float] = 1.0

CHAT_RETAIN: Final[bool] = False

CHAT_RECONNECT_MIN: Final[int] = 30
CHAT_RECONNECT_MAX: Final[int] = 60

CHAT_DEFAULT_SOURCE: Final[int] = 0
CHAT_BODY_TEXT: Final[int] = 1
CHAT_PROTO_MESSAGE: Final[int] = 1
CHAT_PROTO_PRESENCE: Final[int] = 2
CHAT_CLIENT_VERSION: Final[str] = "4.92"
CHAT_APP_ID: Final[int] = 9019
CHAT_PRESENCE_ONLINE: Final[int] = 1

BROWSER_CHECK_BACKOFF: Final[float] = 2.0

BROWSER_CHECK_COOLOFF: Final[float] = 5.0

BROWSER_CHECK_GIVEUP: Final[int] = 3

DEFAULT_MAX_PAGES: Final[int] = 0


PROJECT_ROOT: Final[Path] = repo_root()

DEFAULT_DB_PATH: Final[Path] = boss_db.DEFAULT_DB_PATH


FONT_DIGIT_ENTITIES: Final[tuple[str, ...]] = (
    "&#xe031;",
    "&#xe032;",
    "&#xe033;",
    "&#xe034;",
    "&#xe035;",
    "&#xe036;",
    "&#xe037;",
    "&#xe038;",
    "&#xe039;",
    "&#xe03a;",
)
FONT_DIGIT_CHARS: Final[tuple[str, ...]] = tuple(chr(0xE031 + i) for i in range(10))
