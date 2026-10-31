"""`boss_browser_pool` — 通用 Chrome 生命周期、CDP 客户端与网络抓包。

约定：不许出现任何站点私有语义（令牌算法、站点域名、业务字段名等）。
"""

from __future__ import annotations

from .cdp import (
    BrowserError,
    CdpClient,
    close_launched_browsers,
    connect_or_launch,
    find_chrome,
    keep_browser,
    launch_chrome,
    probe_debug,
)

__all__ = [
    "BrowserError",
    "CdpClient",
    "close_launched_browsers",
    "connect_or_launch",
    "find_chrome",
    "keep_browser",
    "launch_chrome",
    "probe_debug",
]
