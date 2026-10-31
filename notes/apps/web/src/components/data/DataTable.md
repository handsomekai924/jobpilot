# `apps/web/src/components/data/DataTable` 笔记

> 摘自 `apps/web/src/components/data/DataTable.tsx` 的说明与实现注释。

## 一句话

三张业务表统一的数据表：inset-grouped 行、悬停弱高亮、分离线不用硬边框。

## 细节

- 表格不自带 `overflow`：让外层 `ScrollArea` 同时管纵向 + 横向滚动，表头才能 sticky 钉在滚动区顶部（表头固定 + 表格内容区局部滚动）。
- 表头用 `position: sticky`；`borderCollapse` 必须用 `separate`——`collapse` 下 sticky 边线会丢。
- sticky 表头在分数滚动位置下，边线/边缘会抗锯齿出半透明缝，下方行从缝里透上来；用不透明背景色影子（`box-shadow: 0 2px 0 0 background.default`）压住接缝，影子画在边框盒之外，滚动中的行整段被遮住。
- 尾列可用 `hideOnNarrow` 在窄屏隐藏（`xs: none, md: table-cell`）；最外层 `minWidth: 560` 保底。
- 加载态显示骨架行；空数据走 EmptyState。
