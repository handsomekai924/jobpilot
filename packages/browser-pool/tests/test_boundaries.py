"""通用浏览器层不许掺入站点私有语义。"""

from __future__ import annotations

from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1] / "src" / "boss_browser_pool"

FORBIDDEN = ("stoken", "zhipin", "__zp_stoken__", "boss_db", "boss_login")


def test_通用浏览器层不含站点私有语义():
    """`boss_browser_pool` 只认通用 Chrome / CDP，站点细节由调用方传参。"""
    hits = [
        f"{path.name}: {token}"
        for path in sorted(PACKAGE.rglob("*.py"))
        for token in FORBIDDEN
        if token in path.read_text("utf-8")
    ]
    assert hits == []
