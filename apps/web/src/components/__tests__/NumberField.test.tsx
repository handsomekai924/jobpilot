/** NumberField 测试：提交时机、边界夹取、步进与布局。 */

import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeModeProvider } from "@/theme/ThemeModeProvider";
import { NumberField } from "@/components/controls/NumberField";

/** 套主题渲染。 */
function wrap(ui: React.ReactElement) {
  return render(<ThemeModeProvider>{ui}</ThemeModeProvider>);
}

/** NumberField 组件。 */
describe("NumberField", () => {
  /** 输入过程不回调，失焦提交并夹到 max。 */
  it("输入过程中不回调，失焦时才提交并夹到上限", async () => {
    const onChange = vi.fn();
    /** 受控包装：把回调写回 value。 */
    function Harness() {
      const [value, setValue] = useState(5);
      return (
        <NumberField
          aria-label="最多几页"
          value={value}
          min={1}
          max={10}
          onChange={(n) => {
            onChange(n);
            setValue(n);
          }}
        />
      );
    }
    wrap(<Harness />);
    const input = screen.getByRole("spinbutton", { name: "最多几页" });

    await userEvent.clear(input);
    await userEvent.type(input, "12");
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(10);
    expect(input).toHaveValue("10");
  });

  /** 清空后失焦回退到上次提交值。 */
  it("清空后失焦回退到上次提交值，不触发 change", async () => {
    const onChange = vi.fn();
    wrap(<NumberField aria-label="起始页" value={3} min={1} onChange={onChange} />);
    const input = screen.getByRole("spinbutton", { name: "起始页" });

    await userEvent.clear(input);
    await userEvent.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("3");
  });

  /** 步进按 step 增减，到边界禁用。 */
  it("步进按钮按 step 增减，到边界禁用", async () => {
    const onChange = vi.fn();
    wrap(<NumberField aria-label="翻页间隔" value={1} min={0} max={2} step={0.5} onChange={onChange} />);
    const plus = screen.getByRole("button", { name: "增加翻页间隔" });
    const minus = screen.getByRole("button", { name: "减少翻页间隔" });

    await userEvent.click(plus);
    expect(onChange).toHaveBeenLastCalledWith(1.5);

    await userEvent.click(plus);
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(plus).toBeDisabled();

    await userEvent.click(minus);
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });

  /** 默认布局：减号在左、加号在右。 */
  it("默认布局：减少按钮在输入框左侧、增加按钮在右侧", () => {
    wrap(<NumberField aria-label="最多几页" value={5} min={1} max={10} onChange={() => {}} />);
    const minus = screen.getByRole("button", { name: "减少最多几页" });
    const plus = screen.getByRole("button", { name: "增加最多几页" });
    const input = screen.getByRole("spinbutton", { name: "最多几页" });

    expect(minus.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.compareDocumentPosition(plus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  /** 无 label 时收起浮动 label 的预留内边距。 */
  it("无 label 时用 hiddenLabel 收掉浮动 label 预留的上方内边距", () => {
    wrap(<NumberField aria-label="最多几页" value={5} onChange={() => {}} />);
    const input = screen.getByRole("spinbutton", { name: "最多几页" });
    expect(input.closest(".MuiInputBase-hiddenLabel")).not.toBeNull();
  });

  /** 有值时 label 常驻左上角。 */
  it("有 label 时随值浮动：有值常驻左上角，不因左侧按钮被强制撑开", () => {
    wrap(<NumberField label="评分阈值" value={70} onChange={() => {}} />);
    const labelEl = screen.getByText("评分阈值").closest(".MuiInputLabel-root");
    expect(labelEl).toHaveAttribute("data-shrink", "true");
  });

  /** 右侧控件布局：两个按钮同容器、上下排列且可用。 */
  it("controlsPosition=right：两个按钮收进输入框右侧、上下排列，仍可增减", async () => {
    const onChange = vi.fn();
    wrap(
      <NumberField
        aria-label="最多几页"
        value={5}
        min={1}
        max={10}
        controlsPosition="right"
        onChange={onChange}
      />,
    );
    const minus = screen.getByRole("button", { name: "减少最多几页" });
    const plus = screen.getByRole("button", { name: "增加最多几页" });
    expect(plus.parentElement).toBe(minus.parentElement);

    await userEvent.click(plus);
    expect(onChange).toHaveBeenCalledWith(6);
  });

  /** Enter 提交并按 step 的小数位取整。 */
  it("Enter 提交并按 step 的小数位取整", async () => {
    const onChange = vi.fn();
    wrap(<NumberField aria-label="翻页间隔（秒）" value={1} min={0} max={30} step={0.5} onChange={onChange} />);
    const input = screen.getByRole("spinbutton", { name: "翻页间隔（秒）" });

    await userEvent.clear(input);
    await userEvent.type(input, "2.26{Enter}");

    expect(onChange).toHaveBeenCalledWith(2.3);
    expect(input).toHaveValue("2.3");
  });
});
