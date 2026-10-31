# `boss_web.services.task_runtime` 协议笔记

> 摘自 `boss_web/services/task_runtime.py` 的模块文档字符串 / docstring。

## 一句话

统一任务运行时：任务模型、并发策略、事件总线（WS 广播）。

## 细节

设计见 `docs/task-center-and-unified-ws.md`。

`track()` 会把业务任务的 `push()` / `set_status()` 包一层，改完立刻调
`snapshot()` 广播。所以**任务对象自己的锁必须是 `threading.RLock`**——
业务代码常常持锁调 `push()`，包一层后会同线程再进 `snapshot()`；`Lock`
会当场死锁（`LoginTask` 一开始就用的 `RLock`，其余任务对象已对齐）。

### `TaskHub.occupy`

占用按 `(site, key)` 记账——站点是通道边界，同型任务按站点排队
（docs 6.5）；站点为空的共用任务退化成原来的全局语义。

- `GLOBAL_SINGLE`：同站点该类型已有未结束任务就拒；
- `PER_KEY_SINGLE`：同站点同 key 未结束就拒；
- `UNLIMITED`：只看 `max_parallel`（按站点计）；
- 互斥组：同站点同 `mutual_group` 里其它类型有未结束任务也拒
  （抓取/补抓共用**站点**通道，跨站点互不干扰）。
