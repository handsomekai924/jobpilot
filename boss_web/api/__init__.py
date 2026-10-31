"""HTTP 路由层：平台作用域路由与共用路由的挂载。

平台作用域走 `/api/sites/{site}/…`，共用路由不带站点语义。

Attributes:
    COMPAT_SITE: 兼容别名的归属站点；legacy 前端是单站点（BOSS）壳。
    PLATFORM_SCOPED: 平台作用域路由（模块、挂载前缀、标签）。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from ..core.registry import registered_sites
from ..errors import NotFoundError
from . import auth, collection, crawl, deliver, filters, interview, jobs, llm, match, platforms, resume, settings, system, tasks

COMPAT_SITE: str = "boss"

PLATFORM_SCOPED: tuple[tuple[Any, str, str], ...] = (
    (auth, "/auth", "auth"),
    (filters, "/filters", "filters"),
    (jobs, "/jobs", "jobs"),
    (crawl, "/crawl", "crawl"),
    (collection, "", "collection"),
    (deliver, "/deliver", "deliver"),
    (settings, "/settings", "settings"),
)

api_router = APIRouter()


def resolve_site(request: Request) -> str:
    """把路径里的 `{site}` 解析成已注册站点；没有这段时落 `COMPAT_SITE`。

    站点没注册时抛 `NotFoundError`。
    """
    site = str(request.path_params.get("site") or COMPAT_SITE)
    if site not in registered_sites():
        raise NotFoundError(f"没这个平台：{site}")
    request.state.site = site
    return site


api_router.include_router(
    crawl.batch_router,
    prefix=f"/sites/{{site}}/crawl",
    dependencies=[Depends(resolve_site)],
    tags=["crawl"],
)

for _mod, _prefix, _tag in PLATFORM_SCOPED:
    api_router.include_router(
        _mod.router,
        prefix=f"/sites/{{site}}{_prefix}",
        dependencies=[Depends(resolve_site)],
        tags=[_tag],
    )

api_router.include_router(llm.router, prefix="/llm", tags=["llm"])
api_router.include_router(resume.router, prefix="/resume", tags=["resume"])
api_router.include_router(match.router, prefix="/match", tags=["match"])
api_router.include_router(interview.router, prefix="/interview", tags=["interview"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(tasks.router, prefix="", tags=["tasks"])
api_router.include_router(platforms.router, prefix="/platforms", tags=["platforms"])

api_router.include_router(crawl.batch_router, prefix="/crawl", tags=["crawl"])

for _mod, _prefix, _tag in PLATFORM_SCOPED:
    api_router.include_router(
        _mod.router,
        prefix=_prefix,
        dependencies=[Depends(resolve_site)],
        tags=[_tag],
    )


@api_router.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """健康检查探针。"""
    return {"ok": "true", "service": "boss_web"}
