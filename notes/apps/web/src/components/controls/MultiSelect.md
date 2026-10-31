# `apps/web/src/components/controls/MultiSelect` 笔记

> 摘自 `apps/web/src/components/controls/MultiSelect.tsx` 的说明与注释。

## 一句话

多选下拉（行业等）：popover 材质弹层 + 勾选列表 + 清空。

## 细节

- 已选文案（legacy `paintLabel` 语义）：≤2 项列全名，否则「首项 等 N 项」。
- 与 `Select` 同一条焦点硬约束（缺陷清单「下拉框」）：鼠标收起后不把焦点留在触发器上（restore-focus 会把聚焦蓝框带回来），Esc 键盘收起保留焦点；边框跟随展开态而不是 `:focus`。
- 列表最多露 5 项（行高约 32px + 列表上下各 8px，`maxHeight: 176`），超出列表内滚动，底栏「清空」常驻。
- 勾选即回调（`onChange`），没有草稿提交步骤。
