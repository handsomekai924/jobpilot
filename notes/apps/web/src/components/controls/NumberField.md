# `apps/web/src/components/controls/NumberField` 笔记

> 摘自 `apps/web/src/components/controls/NumberField.tsx` 的类型说明与实现注释。

## 一句话

数值输入：编辑中保留原始文本，失焦 / Enter 时解析、取整并夹到边界。

## 细节

### 提交时机

失焦 / Enter / 步进按钮 / 上下键；输入过程中不打断。空值或非法文本回退到上次提交值；外部值变化且未聚焦时同步草稿。

### 小数位

按 `step` 推断：`0.5` → 一位小数，`1` → 整数（四舍五入）。

### 步进按钮位置（对齐 Element Plus `controls-position`）

- `""`（默认）：减少按钮在输入框左侧、增加按钮在右侧，横向分列。按钮绝对定位压在输入框左右边缘，**不进** `startAdornment`——否则 MUI 会因 `adornedStart` 强制 label 常驻左上角，且 start adornment 会被下推 16px。
- `"right"`：两个按钮收进输入框右侧、上下排列（上增下减）。

无 label 时用 `hiddenLabel` 收掉为浮动 label 预留的上方内边距。步进按钮 `mousedown` 阻止默认，点了不抢输入框焦点，保持编辑态。
