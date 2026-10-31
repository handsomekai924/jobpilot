# `boss_web.api.__init__` 协议笔记

> 摘自 `boss_web/api/__init__.py` 的模块文档字符串 / `#` 注释。

## 一句话

HTTP 路由层：平台作用域路由与共用路由的挂载。

## 细节

路由分两类（docs/multiplatform-console-redesign.md 6.3）：

- 平台作用域（`auth`/`filters`/`jobs`/`crawl`/`collection`/`deliver`/`settings`）：走 `/api/sites/{site}/…`；共存期旧 URL 原样保留，当 `site="boss"` 的兼容别名专供 legacy 前端，M3 随 legacy 一起删——新代码禁止走别名。
- 共用（`resume`/`match`/`interview`/`tasks`/`llm`/`system`/`platforms`）：不带站点语义；列表接口用 `?site=` 过滤（过滤器，不是作用域）。

唯一的跨界是批次账（`crawl.batch_router`）：抓取在哪跑是站点操作，「这批带回了哪些职位」是库账，所以 `/crawl/tasks…` 既有站点口（按 `{site}` 切列表）也有共用口（不切）。

### 挂载顺序

批次账（`crawl.batch_router`）与抓取执行不是一类：批次账是库账，共用页拿它当职位来源选择器；执行是站点操作（限速/并发通道都在站点上）。两边各挂一遍——站点口按 `{site}` 切列表，共用口不切。

批次账必须排在 `crawl.router` 前面，否则 `/{task_id}` 会把 `tasks` 当任务号吃掉（`tests/test_crawl_tasks.py` 有守这条）。

共用批次账不带 `resolve_site`——共用页读批次不该被套上站点作用域（红线「共用页不带站点语义」）。要挑站点用 `?site=` 过滤器。同样排在别名循环前。

### 常量

- `COMPAT_SITE`：兼容别名的归属站点；legacy 前端是单站点（BOSS）壳，旧 URL 就是这个站点的。
- `PLATFORM_SCOPED`：平台作用域路由（模块、挂载前缀、标签）。同一个 router 挂两遍：新面带 `{site}`，旧面留别名。BOSS 私有入口（求职期望）由 adapter 的 `nav_extras` 声明，M3 接进来。
