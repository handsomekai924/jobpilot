"""壳路由：新壳 `/` 与 SPA 深链兜底。"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from jobpilot_server import create_app


@pytest.fixture
def static_tree(tmp_path: Path, monkeypatch) -> Path:
    """造一棵只有新壳的静态树，并把它设成 `STATIC_DIR`。"""
    from jobpilot_server import config as C

    (tmp_path / "dist").mkdir()
    (tmp_path / "dist" / "index.html").write_text("<html>新壳</html>", encoding="utf-8")
    monkeypatch.setattr(C, "STATIC_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def client(static_tree: Path) -> TestClient:
    """提供隔离库下的 TestClient。"""
    return TestClient(create_app())


def test_根回新壳(client: TestClient):
    """验 `/` 出新壳。"""
    res = client.get("/")
    assert res.status_code == 200
    assert "新壳" in res.text


def test_未知路径回新壳(client: TestClient):
    """验新壳的深链落回新壳（刷新不 404）。"""
    res = client.get("/overview/deep")
    assert res.status_code == 200
    assert "新壳" in res.text
