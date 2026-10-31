/** 布局契约与页面内滚动区：整页固定，滚动只发生在 ScrollArea。 */

import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import Box from "@mui/material/Box";

import { mergeSx } from "../../theme/sx";

/**
 * 整页固定 + 内部滚动（布局契约）：页面根撑满内容区并裁掉溢出，
 * 滚动只发生在 `ScrollArea` 里。
 */
export const pageRootSx = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
} as const;

/**
 * 页面内部滚动区：滚动条只出现在这里（列表区 / 内容区）。
 * 默认内边距给卡片阴影留白。
 */
export function ScrollArea({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box sx={mergeSx({ flex: 1, minHeight: 0, overflowY: "auto", p: 1.5 }, sx)}>{children}</Box>
  );
}
