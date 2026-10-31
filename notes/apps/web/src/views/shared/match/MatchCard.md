# `views.shared.match.MatchCard` 性能与交互笔记

> 摘自 `apps/web/src/views/shared/match/MatchCard.tsx` 的模块 docstring。

## 一句话

一条匹配结果卡：分数圆环 + 职位/公司 + 匹配理由 + 招呼语（可编辑 / 重打草稿 / 单条重跑）。

## 细节

旧版这里是「卡片 + 详情弹窗」两层；招呼语本来就在卡上改最顺手，这轮把详情收成卡内展开，
少一次弹窗跳转。重跑语义是「只改不增」——`matchApi.rematch` 原地替换这一条，列表不长行。

性能（缺陷「展开收起卡顿」）：`memo` 包一层，回调 props 一律「带 jid 的稳定引用」（id 由本卡
自己传出去），父层列表状态变化时只有 props 真变了的卡才重渲染。展开区不做高度动画——
height 逐帧整页 reflow 是卡顿根因，改成即时布局 + 仅 opacity 短淡入，收起即卸（点了立刻变）。
