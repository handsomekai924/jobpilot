# `boss_web.static.legacy.js.task_watch` 协议笔记

> 摘自 `boss_web/static/legacy/js/task_watch.js` 的 JSDoc / 注释。

## 一句话

任务观察器：把「1.5s 轮询 status」换成「统一 WS 事件驱动」。

## 用法

各业务页用 `watchTask` 替换原来的 `setInterval` 轮询：

```js
const stop = watchTask(taskId, fetchStatus, {
  onStatus: (payload) => paint(payload),
  isDone: (payload) => ["done", "error", "cancelled"].includes(payload.status),
});
// 离开页面 / 任务结束时 stop()
```

## 细节

- WS 任务帧自带业务快照（`data.raw` 与各页原 HTTP status 同形状），收帧直接画，
  **不再回源打 HTTP**——事件密集时回源会在服务端日志里刷出一串 GET，和轮询没两样。
- 只有首帧与 WS 断线兜底才走 `fetchStatus`；断线回落 5s 轮询，连上即停。
- 进度帧按 200ms 窗口合帧（`COALESCE_MS`）：窗口内只画最后一帧；终态不排队，立刻画。
