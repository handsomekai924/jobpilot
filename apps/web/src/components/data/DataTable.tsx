/** 数据表：三张业务表统一行样式，表头固定、滚动交给外层 ScrollArea。 */

import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { typeScale } from "@/theme/tokens";
import { mergeSx } from "@/theme/sx";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/data/Skeleton";

/** 一列：渲染函数缺省时取 `row[key]`，`hideOnNarrow` 在窄屏隐藏。 */
export interface Column<T> {
  key: string;
  header: ReactNode;
  /** 单元格渲染；不给则取 row[key] */
  render?: (row: T) => ReactNode;
  width?: number | string;
  align?: "left" | "right" | "center";
  /** 窄屏隐藏（尾列优先） */
  hideOnNarrow?: boolean;
}

/** 数据表属性。 */
export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** 行内动作列渲染 */
  rowActions?: (row: T) => ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  emptyText?: string;
  /** 紧凑行高 */
  dense?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * 数据表（jobs/interview/match 三张表统一）：inset-grouped 行、
 * 悬停弱高亮、分离线不用硬边框（5.3 DataTable 行）。
 */
export function DataTable<T>({
  columns, rows, rowKey, onRowClick, rowActions,
  loading = false, skeletonRows = 5, emptyText = "暂无数据", dense = false, sx,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <Box sx={mergeSx({ display: "flex", flexDirection: "column", gap: 1, p: 2 }, sx)}>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} height={dense ? 32 : 44} />
        ))}
      </Box>
    );
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyText} />;
  }

  return (
    <Box sx={mergeSx({ minWidth: 0 }, sx)}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 560 }}>
        <Box component="thead">
          <Box component="tr">
            {columns.map((c) => (
              <Box
                component="th"
                key={c.key}
                sx={{
                  ...typeScale.s,
                  color: "text.secondary",
                  fontWeight: 590,
                  textAlign: c.align ?? "left",
                  width: c.width,
                  px: 2,
                  py: 1.25,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  whiteSpace: "nowrap",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  bgcolor: "background.default",
                  boxShadow: (t: Theme) => `0 2px 0 0 ${t.palette.background.default}`,
                  display: c.hideOnNarrow ? { xs: "none", md: "table-cell" } : "table-cell",
                }}
              >
                {c.header}
              </Box>
            ))}
            {rowActions !== undefined && (
              <Box
                component="th"
                sx={{
                  width: 96,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  bgcolor: "background.default",
                  boxShadow: (t: Theme) => `0 2px 0 0 ${t.palette.background.default}`,
                }}
              />
            )}
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((row) => (
            <Box
              component="tr"
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={{
                cursor: onRowClick ? "pointer" : "default",
                transition: "background-color 140ms cubic-bezier(0.16,1,0.3,1)",
                "&:hover": { bgcolor: (t: Theme) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)") },
                "&:not(:last-child) td": { borderBottom: "1px solid", borderColor: "divider" },
              }}
            >
              {columns.map((c) => (
                <Box
                  component="td"
                  key={c.key}
                  sx={{
                    px: 2,
                    py: dense ? 1 : 1.5,
                    textAlign: c.align ?? "left",
                    ...typeScale.bodySm,
                    maxWidth: 360,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: c.hideOnNarrow ? { xs: "none", md: "table-cell" } : "table-cell",
                  }}
                >
                  {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                </Box>
              ))}
              {rowActions !== undefined && (
                <Box component="td" sx={{ px: 2, py: dense ? 1 : 1.5, textAlign: "right" }}>
                  {rowActions(row)}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/** 表内主文案（职位名等） */
export function CellTitle({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ ...typeScale.bodySm, fontWeight: 590, color: "text.primary" }}>{children}</Typography>
  );
}
