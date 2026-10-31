# `apps/web/src/components/layout/ScrollArea` 笔记

> 摘自 `apps/web/src/components/layout/ScrollArea.tsx` 的说明与注释。

## 一句话

「整页固定 + 内部滚动」布局契约：页面根撑满裁溢出，滚动只发生在 `ScrollArea`。

## 细节

- 外层（ShellLayout / `CONTENT_SX`）占满视口且 `overflow: hidden`，页面整体不滚动；页面根用 `pageRootSx` 撑满内容区并裁掉溢出。
- `pageRootSx`：`flex: 1; minHeight: 0; display: flex; flexDirection: column; overflow: hidden`。
- `ScrollArea` 是唯一滚动条出现的地方（列表区 / 内容区），默认 `overflowY: auto`、`flex: 1`、`minHeight: 0`。
- 默认内边距（`p: 1.5`）给卡片阴影留白：滚动区是裁剪边界，padding 在裁剪区内，阴影伸进留白仍可见（`appleShadows` 软阴影约 12px）。
