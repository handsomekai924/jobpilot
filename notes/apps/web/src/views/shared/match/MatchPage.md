# `views.shared.match.MatchPage` 历史笔记

> 摘自 `apps/web/src/views/shared/match/MatchPage.tsx` 的模块 docstring。

## 一句话

人岗匹配共用页：匹配工作台 / 分析历史 / 招呼语三段。

## 细节

迁自旧壳 `match.js` + `match_workbench.js` + `match_history.js` + `greeting_prompt.js`。
旧「匹配」页混进来的「发对话 / 投递」是平台作用域功能（要登录态、发消息走各家通道），
归 M3 的 `deliver` 页——这页只留一条说明，不摆假按钮。

按设置页的分段范式拆分：`TABS` + 每段一个自包含组件，切段只换右侧内容。
页面级状态（简历 / 当前分析 / matches / 草稿 / 任务快照）挂在壳上，切段不丢；
各段自己的表单与列表状态跟设置页一样，切走即卸、回来重拉。

## 实现备注

任务进度以 WS 推的统一快照优先（比轮询快），断线时业务快照轮询（2s）兜底。
历史载入先切工作台、详情在背后拉，结果区用骨架屏占位，避免布局跳动。
传工作台的 setter 保持稳定引用，MatchCard 靠 memo 挡重渲染。
