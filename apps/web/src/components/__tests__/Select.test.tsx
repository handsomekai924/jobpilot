import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeModeProvider } from "../../theme/ThemeModeProvider";
import { Select } from "../controls/Select";

const options = [
  { code: "bachelor", name: "本科" },
  { code: "master", name: "硕士" },
];

function wrap(ui: React.ReactElement) {
  return render(<ThemeModeProvider>{ui}</ThemeModeProvider>);
}

describe("Select", () => {
  it("选中选项回调 value 并收起", async () => {
    const onChange = vi.fn();
    wrap(<Select label="学历" options={options} value="" onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "硕士" }));
    expect(onChange).toHaveBeenCalledWith("master");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

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
    // 清除按钮默认 pointer-events: none（hover/聚焦才显示），jsdom 不跑 :hover，直接触发点击
    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("鼠标选中收起后不残留 Mui-focused 焦点框", async () => {
    const { container } = wrap(<Select label="学历" options={options} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "硕士" }));
    await waitFor(() => {
      expect(container.querySelector(".MuiInputBase-root.Mui-focused")).toBeNull();
    });
  });

  it("clearable 默认关闭，空值不摆清除按钮", () => {
    const first = wrap(<Select label="学历" options={options} value="bachelor" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
    first.unmount();

    wrap(<Select label="学历" options={options} value="" onChange={() => {}} clearable />);
    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("下拉最多露 5 项，超出在列表里滚动", async () => {
    wrap(<Select label="学历" options={options} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("listbox")).toHaveStyle({ maxHeight: "256px" });
  });

  it("选项为空时展开给提示文本", async () => {
    wrap(<Select label="学历" options={[]} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText("暂无选项")).toBeInTheDocument();
  });
});
