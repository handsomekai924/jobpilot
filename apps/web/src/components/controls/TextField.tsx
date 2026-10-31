/** Apple 风格输入框入口：业务代码一律走本组件，不直接用 MuiTextField。 */

import { TextField as MuiTextField, type TextFieldProps as MuiTextFieldProps } from "@mui/material";

/** 输入框属性，直接沿用 MUI。 */
export type TextFieldProps = MuiTextFieldProps;

/**
 * Apple 风格输入框：filled + 圆角 + 无下划线（外观统一由 theme MuiTextField 收口）。
 * 这里只收口默认值，业务代码一律走本组件，不直接用 MuiTextField。
 */
export function TextField(props: TextFieldProps) {
  return <MuiTextField {...props} />;
}
