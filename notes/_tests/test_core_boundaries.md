# `tests.test_core_boundaries` 边界守卫笔记

> 摘自 `tests/test_core_boundaries.py` 的模块 docstring / docstring / `#` 注释。

## 一句话

守住 `boss_web/core/`（共享内核）与 `boss_web/core/adapters/`（站点实现）之间的边界。

## 细节

共享层的边界守卫（todo3 第三节：依赖方向、import 禁令）。

`boss_web/core/` 是多平台抽象的内核，`boss_web/core/adapters/` 才是站点实现。
两者之间这条线必须守住：站点私有语义（BOSS 的 code 36 / 开聊提醒 /
`__zp_stoken__` 这些）只能留在 adapter 与站点任务里，**不许渗进共享层的代码
字符串**——一旦渗进来，接第二个站点就会把 BOSS 的风控文案原样甩给别家用户。

扫的是 `ast.Constant` 且跳过 docstring：docstring 里提这些词是文档（写明边界），
代码字符串里冒出来才是漏。同理 import 禁令只盯 `boss_*` 与 server 的业务层，
内核不许反向依赖它们。

### `SITE_PRIVATE_WORDS`

站点私有语义的指纹；共享层的代码字符串里一个都不该出现。

- `开聊提醒`：BOSS 每日沟通配额的专属提醒
- `每日沟通`：同上，BOSS 的配额语义
- `code 36`：BOSS 账号风控
- `code 37`：BOSS 缺 `__zp_stoken__` 的安全网关
- `安全网关`、`__zp_stoken__`、`stoken`、`zhipin`、`BOSS直聘`、`求职期望`、`encrypt_job_id`、`securityId`、`security_id`

### `FORBIDDEN_IMPORTS`

内核不许反向依赖的模块：`boss_jobs`、`boss_login`、`boss_filter`、`boss_db`、
`boss_web.services`、`boss_web.api`、`boss_web.app`、`boss_web.cli`。

### `test_共享层不掺站点私有语义`

这条守卫是**活的**：`core/limits.py` 曾把「安全网关」写进熔断的停批原因，
就是它逮住的。
