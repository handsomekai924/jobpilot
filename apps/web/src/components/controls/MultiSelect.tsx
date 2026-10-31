/** 多选下拉（行业等）：弹层勾选列表 + 清空，勾选即回调。 */

import { useMemo, useRef, useState } from "react";
import { Box, Checkbox, Popover, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { typeScale } from "@/theme/tokens";
import { mergeSx } from "@/theme/sx";
import { Button } from "@/components/controls/Button";

/** 下拉选项：code 为提交值，name 为显示名。 */
export interface SelectOption {
  code: string;
  name: string;
}

/** 多选下拉属性。 */
export interface MultiSelectProps {
  options: SelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** 触发器上方的字段名 */
  label?: string;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

/** 已选文案：≤2 项列全名，否则「首项 等 N 项」（legacy paintLabel 语义）。 */
function summarize(options: SelectOption[], values: string[], placeholder: string): string {
  const names = options.filter((o) => values.includes(o.code)).map((o) => o.name);
  if (names.length === 0) return placeholder;
  return names.length <= 2 ? names.join("、") : `${names[0]} 等 ${names.length} 项`;
}

/** 多选下拉：弹层勾选列表 + 清空；收起时鼠标不保留焦点、Esc 保留焦点（详见 notes）。 */
export function MultiSelect({
  options, values, onChange, placeholder = "不限", label, disabled = false, sx,
}: MultiSelectProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const summary = useMemo(() => summarize(options, values, placeholder), [options, values, placeholder]);
  const empty = values.length === 0;
  const open = anchor != null;

  return (
    <Box sx={mergeSx({ display: "flex", flexDirection: "column", gap: 0.5 }, sx)}>
      {label !== undefined && (
        <Typography sx={{ ...typeScale.xs, color: "text.secondary" }}>{label}</Typography>
      )}
      <Box
        component="button"
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          minWidth: 140,
          height: 36,
          px: 1.5,
          border: "1px solid transparent",
          borderColor: open ? "primary.main" : "transparent",
          borderRadius: "12px",
          bgcolor: "surface2",
          color: empty ? "text.disabled" : "text.primary",
          ...typeScale.bodySm,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "border-color 120ms ease",
          "&:focus": { outline: "none" },
          "&:focus-visible": { borderColor: "primary.main" },
          "&::after": { content: '"▾"', color: "text.secondary", fontSize: 11 },
        }}
      >
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {summary}
        </Box>
      </Box>

      <Popover
        open={anchor != null}
        anchorEl={anchor}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        onClose={(_event, reason) => {
          if (reason === "escapeKeyDown") triggerRef.current?.focus();
          else triggerRef.current?.blur();
          setAnchor(null);
        }}
        slotProps={{
          root: { disableRestoreFocus: true },
          paper: {
            sx: {
              mt: 1,
              borderRadius: "16px",
              minWidth: 220,
              border: "1px solid",
              borderColor: "divider",
            },
          },
        }}
      >
        <Box role="listbox" aria-multiselectable="true" sx={{ py: 1, maxHeight: 176, overflowY: "auto" }}>
          {options.length === 0 && (
            <Typography sx={{ ...typeScale.bodySm, color: "text.secondary", px: 2, py: 1 }}>暂无选项</Typography>
          )}
          {options.map((o) => {
            const checked = values.includes(o.code);
            return (
              <Box
                key={o.code}
                component="label"
                role="option"
                aria-selected={checked}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.5,
                  cursor: "pointer",
                  "&:hover": { bgcolor: (t: Theme) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)") },
                }}
              >
                <Checkbox
                  size="small"
                  checked={checked}
                  onChange={() =>
                    onChange(checked ? values.filter((v) => v !== o.code) : [...values, o.code])
                  }
                  disableRipple
                />
                <Typography sx={{ ...typeScale.bodySm }}>{o.name}</Typography>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1.5, pb: 1.5 }}>
          <Button size="small" variant="plain" onClick={() => onChange([])}>清空</Button>
        </Box>
      </Popover>
    </Box>
  );
}
