/** 小胶囊标签：语义色只用在状态（DESIGN.md Color Strategy）。 */

import { Box, type SxProps, type Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { typeScale } from "../../theme/tokens";
import { mergeSx } from "../../theme/sx";

/** 胶囊色调：静态 / 成功 / 警告 / 危险 / 强调。 */
export type PillTone = "static" | "ok" | "warn" | "danger" | "accent";

/** 胶囊属性。 */
export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/** 各色调的底色与前景色。 */
const toneSx: Record<PillTone, SxProps<Theme>> = {
  static: (t) => ({ bgcolor: t.palette.surface2, color: t.palette.text.secondary }),
  ok: (t) => ({ bgcolor: alpha(t.palette.success.main, 0.15), color: t.palette.success.main }),
  warn: (t) => ({ bgcolor: alpha(t.palette.warning.main, 0.15), color: t.palette.warning.main }),
  danger: (t) => ({ bgcolor: alpha(t.palette.error.main, 0.15), color: t.palette.error.main }),
  accent: (t) => ({ bgcolor: alpha(t.palette.primary.main, 0.15), color: t.palette.primary.main }),
};

/** 小胶囊标签：语义色只用在状态（DESIGN.md Color Strategy）。 */
export function Pill({ tone = "static", children, sx }: PillProps) {
  return (
    <Box
      component="span"
      sx={mergeSx(
        {
          display: "inline-flex",
          alignItems: "center",
          px: 1.25,
          height: 22,
          borderRadius: "999px",
          ...typeScale.s,
          fontWeight: 590,
          whiteSpace: "nowrap",
        },
        toneSx[tone],
        sx,
      )}
    >
      {children}
    </Box>
  );
}
