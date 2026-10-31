/** 匹配度圆环（0–100）：≥80 绿 / ≥60 蓝 / ≥40 橙 / 其余红。 */

import { Box, Typography, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";

/** 分数环属性。 */
export interface ScoreRingProps {
  /** 0–100 */
  score: number;
  label?: string;
  size?: number;
}

/** 按分数段取语义色。 */
function ringColor(score: number, theme: Theme): string {
  if (score >= 80) return theme.palette.success.main;
  if (score >= 60) return theme.palette.primary.main;
  if (score >= 40) return theme.palette.warning.main;
  return theme.palette.error.main;
}

/** 匹配度圆环（0–100）。语义色：≥80 绿 / ≥60 蓝 / ≥40 橙 / 其余红。 */
export function ScoreRing({ score, label, size = 56 }: ScoreRingProps) {
  const theme = useTheme();
  const stroke = Math.max(3, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <Box sx={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={theme.palette.surface2}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={ringColor(clamped, theme)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 320ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <Box
        sx={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Typography component="span" sx={{ fontSize: size / 4.2, fontWeight: 700, lineHeight: 1 }}>
          {Math.round(clamped)}
        </Typography>
        {label !== undefined && (
          <Typography component="span" sx={{ fontSize: size / 8, color: "text.secondary", lineHeight: 1.2 }}>
            {label}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
