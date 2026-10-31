/** 单选下拉：复用 TextField 骨架，菜单材质走 MuiMenu 主题。 */

import { useCallback, useRef, useState } from "react";
import { Box, MenuItem, TextField, Typography, type TextFieldProps, type SelectProps as MuiSelectProps } from "@mui/material";
import { typeScale } from "@/theme/tokens";
import type { SelectOption } from "@/components/controls/MultiSelect";

/** 单选下拉属性；`clearable` 时显示清除按钮。 */
export interface SelectProps extends Omit<TextFieldProps, "select" | "onChange" | "value"> {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** 「不限」空值项文案；null 则不加 */
  emptyLabel?: string | null;
  /** 有值时 hover / 聚焦显示清除按钮；默认 false */
  clearable?: boolean;
  /** 点清除按钮：先 onChange("")，再回调这里 */
  onClear?: () => void;
}

/**
 * 单选下拉：`TextField` 骨架 + MuiMenu 弹层。
 *
 * 选中即收起、立刻回调；鼠标收起不把焦点留在触发器上，键盘收起保留焦点。
 * `clearable` 的清除按钮叠在输入框右缘，点清除只清值、不展开下拉。
 */
export function Select({
  options, value, onChange, emptyLabel = "不限", clearable = false, onClear, slotProps, sx, ...rest
}: SelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  /** 收起下拉：键盘保留焦点，鼠标收起后补失焦。 */
  const handleClose = useCallback(
    (event: React.SyntheticEvent) => {
      setOpen(false);
      if (event.type === "keydown") return;
      const display = rootRef.current?.querySelector<HTMLElement>('[role="combobox"]');
      if (!display) return;
      setTimeout(() => {
        if (document.activeElement === display) display.blur();
        else display.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      }, 0);
    },
    [],
  );

  /** Select 槽的收口配置：不等收起动画、不回填焦点、菜单限高。 */
  const selectSlot: Partial<MuiSelectProps> = {
    onOpen: () => setOpen(true),
    onClose: handleClose,
    MenuProps: {
      transitionDuration: { appear: 120, enter: 120, exit: 0 },
      slotProps: {
        root: { disableRestoreFocus: true },
        list: { sx: { maxHeight: 256 } },
      },
    },
  };

  /** 清空当前值，不触发下拉展开或表单提交。 */
  const clear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange("");
    onClear?.();
  };

  const showClear = clearable && value !== "" && !rest.disabled;

  return (
    <Box ref={rootRef} sx={{ display: "contents" }}>
      <TextField
        select
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={[
          {
            "& .MuiSelect-icon": { transition: "transform 160ms ease" },
            "&:hover .select-clear, &:focus-within .select-clear": { opacity: 1, pointerEvents: "auto" },
            "& .MuiSelect-select:focus-visible": { outline: "none" },
            ...(open ? { "& .MuiFilledInput-root": { borderColor: "primary.main" } } : {}),
          },
          ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
        ]}
        slotProps={{
          ...slotProps,
          input: {
            ...(slotProps?.input as Record<string, unknown> | undefined),
            endAdornment: showClear ? (
              <Box
                component="button"
                type="button"
                className="select-clear"
                aria-label="清除"
                onClick={clear}
                sx={{
                  position: "absolute",
                  right: 32,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  p: 0,
                  border: 0,
                  borderRadius: "50%",
                  bgcolor: "text.disabled",
                  color: "background.paper",
                  fontSize: 9,
                  lineHeight: 1,
                  cursor: "pointer",
                  opacity: 0,
                  pointerEvents: "none",
                  transition: "opacity 120ms ease",
                  zIndex: 1,
                  "&:hover": { bgcolor: "text.secondary" },
                }}
              >
                ✕
              </Box>
            ) : undefined,
          },
          select: { ...(slotProps?.select as Partial<MuiSelectProps> | undefined), ...selectSlot },
        } as TextFieldProps["slotProps"]}
      >
        {emptyLabel !== null && <MenuItem value="">{emptyLabel}</MenuItem>}
        {options.length === 0 && (
          <Typography role="presentation" sx={{ ...typeScale.bodySm, color: "text.secondary", px: 2, py: 1 }}>
            暂无选项
          </Typography>
        )}
        {options.map((o) => (
          <MenuItem key={o.code} value={o.code}>{o.name}</MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
