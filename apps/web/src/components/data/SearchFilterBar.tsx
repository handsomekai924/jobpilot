import type { ReactNode } from "react";
import { Box, Chip, TextField, InputAdornment } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { typeScale } from "../../theme/tokens";
import { mergeSx } from "../../theme/sx";

export interface FilterOption {
  value: string;
  label: string;
  /** 状态点色（可选） */
  tone?: string;
}

export interface SearchFilterBarProps {
  /** 搜索词（受控） */
  query: string;
  onQueryChange: (v: string) => void;
  /** 字段名（悬浮标签，点击后上移）；不给则只有占位文案 */
  label?: string;
  placeholder?: string;
  /** 一组快速筛选：单选 chip 组 */
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (v: string) => void;
  /** 右侧额外控件 */
  actions?: ReactNode;
  sx?: SxProps<Theme>;
}

/** 搜索 + 多维筛选一行收纳（5.3 SearchFilterBar：控件靠近所控内容）。 */
export function SearchFilterBar({
  query, onQueryChange, label, placeholder = "搜索…",
  filters, activeFilter, onFilterChange, actions, sx,
}: SearchFilterBarProps) {
  return (
    <Box
      sx={mergeSx(
        {
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
          "& .MuiChip-root": { ...typeScale.s },
        },
        sx,
      )}
    >
      <TextField
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        label={label}
        placeholder={placeholder}
        size="small"
        sx={{ flex: "1 1 220px", maxWidth: 360 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Box component="span" sx={{ color: "text.secondary" }} aria-hidden>⌕</Box>
              </InputAdornment>
            ),
          },
        }}
      />
      {filters !== undefined && filters.length > 0 && (
        <Box
          role="radiogroup"
          aria-label="筛选"
          sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}
        >
          {filters.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              size="small"
              onClick={() => onFilterChange?.(f.value)}
              role="radio"
              aria-checked={activeFilter === f.value}
              sx={(t) => ({
                bgcolor: activeFilter === f.value ? t.palette.primary.main : t.palette.surface2,
                color: activeFilter === f.value ? t.palette.primary.contrastText : t.palette.text.primary,
                "&:hover": {
                  bgcolor: activeFilter === f.value
                    ? t.palette.primary.main
                    : t.palette.mode === "dark" ? "rgba(120,120,128,0.42)" : "rgba(120,120,128,0.18)",
                },
              })}
            />
          ))}
        </Box>
      )}
      {actions !== undefined && <Box sx={{ ml: "auto", display: "flex", gap: 1, alignItems: "center" }}>{actions}</Box>}
    </Box>
  );
}
