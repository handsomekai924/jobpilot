import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Box, type TextFieldProps } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { TextField } from "./TextField";
import { mergeSx } from "../../theme/sx";

export interface NumberFieldProps extends Omit<TextFieldProps, "type" | "value" | "onChange" | "inputProps"> {
  value: number;
  /** 提交时机：失焦 / Enter / 步进按钮 / 上下键；输入过程中不打断 */
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** 步进量，默认 1；输入的小数位按它推断（0.5 → 一位小数） */
  step?: number;
  /**
   * 步进按钮位置（对齐 Element Plus InputNumber 的 controls-position）：
   * - ""（默认）：减少按钮在输入框左侧、增加按钮在右侧，横向分列；
   * - "right"：两个按钮收进输入框右侧、上下排列（上增下减）。
   */
  controlsPosition?: "" | "right";
}

function decimalsOf(step: number): number {
  const text = String(step);
  return text.includes(".") ? text.split(".")[1].length : 0;
}

/**
 * 数值输入（采集参数这类表单散件）：编辑中保留原始文本（允许清空、逐字输入），
 * 失焦 / Enter 时再解析、按小数位取整并夹到 [min, max]，空值回退到上次提交值。
 */
export function NumberField({
  value, onChange, min, max, step = 1, disabled, label, controlsPosition = "",
  onFocus, onBlur, onKeyDown, slotProps, sx, "aria-label": ariaLabel, ...rest
}: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  /** 最近一次已提交值，用来识别外部更新 */
  const committed = useRef(value);
  const decimals = decimalsOf(step);

  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  /** 当前文本解析出的数值；空 / 非法时用上次提交值 */
  function currentValue(): number {
    const text = draft.trim();
    const n = Number(text);
    return text !== "" && !Number.isNaN(n) ? n : committed.current;
  }

  function commit(next: number) {
    const rounded = decimals > 0 ? Number(next.toFixed(decimals)) : Math.round(next);
    const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, rounded));
    committed.current = bounded;
    setDraft(String(bounded));
    if (bounded !== value) onChange(bounded);
  }

  const nudge = (dir: 1 | -1) => commit(currentValue() + dir * step);
  const atMin = min !== undefined && currentValue() <= min;
  const atMax = max !== undefined && currentValue() >= max;
  const atRight = controlsPosition === "right";
  const buttonSx = atRight ? { width: 22, height: 14 } : { width: 24, height: 24 };

  const decrease = (
    <StepButton
      label={ariaLabel ? `减少${ariaLabel}` : "减少"}
      disabled={disabled || atMin}
      onClick={() => nudge(-1)}
      sx={buttonSx}
    >
      {atRight ? <Chevron dir="down" /> : <Sign kind="minus" />}
    </StepButton>
  );
  const increase = (
    <StepButton
      label={ariaLabel ? `增加${ariaLabel}` : "增加"}
      disabled={disabled || atMax}
      onClick={() => nudge(1)}
      sx={buttonSx}
    >
      {atRight ? <Chevron dir="up" /> : <Sign kind="plus" />}
    </StepButton>
  );

  const hasLabel = Boolean(label);

  const common: TextFieldProps = {
    ...rest,
    label,
    disabled,
    value: draft,
    autoComplete: "off",
    onChange: (e) => setDraft(e.target.value),
    onFocus: (e) => {
      setFocused(true);
      onFocus?.(e);
    },
    onBlur: (e) => {
      setFocused(false);
      commit(currentValue());
      onBlur?.(e);
    },
    onKeyDown: (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit(currentValue());
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nudge(1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        nudge(-1);
      }
      onKeyDown?.(e);
    },
  };

  const mergedSlotProps = {
    ...slotProps,
    // 无 label 时用 hiddenLabel 收掉为浮动 label 预留的上方内边距
    root: {
      hiddenLabel: !hasLabel,
      ...(slotProps?.root as Record<string, unknown> | undefined),
    },
    htmlInput: {
      role: "spinbutton",
      inputMode: "decimal",
      "aria-valuemin": min,
      "aria-valuemax": max,
      "aria-valuenow": currentValue(),
      ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      ...(slotProps?.htmlInput as Record<string, unknown> | undefined),
    },
    input: {
      ...(slotProps?.input as Record<string, unknown> | undefined),
      ...(atRight
        ? {
            endAdornment: (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {increase}
                {decrease}
              </Box>
            ),
          }
        : {}),
    },
  } as TextFieldProps["slotProps"];

  if (atRight) {
    return (
      <TextField
        {...common}
        slotProps={mergedSlotProps}
        sx={mergeSx({ "& .MuiFilledInput-root": { pr: 0.75 } }, sx)}
      />
    );
  }

  /*
   * 默认布局：按钮绝对定位压在输入框左右边缘（Element Plus 的做法），不进 startAdornment——
   * 否则 MUI 会因 adornedStart 强制 label 常驻左上角，且 start adornment 会被下推 16px。
   */
  return (
    <Box sx={mergeSx({ position: "relative", display: "inline-flex", minWidth: 0 }, sx)}>
      <Box sx={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
        {decrease}
      </Box>
      <TextField
        {...common}
        slotProps={mergedSlotProps}
        sx={{
          flex: 1,
          minWidth: 0,
          "& .MuiFilledInput-input": { pl: "40px", pr: "40px" },
          ...(hasLabel ? { "& .MuiInputLabel-root": { left: 28 } } : {}),
        }}
      />
      <Box sx={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
        {increase}
      </Box>
    </Box>
  );
}

function StepButton({
  label, disabled, onClick, children, sx,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={label}
      disabled={disabled}
      // 不抢输入框焦点，点步进时保持编辑态
      onMouseDown={(e: MouseEvent) => e.preventDefault()}
      onClick={onClick}
      sx={mergeSx({
        width: 20,
        height: 14,
        p: 0,
        border: 0,
        borderRadius: "4px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "transparent",
        color: "text.secondary",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 1,
        transition: "background-color 100ms ease, color 100ms ease",
        "&:not(:disabled):hover": { bgcolor: "action.hover", color: "text.primary" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 0 },
      }, sx)}
    >
      {children}
    </Box>
  );
}

function Chevron({ dir }: { dir: "up" | "down" }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 12 12"
      aria-hidden
      sx={{ width: 10, height: 10, display: "block" }}
    >
      <path
        d={dir === "up" ? "M2.5 7.5 6 4l3.5 3.5" : "M2.5 4.5 6 8l3.5-3.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Box>
  );
}

function Sign({ kind }: { kind: "minus" | "plus" }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 12 12"
      aria-hidden
      sx={{ width: 10, height: 10, display: "block" }}
    >
      <path d="M2.5 6h7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {kind === "plus" && (
        <path d="M6 2.5v7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </Box>
  );
}
