# `apps/web/src/components/data/EChart` 笔记

> 摘自 `apps/web/src/components/data/EChart.tsx` 的说明与实现注释。

## 一句话

ECharts 生命周期壳 + 主题取色 hook；canvas 内容靠 aria-label 与表格孪生兜底。

## 细节

- 按需注册部件（条/柱 + 网格 + tooltip + canvas），不整包引入 echarts。
- canvas 吃不到 CSS 变量，配色从 MUI 主题取具体色值；主题模式来自 `useTheme()`，由 ThemeModeProvider 接线，模式一变 option 里的颜色跟着变（数据或主题变化整体重铺，`notMerge` 防止轴范围、标注下标残留旧状态）。
- jsdom 没有 `ResizeObserver` 也没有 canvas：`init` 拿不到实例时连 resize/dispose 一起跳过；有 `ResizeObserver` 做像素级跟随，否则降级到 window resize。
- 无障碍：canvas 内容屏读不透，整图挂 `role="img"` + 系列摘要 `aria-label`；强制高对比（forced-colors）下 canvas 不会跟着换系统色，完整取数走 ChartCard 的表格孪生。
