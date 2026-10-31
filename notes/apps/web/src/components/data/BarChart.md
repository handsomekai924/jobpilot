# `apps/web/src/components/data/BarChart` 笔记

> 摘自 `apps/web/src/components/data/BarChart.tsx` 的组件说明与实现注释。

## 一句话

横向条形图（名义类目排名），条末直接标注 + 表格孪生取数。

## 细节

### dataviz 规范

- 所有条同用 slot-1 蓝（`--accent`），名义类目不按数值渐变；
- 条粗约 14px（`barMaxWidth`），数据端 4px 圆角、基线端直角；
- 行距 2px 表面间隙（`barCategoryGap: "2px"`；`barGap` 是多系列间距，单系列用不到）；
- 行块高度 30px（24px 命中轨 + 间隙），整图高度 = 行数 × 30 + 12；
- 悬停整行出 tooltip（`trigger: "axis"`，命中区即行块），值先行、行标签与 hint 次之；
- 单系列不出图例——标题就是系列名。

### 布局

- `grid` 用 `containLabel` 自动给长短不一的类目标签留位，右留 8%；
- x 轴隐藏，满值只占 `TIP_RESERVE_PCT`（74%），条末右侧空出一行给直接标注；
- y 轴 `inverse`（首项在上），类目全部显示，基线用分割线本色、不出横向网格线。

### 无障碍

数值有表格孪生兜底（ChartCard 提供），整图挂 `role="img"` 与系列摘要 aria-label；空数据出 EmptyState，不挂空图。
