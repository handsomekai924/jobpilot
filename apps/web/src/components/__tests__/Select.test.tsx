/** Select 测试：选中回调、清除、焦点残留、下拉高度与空选项。 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeModeProvider } from "@/theme/ThemeModeProvider";
import { Select } from "@/components/controls/Select";

/** 两个学历选项。 */
const options = [
  { code: "bachelor", name: "本科" },
  { code: "master", name: "硕士" },
];

/** 套主题渲染。 */
function wrap(ui: React.ReactElement) {
  return render(<ThemeModeProvider>{ui}</ThemeModeProvider>);
}

/** Select 组件。 */
describe("Select", () => {
  /** 选中选项回调并收起清单。 */
  it("选中选项回调 value 并收起", async () => {
    const onChange = vi.fn();
    wrap(<Select label="学历" options={options} value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "硕士" }));
    expect(onChange).toHaveBeenCalledWith("master");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  /** 清除按钮回传空值且不展开下拉。 */
  it("clearable：点清除回调 change/clear，且不展开下拉", async () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    wrap(
      <Select
        label="学历"
        options={options}
        value="bachelor"
        onChange={onChange}
        onClear={onClear}
        clearable
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  /** 鼠标选中后不残留焦点框。 */
  it("鼠标选中收起后不残留 Mui-focused 焦点框", async () => {
    const { container } = wrap(<Select label="学历" options={options} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "硕士" }));
    await waitFor(() => {
      expect(container.querySelector(".MuiInputBase-root.Mui-focused")).toBeNull();
    });
  });

  /** 未开 clearable 或值为空时不出现清除按钮。 */
  it("clearable 默认关闭，空值不摆清除按钮", () => {
    const first = wrap(<Select label="学历" options={options} value="bachelor" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
    first.unmount();

    wrap(<Select label="学历" options={options} value="" onChange={() => {}} clearable />);
    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  /** 下拉高度上限 256px。 */
  it("下拉最多露 5 项，超出在列表里滚动", async () => {
    wrap(<Select label="学历" options={options} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("listbox")).toHaveStyle({ maxHeight: "256px" });
  });

  /** 无选项时展开给提示文本。 */
  it("选项为空时展开给提示文本", async () => {
    wrap(<Select label="学历" options={[]} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText("暂无选项")).toBeInTheDocument();
  });
});
