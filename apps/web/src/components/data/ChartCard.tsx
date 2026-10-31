/** 图表容器：标题/说明 + 图·表切换，表格孪生保证非悬停也能取数。 */

import { useState, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

import { SegmentedControl } from "../controls/SegmentedControl";
import { Surface } from "../surfaces/Surface";
import { typeScale } from "../../theme/tokens";
import { mergeSx } from "../../theme/sx";

/** 表格孪生的形状：第一列左对齐，其余右对齐（数值列）。 */
export interface ChartTable {
  head: ReactNode[];
  rows: ReactNode[][];
}

/** 图表属性；`table` 是每张图必带的表格孪生。 */
export interface ChartCardProps {
  title: string;
  caption?: string;
  /** 表格孪生：每张图必带——tooltip 之外的非悬停取数路径（dataviz 无障碍硬约束） */
  table: ChartTable;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * 图表容器：标题/说明 + 图·表切换；内容自适应增高，不做固定高度，
 * 避免卡内出滚动条（x 轴标签带算在图里）。
 */
export function ChartCard({ title, caption, table, children, sx }: ChartCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <Surface sx={mergeSx({ display: "flex", flexDirection: "column" }, sx)}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ ...typeScale.bodySm, fontWeight: 590 }}>{title}</Typography>
          {caption ? (
            <Typography sx={{ ...typeScale.s, color: "text.secondary", mt: 0.25 }}>{caption}</Typography>
          ) : null}
        </Box>
        <SegmentedControl
          size="sm"
          value={view}
          onChange={(v) => setView(v)}
          options={[
            { value: "chart", label: "图表" },
            { value: "table", label: "表格" },
          ]}
          aria-label={`${title}视图切换`}
        />
      </Box>
      {view === "chart" ? children : <TableTwin table={table} />}
    </Surface>
  );
}

/** 表格孪生：与 DataTable 同一套视觉语言，但不设最小宽度（卡片里不出横滚就别出）。 */
function TableTwin({ table }: { table: ChartTable }) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
        <Box component="thead">
          <Box component="tr">
            {table.head.map((h, i) => (
              <Box
                key={i}
                component="th"
                scope="col"
                sx={{
                  ...typeScale.s,
                  fontWeight: 590,
                  color: "text.secondary",
                  textAlign: i === 0 ? "left" : "right",
                  px: 1.5,
                  py: 1,
                  whiteSpace: "nowrap",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                {h}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {table.rows.map((row, ri) => (
            <Box key={ri} component="tr">
              {row.map((cell, ci) => (
                <Box
                  key={ci}
                  component="td"
                  sx={{
                    ...typeScale.s,
                    textAlign: ci === 0 ? "left" : "right",
                    px: 1.5,
                    py: 1,
                    whiteSpace: "nowrap",
                    fontVariantNumeric: ci === 0 ? "inherit" : "tabular-nums",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {cell}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
