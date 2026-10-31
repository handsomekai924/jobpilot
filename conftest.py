"""pytest 根配置：注入 workspace 各 src 根，并提供跨包共享夹具。

放在项目根目录，使各 workspace 包在测试时可直接导入（无需安装为包）。
`server` / `client` / `clean_store` / `reset_task_hub` 被 server 与 platform-boss
两侧的用例共用，所以留在根上；`isolated_db` 保证测试绝不碰真状态库、也绝不真拉 Chrome。
"""

from __future__ import annotations

import sys
import threading
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent

SOURCE_DIRS = (
    ROOT / "apps" / "server" / "src",
    ROOT / "packages" / "core" / "src",
    ROOT / "packages" / "platform-base" / "src",
    ROOT / "packages" / "platform-boss" / "src",
    ROOT / "packages" / "browser-pool" / "src",
    ROOT / "packages" / "ai" / "src",
    ROOT / "packages" / "db" / "src",
)

# 逆序插入：src 根排在 ROOT 前面，`tools` 仍从 ROOT 导入。
for entry in reversed((*SOURCE_DIRS, ROOT)):
    if str(entry) not in sys.path:
        sys.path.insert(0, str(entry))

from boss_platform_boss.auth import ZhipinLoginClient  # noqa: E402
from tools.mock_server import BURNED_TICKETS, LAST_SMS_REQUEST, STORE, serve  # noqa: E402


@pytest.fixture(scope="module")
def server():
    """起模块级假服务端，返回 base_url。"""
    httpd = serve(port=0)
    port = httpd.server_address[1]
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    httpd.shutdown()
    httpd.server_close()


@pytest.fixture(autouse=True)
def clean_store():
    """每个用例前后清空 mock 服务端状态。"""
    import tools.mock_server as mock_server

    STORE.clear()
    LAST_SMS_REQUEST.clear()
    BURNED_TICKETS.clear()
    mock_server.FILTER_API_DOWN = False
    yield
    STORE.clear()
    LAST_SMS_REQUEST.clear()
    BURNED_TICKETS.clear()
    mock_server.FILTER_API_DOWN = False


@pytest.fixture(autouse=True)
def reset_task_hub():
    """任务中心是进程内单例：用例之间清掉任务记录，免得旧任务的占用串场。"""
    from boss_server.services.task_runtime import hub

    hub.reset()
    yield
    hub.reset()


@pytest.fixture(autouse=True)
def isolated_db(monkeypatch, tmp_path):
    """把状态库指到 `tmp_path/boss.db`，CDP 换新换成假令牌。"""
    import boss_db

    monkeypatch.setenv(boss_db.DB_ENV, str(tmp_path / "boss.db"))
    monkeypatch.setattr(
        "boss_platform_boss.stoken_cdp.CdpStokenProvider._acquire_from_chrome",
        lambda self: "0138FAKECDP",
    )
    yield
    boss_db.close_all()


@pytest.fixture
def client(server):
    """提供不重试的登录客户端，免得重试掩盖问题。"""
    return ZhipinLoginClient(base_url=server, retries=0, timeout=5.0, sleeper=lambda _s: None)
