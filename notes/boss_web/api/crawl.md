# `boss_web.api.crawl` 协议笔记

> 摘自 `boss_web/api/crawl.py` 的模块文档字符串 / `#` 注释。

## 一句话

抓取任务 API：启动 / 进度 / 取消 + 历史任务档案。

## 细节

这里拆两个面（docs/console-migration-parity.md 三.7），挂法不同：

- `batch_router`（`/tasks…`）= 批次账。「这批带回了哪些职位」是库账，跨站点可读，共用页（匹配 / 出题 / 简历优化）拿它当职位来源选择器。挂共用口时不带站点作用域；挂 `/api/sites/{site}/crawl` 时按 `{site}` 切列表。
- `router`（`/start` `/status` `/{task_id}` `/{task_id}/cancel`）= 抓取执行。限速与并发通道都在站点上，必须平台作用域。

历史档案路由（`/tasks…`）必须注册在 `/{task_id}` 之前——动态段会把 `tasks` 当成 task_id 吃掉（与 `jobs.py` 里 `fetch-descriptions` 同款坑）。两个 router 分开挂时这条退化成「`batch_router` 先挂」，见 `boss_web/api/__init__.py`。

切片只认路径作用域：`/api/sites/{site}/crawl/tasks` 切到那个站点，`/api/crawl/tasks` 不切（跨站点全量）。故意不加 `?site=` 查询过滤——同一个 handler 挂两遍时，`{site}` 既是路径段又是查询名会撞车；共用页要看全量、平台页看自己，这两种需求路径已经覆盖了，真要按站点挑再单开路由。
