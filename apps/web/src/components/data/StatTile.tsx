import type { ReactNode } from "react";
import { Box, LinearProgress, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

import { typeScale } from "../../theme/tokens";
import { mergeSx } from "../../theme/sx";

export interface StatTileProps {
  /** 一句话标签（sentence case，不带冒号） */
  label: string;
  /** 数字牌的值（调用方用 `fmtNumber` 格式化）；比例数字默认开，不加 tabular */
  value: ReactNode;
  caption?: ReactNode;
  /** 0–1 的单一比例 → 同色系 meter（蓝条蓝轨道），不用两片饼图 */
  meter?: number;
  sx?: SxProps<Theme>;
}

/**
 * KPI 数字牌（dataviz「stat tile」）：单个当前值 + 可选说明/同色系进度条。
 * 大数字不做展示字体、不加 tabular-nums（后者只留给表格列与坐标轴刻度）。
 */
export function StatTile({ label, value, caption, meter, sx }: StatTileProps) {
  const ratio = meter != null && Number.isFinite(meter) ? Math.min(1, Math.max(0, meter)) : null;

  return (
    <Box sx={mergeSx({ flex: "1 1 150px", minWidth: 150 }, sx)}>
      <Typography sx={{ ...typeScale.s, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ ...typeScale.xl, fontWeight: 600, mt: 0.25 }}>{value}</Typography>
      {ratio != null && (
        <LinearProgress
          variant="determinate"
          value={Math.round(ratio * 100)}
          aria-label={`${label}比例`}
          sx={{
            mt: 1,
            bgcolor: "color-mix(in srgb, var(--accent) 16%, transparent)",
            // 强制高对比模式下背景会被剥掉，填充退化成系统前景色实心
            "@media (forced-colors: active)": {
              bgcolor: "Canvas",
              "& .MuiLinearProgress-bar": { bgcolor: "CanvasText" },
            },
          }}
        />
      )}
      {caption != null && (
        <Typography sx={{ ...typeScale.xs, color: "text.secondary", mt: 0.5 }}>{caption}</Typography>
      )}
    </Box>
  );
}
