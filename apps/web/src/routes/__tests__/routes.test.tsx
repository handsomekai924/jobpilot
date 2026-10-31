/** 路由表、布局分支与平台切换器的集成测试。 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { ThemeModeProvider } from "../../theme/ThemeModeProvider";
import { ToastProvider } from "../../components/feedback/Toast";
import { PlatformProvider } from "../../platform/PlatformProvider";
import { AppRoutes, legacyTarget } from "../index";

/** 两个站点、能力有差异：用来验「描述符驱动 + caps 降级」；`expect` 是真实描述符形状，`talent` 用于验未注册私有入口的兜底。 */
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
      session: { logged_in: true, phone_masked: "138****8000", busy: false },
      nav_extras: [
        { key: "expect", label: "求职期望", route: "expect" },
        { key: "talent", label: "人才库", route: "talent" },
      ],
    },
    {
      site_id: "51job",
      display_name: "前程无忧",
      icon: "51job",
      caps: {
        auth: { sms: true, slider: false, qr: true },
        source: { expect_flow: false, tags: false, skills: false },
        catalog: { unsupported: ["scale", "stage"] },
        delivery: { apply_gate: "after_greeting", apply_channel: "apply" },
      },
      session: { logged_in: false, phone_masked: "", busy: false },
      nav_extras: [],
    },
  ],
};

/** 在内存路由里挂 Provider 树并渲染到指定路径。 */
function renderAt(path: string) {
  return render(
    <ThemeModeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <PlatformProvider>
            <AppRoutes />
          </PlatformProvider>
        </MemoryRouter>
      </ToastProvider>
    </ThemeModeProvider>,
  );
}

/** 页面大标题（顶栏导航项与侧栏项同名时靠 role 区分）。 */
function heading(name: string) {
  return screen.findByRole("heading", { level: 1, name });
}

/** 每个用例前清持久化并桩掉平台接口。 */
beforeEach(() => {
  globalThis.localStorage?.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(PLATFORMS), { status: 200 })),
  );
});

/** 验两类布局分支与 caps 降级。 */
describe("两类布局分支", () => {
  /** 验共用路由不出平台侧栏。 */
  it("共用路由不出平台侧栏，内容区撑满", async () => {
    renderAt("/overview");
    await heading("总览");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  /** 验平台路由出侧栏，条目 = 固定入口 + nav_extras（并入采集条件的除外）。 */
  it("平台作用域路由出侧栏，条目 = 固定平台路由 + nav_extras（并入采集条件的除外）", async () => {
    renderAt("/boss/jobs");
    expect(await screen.findByRole("navigation", { name: "BOSS直聘 导航" })).toBeInTheDocument();
    await heading("找工作");
    for (const label of ["登录", "找工作", "投递", "人才库"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "求职期望" })).not.toBeInTheDocument();
  });

  /** 验求职期望旧链接落回采集条件所在处。 */
  it("求职期望旧链接落回采集条件所在处", async () => {
    renderAt("/boss/expect");
    await heading("找工作");
  });

  /** 验 51job 没有 nav_extras 就不出私有入口。 */
  it("caps 降级：51job 没有 nav_extras 就不出私有入口", async () => {
    renderAt("/51job/jobs");
    expect(await screen.findByRole("navigation", { name: "前程无忧 导航" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "人才库" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "求职期望" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "找工作" })).toBeInTheDocument();
  });

  /** 验站点不在描述符里时给回头路，不白屏。 */
  it("站点不在描述符里给回头路，不白屏", async () => {
    renderAt("/notasite/jobs");
    await screen.findByText("没这个平台");
    expect(screen.getByText(/notasite/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "回到总览" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

/** 验旧路由重定向表与旧 hash 落页。 */
describe("旧路由重定向表", () => {
  /** 验重定向表逐项映射。 */
  it.each([
    ["/", "/overview"],
    ["/login", "/boss/login"],
    ["/jobs", "/boss/jobs"],
    ["/resume", "/resumes"],
    ["/llm", "/settings"],
  ])("%s → %s", (from, to) => {
    expect(legacyTarget(from)).toBe(to);
  });

  /** 验旧 hash 落到新路由并渲染真页面。 */
  it("旧 hash 落到新路由并渲染对应页面", async () => {
    renderAt("/resume");
    await heading("简历");
    expect(screen.getByRole("radio", { name: "简历库" })).toBeInTheDocument();
  });

  /** 验无 siteId 的平台旧路由默认落 boss。 */
  it("无 siteId 的平台旧路由默认落 boss", async () => {
    renderAt("/login");
    expect(await screen.findByRole("navigation", { name: "BOSS直聘 导航" })).toBeInTheDocument();
    await heading("登录与会话");
  });
});

/** 验平台切换器的三类行为。 */
describe("平台切换器", () => {
  /** 验平台路由上切平台原地换站点并保留当前页面。 */
  it("平台作用域路由上切平台 = 原地换站点，保留当前页面", async () => {
    renderAt("/boss/jobs");
    expect(await screen.findByRole("navigation", { name: "BOSS直聘 导航" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "前程无忧" }));

    expect(await screen.findByRole("navigation", { name: "前程无忧 导航" })).toBeInTheDocument();
    await heading("找工作");
  });

  /** 验目标平台没有当前页面时落回它的第一个入口。 */
  it("切到没有当前页面的平台时落回它的第一个入口，不报错", async () => {
    renderAt("/boss/talent");
    await heading("人才库");

    await userEvent.click(screen.getByRole("radio", { name: "前程无忧" }));

    await heading("登录与会话");
  });

  /** 验共用路由上切平台只换上下文不跳页。 */
  it("共用路由上切平台只换上下文不跳页", async () => {
    renderAt("/overview");
    await heading("总览");

    await userEvent.click(screen.getByRole("radio", { name: "前程无忧" }));

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "总览" })).toBeInTheDocument());
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});

/** 验 nav_extras 描述符驱动的标题解析。 */
describe("nav_extras 描述符驱动", () => {
  /** 验平台私有入口按描述符解析标题，不写死站点名。 */
  it("平台私有入口按描述符解析标题，不写死站点名", async () => {
    renderAt("/boss/talent");
    await heading("人才库");
    expect(screen.queryByText(/没这个平台/)).not.toBeInTheDocument();
  });
});
