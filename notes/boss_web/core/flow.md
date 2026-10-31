# `boss_web.core.flow` 协议笔记

> 摘自 `boss_web/core/flow.py` 的模块文档字符串 / 函数文档字符串 / `#` 注释。

## 一句话

编排骨架：`run_crawl` / `run_deliver` 两个模板方法，共享层定死流程，站点只填洞。

## 细节

共享层定死流程——抓取的黑名单/入库/只改不增/节流，投递的「发对话 → 过门槛 → 投递」——站点只填洞。洞数是契约：`run_crawl` 3 个（`to_search_params` / `iter_pages` / `fetch_detail`），`run_deliver` 3 个（`open_session` / `send_text` / `apply`）。`caps()` 与 `conversation_state()` 不算洞：它们是共享规则的输入（门槛判据），站点只是如实自述，不能借它们夹带编排步骤。

投递门槛是共享规则（todo3 成功标准 #5），不许各站点自己写一套：`AFTER_MUTUAL_CONVERSATION`（默认）——`conversation_state()` 不是 `REPLIED` 就不调 `applier.apply`；`AFTER_GREETING`——发完对话即可投。

`site_settings` 的节流/每日配额/投递开关同样是共享规则：`limits` 传进来就照着它停/走——`throttle_ms` 由 `throttle_hook` 变成 `hooks.throttle`，`daily_quota` 到顶整批停，`apply_enabled=0` 只发对话不投简历。熔断也在这儿：站点只管 `classify_fault` 归类，`Breaker` 照类判停（停类一发就断、退避类攒到阈值断）。

### 共享侧钩子

黑名单 / 入库 / 只改不增 / 节流都由 server 注入，站点看不见。

### `run_crawl`

站点调用点恰好 3 个（todo3 成功标准 #4）：`to_search_params` / `iter_pages` / `fetch_detail`。翻页策略（BOSS 的 hasMore 第 1 页不可信、页间硬睡）在 `iter_pages` 里，属于站点语义，骨架不掺和。

检索维度全空时抛 `ValueError`——抓全量没意义，拦在站点调用之前。

### `run_deliver`

站点调用点恰好 3 个（todo3 成功标准 #4）：`open_session` / `send_text` / `apply`。投递门槛是共享规则（成功标准 #5），不是站点私有判断：`caps().apply_gate` 是 `AFTER_MUTUAL_CONVERSATION` 时，`conversation_state()` 不是 `REPLIED` 就不调 `apply`，这条写进测试。

`limits`（`site_settings`）同样是共享规则：`apply_enabled=0` → 只发对话不投简历；`daily_quota` 到顶 → 整批停；`throttle_ms` 交给 `hooks.throttle`（见 `throttle_hook`）。熔断按 `classify_fault` 的归类判：停类一发就断，退避类攒到 `Breaker.trip` 断。

### `_ref_of`

从站点私有职位对象取引用；站点对象自带 `job_id` 一类的键，形状私有。取不出来说明站点返回的不是职位，当场炸比静默入库好。
