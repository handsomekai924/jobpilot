# `apps/web/src/components/controls/Select` 笔记

> 摘自 `apps/web/src/components/controls/Select.tsx` 的组件说明与实现注释。

## 一句话

单选下拉：复用 TextField 骨架，菜单材质走 MuiMenu 主题。

## 细节

### 两条体验硬约束（缺陷清单「下拉框 / 批次选择下拉框」）

- 选中即收起（exit 动画 0ms）并立刻回调，不等动画走完才发请求；
- 鼠标收起（点选项 / 点外面）后不把焦点留在触发器上，否则 MUI 的 restore-focus 会把聚焦蓝框带回来；键盘收起（Esc / 键盘选中）保留焦点。

### 收起时补 blur 的原因

`SelectInput` 只在 `!open` 时把 blur 转给 `FormControl`，而收起回调里 `open` 还是 true：立刻 blur 会被它吞掉，`Mui-focused` 留在输入框上。所以等一轮事件循环（`setTimeout(..., 0)`）后再处理：

- 焦点还在触发器上 → 真失焦；
- 已点到别处 → 补发 `focusout`，不抢回用户刚点的焦点。

### 其他

- 菜单最多露 5 项（MenuItem 48px × 5 + MenuList 上下内边距 16px），超出滚动（`maxHeight: 256`）。
- 箭头带 160ms 旋转过渡；展开期间用展开态兜住输入框边框。
- `clearable` 的清除按钮叠在输入框右缘（箭头左侧），不参与 Select 触发器，所以点清除只清值、不展开下拉；鼠标收起不回填焦点。
