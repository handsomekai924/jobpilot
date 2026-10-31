# `boss_web.core.limits` 协议笔记

> 摘自 `boss_web/core/limits.py` 的模块文档字符串 / `#` 注释。

## 一句话

站点限速/配额与投递熔断（`site_settings` 节流 + 每日配额 + 熔断）。

## 细节

限速是站点属性、执行是共享规则：`SiteLimits` 只是形状，怎么停怎么走由 `run_deliver` 与投递队列照着它办，站点不许自己另写一套限速逻辑。故障分类到动作的映射也定在这儿——站点只负责 `classify_fault` 如实归类（BOSS 的 code 36 / 开聊提醒这类语义留在站点侧），判不判停是共享层的事。

`boss_db.get_site_settings()` 是这张表的仓储口；本模块不碰 SQLite，`SiteLimits.from_mapping()` 认它的返回值，也认任何同名字段的 Mapping。

### 常量

`BREAKER_TRIP` = 退避类故障连续多少次就整批停——退避也没用，说明不是偶发限频。
