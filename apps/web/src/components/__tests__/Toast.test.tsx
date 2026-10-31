/** Toast 测试：触发显示、自动消失与 Provider 上下文。 */

import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeModeProvider } from "../../theme/ThemeModeProvider";
import { ToastProvider, useToast } from "../feedback/Toast";
import { Button } from "../controls/Button";

/** 点按钮弹一条 150ms 的 toast。 */
function Harness() {
  const { toast } = useToast();
  return <Button onClick={() => toast("已保存", "ok", 150)}>弹</Button>;
}

/** ToastProvider 与 useToast。 */
describe("Toast", () => {
  /** 触发后显示消息并在超时后消失。 */
  it("触发后显示消息并自动消失", async () => {
    render(
      <ThemeModeProvider>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </ThemeModeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "弹" }));
    expect(screen.getByText("已保存")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByText("已保存")).not.toBeInTheDocument();
      },
      { timeout: 1500 },
    );
  });
});
