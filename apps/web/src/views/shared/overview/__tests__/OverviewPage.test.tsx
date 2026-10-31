/** 总览页：会话卡、喂料提示、在跑任务、快捷入口与职位库图表的装配。 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ThemeModeProvider } from "@/theme/ThemeModeProvider";
import { ToastProvider } from "@/components/feedback/Toast";
import { PlatformProvider } from "@/platform/PlatformProvider";
import { OverviewPage } from "@/views/shared/overview/OverviewPage";
import { applyWsEvent, resetStores } from "@/ws/dispatch";
import type { WsEnvelope } from "@/ws/client";

/** jsdom 没有 canvas，用假 echarts 承接 init；页面级只验装配，图元走 charts.test.tsx。 */
const echartsMock = vi.hoisted(() => {
  const instance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
  return { instance, init: vi.fn(() => instance), use: vi.fn() };
});

vi.mock("echarts/core", () => ({ init: echartsMock.init, use: echartsMock.use }));
vi.mock("echarts/charts", () => ({ BarChart: class {} }));
vi.mock("echarts/components", () => ({ GridComponent: class {}, TooltipComponent: class {} }));
vi.mock("echarts/renderers", () => ({ CanvasRenderer: class {} }));

/** 平台描述符桩：一个未登录的 boss，带两个 nav_extras 入口。 */
const PLATFORMS = {
  platforms: [
    {
      site_id: "boss",
      display_name: "BOSS直聘",
      icon: "boss",
      caps: {
        auth: { sms: true, slider: true, qr: false },
        source: { expect_flow: true, tags: true, skills: true },
        catalog: { unsupported: [] },
        delivery: { apply_gate: "after_mutual_conversation", apply_channel: "onekeydeliver" },
      },
      session: { logged_in: false, phone_masked: "", busy: false },
      nav_extras: [
        { key: "expect", label: "求职期望", route: "expect" },
        { key: "talent", label: "人才库", route: "talent" },
      ],
    },
  ],
};

/** 拼一个 WS 信封，未给的字段补默认值。 */
function frame(partial: Partial<WsEnvelope> & { type: string }): WsEnvelope {
  return { ts: 1700000000, task_type: "", task_id: "", site: "", data: {}, ...partial };
}

/** 在主题、Toast、路由与平台 Provider 里渲染总览页。 */
function renderPage() {
  return render(
    <ThemeModeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={["/overview"]}>
          <PlatformProvider>
            <OverviewPage />
          </PlatformProvider>
        </MemoryRouter>
      </ToastProvider>
    </ThemeModeProvider>,
  );
}

/** 每个用例前重置 store、localStorage 与 fetch 桩。 */
beforeEach(() => {
  resetStores();
  globalThis.localStorage?.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(PLATFORMS), { status: 200 })),
  );
});

