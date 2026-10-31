# `apps/web/src/components/controls/Cascader` 笔记

> 摘自 `apps/web/src/components/controls/Cascader.tsx` 的组件说明与实现注释。

## 一句话

城市/行业级联选择：列式下钻，单选叶子取值、多选父级导航叶子勾选。

## 细节

### 取值语义（legacy `ui.js` cascader）

- 单选（城市）：带子级的节点只展开、不回调；叶子即取值，接口只吃市/区 code。
- 多选（行业）：父级只导航，叶子勾选进草稿，「确定」才提交；「清空」直接回调空值。

### 焦点与展开态

与 `Select` 同一条体验硬约束（缺陷清单「下拉框」）：

- 鼠标收起（选中 / 点外面）后主动失焦，不把焦点留在触发器上——MUI 的 restore-focus 会把聚焦蓝框又带回来；
- Esc 键盘收起保留焦点；
- 触发器边框跟随**展开态**而非 `:focus`：点开后 Popover 抢焦点，`:focus` 边框会一闪而过；
- 键盘 Tab 聚焦（未展开）时用 `:focus-visible` 单独保留边框。

### 布局

- 每列最多露 5 项（行高约 36px，`maxHeight: 180`），超出列内滚动；
- 多选勾选框只出现在叶子上；有子级的节点尾部显示 `›`。
