import { useCallback, useRef, useState } from "react";
import { Box, MenuItem, TextField, Typography, type TextFieldProps, type SelectProps as MuiSelectProps } from "@mui/material";
import { typeScale } from "../../theme/tokens";
import type { SelectOption } from "./MultiSelect";

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
 * 单选下拉（表单散件）：复用 TextField 骨架 + 弹层材质走 MuiMenu theme。
 *
 * 两条体验硬约束（缺陷清单「下拉框 / 批次选择下拉框」）：
 * - 选中即收起（exit 动画 0ms）并立刻回调，不等动画走完才执行请求；
 * - 鼠标收起（点选项 / 点外面）后不把焦点留在触发器上，否则 MUI 的
 *   restore-focus 会把聚焦蓝框又带回来。键盘收起（Esc / 键盘选中）保留焦点。
 *
 * 展开 / 收起时箭头带旋转过渡；`clearable` 的清除按钮叠在输入框右缘（箭头左侧），
 * 不参与 Select 的触发器，所以点清除只清值、不会展开下拉。
 */
export function Select({
  options, value, onChange, emptyLabel = "不限", clearable = false, onClear, slotProps, sx, ...rest
}: SelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(
    (event: React.SyntheticEvent) => {
      setOpen(false);
      // 键盘收起保留焦点（Esc 时焦点本来就在触发器上）
      if (event.type === "keydown") return;
      const display = rootRef.current?.querySelector<HTMLElement>('[role="combobox"]');
      if (!display) return;
      // SelectInput 只在 !open 时把 blur 转给 FormControl，而收起回调里 open 还是 true：
      // 立刻 blur 会被它吞掉，Mui-focused 就留在输入框上。等它提交 open=false 后再补：
      // 焦点还在触发器上就真失焦；已经点到别处就补发 focusout（不抢回用户刚点的焦点）。
      setTimeout(() => {
        if (document.activeElement === display) display.blur();
        else display.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      }, 0);
    },
    [],
  );

  // TextField 的 select 槽是 SelectInput：收口 Menu 行为（不等收起动画、不回填焦点）
  const selectSlot: Partial<MuiSelectProps> = {
    onOpen: () => setOpen(true),
    onClose: handleClose,
    MenuProps: {
      transitionDuration: { appear: 120, enter: 120, exit: 0 },
      slotProps: {
        root: { disableRestoreFocus: true },
        // 菜单最多露 5 项（MenuItem 48px × 5 + MenuList 上下内边距 16px），超出滚动
        list: { sx: { maxHeight: 256 } },
      },
    },
  };

  const clear = (e: React.MouseEvent) => {
    // 别冒泡成表单提交 / 点触发器展开
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
            // 焦点态由输入框边框表达；压掉全局 :focus-visible 描边，避免开菜单抢焦点时描边一闪
            "& .MuiSelect-select:focus-visible": { outline: "none" },
            // 菜单展开期间焦点在菜单里，用展开态兜住边框，避免聚焦边框闪一下就消失
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
          // 非 MenuItem：占位提示，不参与选中与键盘遍历
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
