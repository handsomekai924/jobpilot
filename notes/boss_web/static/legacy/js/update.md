# `boss_web.static.legacy.js.update` 协议笔记

> 摘自 `boss_web/static/legacy/js/update.js` 的 JSDoc / 注释。

## 一句话

版本更新提示：首屏弹窗 + 挂机 toast + 应用内自更新进度。

## `startUpdateWatcher` 的推送源

- 跟首屏弹窗的分工：弹窗只在打开页面时出现一次；挂机靠这里。绝不弹窗，
  也不重复 toast 同一版。忽略水位线由 `should_prompt` 天然压住——被忽略的
  版本连 toast 都不会有。
- 推送源：服务端周期检测 / 手动刷新测到新版推 `update.available`；
  连接建立的 `hello` 帧带 `version` 结论，断线重连漏掉的推送靠它补。
- 每次拿到状态都会广播 `boss:update`，系统设置的「版本更新」页签跟着刷。
- `checked_at` 为 0 表示还没测过，别拿空结论盖掉已知状态。

## `connectProgressSocket`

- 通道只有统一 WS 的 `update.progress`（`hello` 里也带一份当前进度，swap
  断线重连后靠它续看）；旧的独立进度 WS 已随接口下线。
- swap 期 `onDown` 断开是预期的，只换一句提示；完成靠轮询接手。
