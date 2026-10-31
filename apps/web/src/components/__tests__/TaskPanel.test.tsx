/** TaskPanel 测试：状态映射、进度/计数/ETA 与停止按钮。 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeModeProvider } from "@/theme/ThemeModeProvider";
import { TaskPanel } from "@/components/feedback/TaskPanel";

/** 套主题渲染。 */
function wrap(ui: React.ReactElement) {
  return render(<ThemeModeProvider>{ui}</ThemeModeProvider>);
}

/** TaskPanel 组件。 */
describe("TaskPanel", () => {
  /** 运行中显示计数、ETA、事件与停止按钮。 */
  it("状态机 → 外观映射；运行中显示停止按钮", async () => {
    const onStop = vi.fn();
    wrap(
      <TaskPanel
        title="批量匹配"
        status="running"
        percent={40}
        current="某职位"
        counts={[["完成", "12 / 30"]]}
        eta={88}
        events={[{ name: "开始匹配", at: 1700000000, kind: "info" }]}
        eventsTitle="事件"
        onStop={onStop}
      />,
    );
    expect(screen.getByText("批量匹配")).toBeInTheDocument();
    expect(screen.getByText("进行中")).toBeInTheDocument();
    expect(screen.getByText("12 / 30")).toBeInTheDocument();
    expect(screen.getByText("1 分 28 秒")).toBeInTheDocument();
    expect(screen.getByText("开始匹配")).toBeInTheDocument();
    await userEvent.click(screen.getByText("停止"));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  /** 完成后映射为已完成且无停止按钮。 */
  it("完成后不显示停止按钮，状态映射为已完成", () => {
    wrap(<TaskPanel title="采集 JD" status="done" percent={100} onStop={() => {}} />);
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.queryByText("停止")).not.toBeInTheDocument();
  });

  /** 失败态显示错误文案。 */
  it("error 状态显示错误文案", () => {
    wrap(<TaskPanel title="发对话" status="error" error="会话已过期" />);
    expect(screen.getByText("失败")).toBeInTheDocument();
    expect(screen.getByText("错误：会话已过期")).toBeInTheDocument();
  });
});
