/** SegmentedControl 测试：点击切换、方向键移动与受控回写。 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ThemeModeProvider } from "@/theme/ThemeModeProvider";
import { SegmentedControl } from "@/components/controls/SegmentedControl";

/** 受控包装：把内部选中值回传给调用方。 */
function Harness({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState("boss");
  return (
    <SegmentedControl
      aria-label="平台切换"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
      options={[
        { value: "boss", label: "BOSS直聘" },
        { value: "job51", label: "前程无忧" },
      ]}
    />
  );
}

/** SegmentedControl 组件。 */
describe("SegmentedControl", () => {
  /** 点击切换选中项并回调。 */
  it("点击切换选中项并回调", async () => {
    const onChange = vi.fn();
    render(
      <ThemeModeProvider>
        <Harness onChange={onChange} />
      </ThemeModeProvider>,
    );
    await userEvent.click(screen.getByRole("radio", { name: /前程无忧/ }));
    expect(onChange).toHaveBeenCalledWith("job51");
    expect(screen.getByRole("radio", { name: /前程无忧/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /BOSS直聘/ })).toHaveAttribute("aria-checked", "false");
  });

  /** 方向键在选项间移动。 */
  it("方向键在选项间移动", async () => {
    const onChange = vi.fn();
    render(
      <ThemeModeProvider>
        <Harness onChange={onChange} />
      </ThemeModeProvider>,
    );
    screen.getByRole("radio", { name: /BOSS直聘/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("job51");
  });
});
