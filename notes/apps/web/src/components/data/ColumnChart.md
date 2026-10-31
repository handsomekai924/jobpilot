# `apps/web/src/components/data/ColumnChart` 笔记

> 摘自 `apps/web/src/components/data/ColumnChart.tsx` 的组件说明与实现注释。

## 一句话

柱状图（离散序列量级比较），选择性柱帽标注 + 表格孪生取数。

## 细节

### dataviz 规范

- 柱同用 slot-1 蓝（`--accent`），柱宽 ≤18px、柱帽 4px 圆角、基线端直角，柱间 2px 表面间隙（`barCategoryGap`）；
- 柱帽直接标注只标极值（选择性标注），其余数值靠 tooltip 与表格孪生；
- 命中区是整条槽位（≥24px，`trigger: "axis"`），也兜住 0 值；
- x 标签过密（>8 根柱）时隔一个显示，由 `formatter` 控制，不交给自动隐藏（不硬塞不裁切）。

### 刻度与边距

- y 刻度取整到 1/2/5×10^k：`mid` 之上再翻倍封顶，画 0/mid/top 三条；
- 网格线 1px 实线退一档（`opacity: 0.6`），零/轴线用分割线本色稍强；
- 边距：左 36px 放 y 刻度，顶 20px 给柱帽标注，底 22px 是 x 标签带；
- canvas 画不了 tabular-nums，等宽数字只落表格孪生的数值列。

### 无障碍

整图 `role="img"` + 系列摘要；空数据出 EmptyState，不挂空图。
