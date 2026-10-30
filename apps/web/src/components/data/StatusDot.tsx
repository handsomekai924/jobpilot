import { Box, Typography } from "@mui/material";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export type StatusTone = "ok" | "warn" | "danger" | "accent" | "idle" | "busy";

export interface StatusDotProps {
  tone?: StatusTone;
  /** 状态文字（状态不只靠颜色，pill/dot 必带文字——DESIGN.md Accessibility） */
  label?: ReactNode;
  size?: number;
  /** busy 默认脉动；reduced-motion 下自动停 */
  pulse?: boolean;
}

const toneColor: Record<StatusTone, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  accent: "var(--accent)",
  idle: "var(--text-3)",
  busy: "var(--accent)",
};

/** 会话/任务状态信号点。 */
export function StatusDot({ tone = "idle", label, size = 8, pulse = tone === "busy" }: StatusDotProps) {
  const reduced = useReducedMotion();
  const shouldPulse = pulse && !reduced;

  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <Box
        component={motion.span}
        animate={shouldPulse ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
        transition={shouldPulse ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : undefined}
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          bgcolor: toneColor[tone],
          display: "inline-block",
          flex: "0 0 auto",
        }}
      />
      {label !== undefined && (
        <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
      )}
    </Box>
  );
}
