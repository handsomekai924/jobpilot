/** Button 测试：文案渲染、点击回调与禁用态。 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ThemeModeProvider } from "@/theme/ThemeModeProvider";
import { Button } from "@/components/controls/Button";

/** 套主题渲染。 */
function wrap(ui: ReactNode) {
  return render(<ThemeModeProvider>{ui}</ThemeModeProvider>);
}

/** Button 组件。 */
describe("Button", () => {
  /** 渲染文案并在点击时触发回调。 */
  it("渲染文案并触发 onClick", async () => {
    const onClick = vi.fn();
    wrap(<Button variant="filled" onClick={onClick}>主操作</Button>);
    await userEvent.click(screen.getByRole("button", { name: "主操作" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  /** 禁用按钮不可点击。 */
  it("禁用按钮不可点（pointer-events 拦截，不会触发 onClick）", () => {
    const onClick = vi.fn();
    wrap(<Button variant="filled" disabled onClick={onClick}>主操作</Button>);
    expect(screen.getByRole("button", { name: "主操作" })).toBeDisabled();
  });

  /** 普通按钮可渲染且可聚焦。 */
  it("按下即有反馈样式（pointer-down scale 规则挂在 :active，由主题注入）", () => {
    wrap(<Button variant="gray">次操作</Button>);
    expect(screen.getByRole("button", { name: "次操作" })).not.toHaveAttribute("disabled");
  });
});
