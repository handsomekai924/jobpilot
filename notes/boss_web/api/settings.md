# `boss_web.api.settings` 协议笔记

> 摘自 `boss_web/api/settings.py` 的模块文档字符串。

## 一句话

平台设置：每站点的节流/每日配额/并发/投递开关（`site_settings`）。

## 细节

限速是站点属性，所以这条路由是平台作用域的：`/api/sites/{site}/settings`（legacy 别名 `/api/settings` 归 `site="boss"`）。前端 `#/:siteId/settings` 页读写的就是它；任务中心「今天还能发几条」也从这儿出（`quota_left`），口径见 `boss_web.services.site_settings_store`。

`apply_enabled` 管的是门槛过了之后要不要真投简历，不是要不要发对话——发对话照发，投递由 `run_deliver` 按这个开关收口。
