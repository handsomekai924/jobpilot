/** 空态：统一「图标 + 标题 + 说明 + 可选动作」。 */

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

/** 空态属性。 */
export interface EmptyStateProps {
  /** 图标/字符（如 ◌） */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/** 空态：统一「图标 + 标题 + 说明 + 可选动作」。 */
export function EmptyState({ icon = "◌", title, description, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        py: 7,
        px: 3,
        textAlign: "center",
      }}
    >
      <Box sx={{ fontSize: 40, lineHeight: 1, color: "text.disabled", mb: 0.5 }}>{icon}</Box>
      <Typography variant="h4" sx={{ fontWeight: 600 }}>{title}</Typography>
      {description !== undefined && (
        <Typography variant="body1" sx={{ color: "text.secondary", maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {action !== undefined && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Box>
  );
}