/** 总览页消费 WS 全事件与职位库统计。 */
describe("OverviewPage 消费 WS 全事件", () => {
  /** session.changed 后会话卡显示实时登录态。 */
  it("session.changed 让会话卡显示实时态，而不是描述符快照", async () => {
    applyWsEvent(
      frame({
        type: "session.changed",
        site: "boss",
        data: { logged_in: true, phone_masked: "138****8000", task: { status: "done" } },
      }),
    );
    renderPage();

    await screen.findByText("138****8000");
    expect(screen.getAllByText("已登录").length).toBeGreaterThan(0);
  });

  /** task.* 事件在跑任务卡上出进度与站点角标。 */
  it("task.* 把在跑任务挂出来，带进度与站点", async () => {
    applyWsEvent(
      frame({
        type: "task.progress",
        task_id: "ct_1",
        site: "boss",
        data: {
          task_id: "ct_1", task_type: "crawl", site: "boss",
          title: "抓职位", status: "running", current: "第 2 页", done: 1, total: 3, events: [],
        },
      }),
    );
    renderPage();

    await screen.findByText("抓职位");
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("第 2 页")).toBeInTheDocument();
    expect(screen.getByText("boss")).toBeInTheDocument();
    expect(screen.getByText("进行中")).toBeInTheDocument();
  });

  /** auth.need_slider 出滑块提示条与「去处理」。 */
  it("喂料三态都出提示条，auth.state 后收起", async () => {
    applyWsEvent(
      frame({
        type: "auth.need_slider",
        task_id: "lt_1",
        site: "boss",
        data: { task_id: "lt_1", phone_masked: "138****8000", slider: { gt: "g" } },
      }),
    );
    renderPage();

    await screen.findByText(/需要你过一下滑块/);
    expect(screen.getByRole("button", { name: "去处理" })).toBeInTheDocument();
  });

  /** auth.need_code 出验证码提示。 */
  it("auth.need_code 出验证码提示", async () => {
    applyWsEvent(
      frame({
        type: "auth.need_code",
        task_id: "lt_1",
        site: "boss",
        data: { task_id: "lt_1", phone_masked: "138****8000" },
      }),
    );
    renderPage();

    await screen.findByText(/需要你输入短信验证码/);
  });

  /** auth.need_scan 出扫码提示。 */
  it("auth.need_scan 出扫码提示", async () => {
    applyWsEvent(
      frame({
        type: "auth.need_scan",
        task_id: "lt_1",
        site: "boss",
        data: { task_id: "lt_1", qr: { url: "https://x" } },
      }),
    );
    renderPage();

    await screen.findByText(/需要你扫码确认/);
  });

  /** auth.state 到达后喂料提示条消失。 */
  it("auth.state 一到就收起喂料提示条", async () => {
    applyWsEvent(
      frame({
        type: "auth.need_code",
        task_id: "lt_1",
        site: "boss",
        data: { task_id: "lt_1", phone_masked: "138****8000" },
      }),
    );
    applyWsEvent(frame({ type: "auth.state", task_id: "lt_1", site: "boss", data: { status: "done" } }));
    renderPage();

    expect(screen.queryByText(/需要你输入短信验证码/)).not.toBeInTheDocument();
  });

  /** nav_extras 只出未被采集条件吸收的入口。 */
  it("快捷入口含平台私有扩展（nav_extras），并入采集条件的除外", async () => {
    renderPage();
    await screen.findByText("BOSS直聘 · 人才库");
    expect(screen.queryByText(/求职期望/)).not.toBeInTheDocument();
  });

  /** 无在跑任务时给空态，平台卡照出。 */
  it("没有在跑任务时给空态，不给假进度条", async () => {
    renderPage();
    await screen.findByText("当前没有在跑的任务");
    await screen.findByText("BOSS直聘");
    expect(screen.queryByText("还没有平台")).not.toBeInTheDocument();
  });

  /** 「去处理」跳到该平台登录页。 */
  it("喂料提示的「去处理」跳到该平台登录页", async () => {
    applyWsEvent(
      frame({
        type: "auth.need_code",
        task_id: "lt_1",
        site: "boss",
        data: { task_id: "lt_1", phone_masked: "138****8000" },
      }),
    );
    render(
      <ThemeModeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={["/overview"]}>
            <PlatformProvider>
              <Routes>
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/:siteId/login" element={<div>登录页</div>} />
              </Routes>
            </PlatformProvider>
          </MemoryRouter>
        </ToastProvider>
      </ThemeModeProvider>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "去处理" }));
    expect(await screen.findByText("登录页")).toBeInTheDocument();
  });

  /** 职位库统计出 KPI 与图表，并可切到表格孪生取数。 */
  it("职位库数据区吃 /jobs/stats：KPI 出数，图表可切表格孪生", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/jobs/stats")) {
          return new Response(
            JSON.stringify({
              jobs: 1284,
              pages: 32,
              raw_seen: 2400,
              kept_seen: 1850,
              dropped_seen: 550,
              missing_desc: 23,
              top_cities: [
                { city: "广州", count: 312 },
                { city: "深圳", count: 120 },
              ],
              pages_log: [
                {
                  page: 3,
                  raw_count: 55,
                  kept_count: 42,
                  dropped_count: 13,
                  inserted: 30,
                  updated: 12,
                  fetched_at: "2026-10-28 14:02:03",
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify(PLATFORMS), { status: 200 });
      }),
    );
    renderPage();

    await screen.findByText("1,284");
    expect(screen.getByText("77.1%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "条形图：广州 312 个、深圳 120 个" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "柱状图：14:02 42 个" })).toBeInTheDocument();

    const cityToggle = screen.getByRole("radiogroup", { name: "城市分布视图切换" });
    await userEvent.click(within(cityToggle).getByRole("radio", { name: "表格" }));
    expect(screen.getByRole("columnheader", { name: "职位数" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "312" })).toBeInTheDocument();
  });
});
