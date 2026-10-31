# `boss_web.core.adapters.boss` 协议笔记

> 摘自 `boss_web/core/adapters/boss.py` 的模块文档字符串 / 函数文档字符串 / `#` 注释。

## 一句话

BOSS 直聘站点适配器：薄壳包现有 `boss_jobs` / `boss_login` / `boss_filter`。

## 细节

Stage 0 只站接口面——能力方法往下委派现成实现，不搬业务。平台私有检索路径（求职期望流）留在这里当私有方法，不进 `JobSource` 共享抽象（todo3 2.1 拍板）。

`BossAdapter` 注册走 `adapters.load()`（`register("boss")(BossAdapter)`），不在类定义期装饰——能力类排在本类后面，定义期实例化会踩到未定义的名字。

### `BossAdapter.classify_fault`

BOSS 业务码 → 统一故障类（发对话/投递共用）：

- code 7 = 登录失效；
- 36 = 账号风控；
- 37 = 缺 `__zp_stoken__` 安全网关；
- 「开聊提醒」= 每日沟通配额。

### `JobRef.extra`（BOSS）

BOSS 对应 `job_id = encrypt_job_id`，`extra` 带 `security_id` / `lid` / `encrypt_boss_id`。

### `BossMessenger.conversation_state`

按聊天历史判门槛：对方有回话 = `REPLIED`；只有我方 = 等回复。历史探针当不了送达判据（见 `boss_jobs.config`），这里只判门槛。
