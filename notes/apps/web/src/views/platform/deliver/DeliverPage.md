# `apps/web/src/views/platform/deliver/DeliverPage` 笔记

> 摘自 `apps/web/src/views/platform/deliver/DeliverPage.tsx` 的模块说明与注释。

## 一句话

平台作用域的发对话与投递页：门槛两路径 + 配额 + 发送清单。

## 细节

### 一次调用跑完整站投递

一次 `POST /deliver/start` 后端把这一站的投递行为跑完；BOSS 上那就是**打招呼**（生产 `deliver_task.py`：串行发招呼语 + 冷却窗 / 每日配额 / 节流）。前端不拆两步调用：`caps.delivery.apply_gate` 只决定这里**怎么解释**，不决定调哪个接口。

**门槛是解释性文案，不是运行时分支**——`core/flow.run_deliver` 的「发对话 → 过门槛 → 投简历」模板还没接进生产（真投简历是后续能力），见 `docs/console-migration-parity.md` §三第 9 条。

配额 / 节流来自 `site_settings`（任务快照的 `limits`），到顶后端整批停住并落账。发送进度不在本页画，统一在任务中心看；本页只跟到结束好刷新状态。

### 数据形状

- `analysis.matches[]` 是匹配结果行，出门时补上招呼冷却字段；JD 不在匹配行里，由悬浮卡第一次悬停时按需拉详情。
- `deliver.status.limits` 的 `interval` 是实际生效的条间隔秒（不是设置页那个毫秒值）；`quota_left` 为 `null` = 不限，别当 0；`apply_enabled === false` = 只发对话不投简历。
- `stopped_reason` 空串表示没停，不能渲染成「未知原因」。

### 可发送预检（legacy `sendRestriction`）

按匹配时安全快照判：缺快照 / 公司黑名单 / JD 黑名单 / JD 规则未检查 / JD 状态不完整 / 职位状态不完整都不可发。门槛判定在后端，这里只是给人看的预检。

可发送候选还要满足：有招呼语、未发过、不在冷却里。一键发送后端会自动排除受限职位；选中 / 手动模式需显式确认才允许发送。
