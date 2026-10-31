/** DeliverPage 测试：清单排序、门槛文案、配额、确认发送与阈值保存。 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { ThemeModeProvider } from "@/theme/ThemeModeProvider";
import { ToastProvider } from "@/components/feedback/Toast";
import { PlatformProvider } from "@/platform/PlatformProvider";
import { DeliverPage } from "@/views/platform/deliver/DeliverPage";

/** 平台描述符：`caps.delivery.apply_gate` 是这页的门槛两路径开关（只影响文案，不影响调用）。 */
function platform(over: { apply_gate?: string } = {}) {
  return {
    site_id: "boss",
    display_name: "BOSS直聘",
    icon: "boss",
    caps: {
      auth: { sms: true, slider: true, qr: true },
      source: { expect_flow: true, tags: true, skills: true },
      catalog: { unsupported: [] },
      delivery: {
        apply_gate: over.apply_gate ?? "after_mutual_conversation",
        apply_channel: "onekeydeliver",
      },
    },
    session: { logged_in: true, phone_masked: "138****8000", busy: false },
    nav_extras: [],
  };
}

/** 安全快照：后端出门补的字段，缺了就是「缺少匹配时安全快照」。 */
const CLEAN_SNAPSHOT = {
  is_blacklisted: false,
  company_blacklisted: false,
  jd_blacklisted: false,
  jd_rule_checked: true,
  jd_status: "completed",
  auto_delivery_blocked: false,
};

/** 一次分析：三条匹配，其中一条公司黑名单。 */
const ANALYSIS = {
  analysis_id: "a1",
  resume_id: "r1",
  resume_title: "我的简历",
  created_at: 1730000000000,
  job_count: 3,
  top_score: 92,
  status: "done",
  model: "deepseek",
  matches: [
    {
      encrypt_job_id: "j1",
      job_name: "前端工程师",
      brand_name: "某某科技",
      salary_desc: "15-25K",
      match_score: 92,
      greeting: "你好，我对这个岗位很感兴趣。",
      ...CLEAN_SNAPSHOT,
    },
    {
      encrypt_job_id: "j2",
      job_name: "后端工程师",
      brand_name: "别家公司",
      match_score: 80,
      greeting: "你好，想聊聊后端岗。",
      ...CLEAN_SNAPSHOT,
      company_blacklisted: true,
    },
    {
      encrypt_job_id: "j3",
      job_name: "测试工程师",
      brand_name: "又一家公司",
      match_score: 60,
      greeting: "你好，测试岗想了解一下。",
      ...CLEAN_SNAPSHOT,
    },
  ],
};

/** 按 URL 分派的 fetch 假件。 */
function stubFetch(over: {
  apply_gate?: string;
  limits?: Record<string, unknown> | null;
  matches?: unknown[];
  stopped_reason?: string;
} = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/platforms")) {
      return new Response(JSON.stringify({ platforms: [platform(over)] }), { status: 200 });
    }
    if (url.includes("/api/match/analyses/a1")) {
      return new Response(
        JSON.stringify({ ...ANALYSIS, matches: over.matches ?? ANALYSIS.matches }),
        { status: 200 },
      );
    }
    if (url.includes("/api/match/analyses")) {
      return new Response(
        JSON.stringify({ items: [{ analysis_id: "a1", resume_title: "我的简历", job_count: 3, created_at: 1730000000000 }] }),
        { status: 200 },
      );
    }
    if (url.includes("/deliver/config")) {
      return new Response(JSON.stringify({ min_score: 70 }), { status: 200 });
    }
    if (url.includes("/deliver/status")) {
      return new Response(
        JSON.stringify({
          task_id: "",
          status: "idle",
          limits: over.limits ?? null,
          stopped_reason: over.stopped_reason ?? "",
        }),
        { status: 200 },
      );
    }
    if (url.includes("/deliver/start")) {
      return new Response(JSON.stringify({ task_id: "t-deliver" }), { status: 200 });
    }
    if (url.includes("/api/sites/boss/jobs/j")) {
      return new Response(
        JSON.stringify({ encrypt_job_id: "j1", job_name: "前端工程师", job_desc: "负责页面开发" }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
}

/** 套 Provider 渲染投递页。 */
function renderPage() {
  return render(
    <ThemeModeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={["/boss/deliver"]}>
          <PlatformProvider>
            <DeliverPage />
          </PlatformProvider>
        </MemoryRouter>
      </ToastProvider>
    </ThemeModeProvider>,
  );
}

/** 取 `POST /deliver/start` 的 body（json）。 */
function startBody() {
  const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
    .map((c) => ({ url: String(c[0]), init: c[1] as RequestInit | undefined }))
    .find((c) => c.url.includes("/deliver/start") && c.init?.method === "POST");
  expect(call, "没找到 POST /deliver/start").toBeTruthy();
  return JSON.parse(String(call!.init!.body)) as Record<string, unknown>;
}

beforeEach(() => {
  globalThis.localStorage?.clear();
  vi.stubGlobal("fetch", stubFetch());
});

/** 清单与门槛说明。 */
describe("DeliverPage 清单与门槛", () => {
  /** 按站点作用域拉配置与状态，清单按分排序并展示招呼语。 */
  it("按站点作用域拉配置与状态，清单按分数排序出招呼语", async () => {
    renderPage();
    expect(await screen.findByText("前端工程师")).toBeInTheDocument();
    expect(screen.getByText("后端工程师")).toBeInTheDocument();

    const urls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.startsWith("/api/sites/boss/deliver/config"))).toBe(true);
    expect(urls.some((u) => u.startsWith("/api/sites/boss/deliver/status"))).toBe(true);
    expect(urls.some((u) => u.startsWith("/api/deliver/"))).toBe(false);

    expect(screen.getByText("你好，我对这个岗位很感兴趣。")).toBeInTheDocument();
  });

  /** 悬浮匹配分展示岗位名、薪资与 JD。 */
  it("悬浮匹配分容器给岗位名 / 薪资 / JD（提议「投递 2.1」）", async () => {
    renderPage();
    await screen.findByText("前端工程师");

    await userEvent.hover(screen.getByRole("img", { name: /匹配 92 分/ }));

    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("前端工程师");
    expect(tip).toHaveTextContent("15-25K");
    expect(tip).toHaveTextContent("负责页面开发");
  });

  /** 门槛文案随 apply_gate 切换。 */
  it("默认门槛解释成「对方回话后才投」，after_greeting 换成「发完对话即投」", async () => {
    const { unmount } = renderPage();
    await screen.findByText("前端工程师");
    expect(screen.getByText(/对方回话（双方对话成立）后才会投简历/)).toBeInTheDocument();
    unmount();

    vi.stubGlobal("fetch", stubFetch({ apply_gate: "after_greeting" }));
    renderPage();
    await screen.findByText("前端工程师");
    expect(screen.getByText(/发完对话即可投简历/)).toBeInTheDocument();
  });

  /** apply_enabled=0 时说明只发对话。 */
  it("apply_enabled=0 时说清只发对话不投简历", async () => {
    vi.stubGlobal("fetch", stubFetch({ limits: { apply_enabled: false } }));
    renderPage();
    await screen.findByText("前端工程师");
    expect(screen.getByText(/只会发对话，不投简历/)).toBeInTheDocument();
  });

  /** 配额文案来自 limits。 */
  it("配额从任务快照的 limits 来，到顶文案带剩余", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({ limits: { daily_quota: 10, sent_today: 3, quota_left: 7, apply_enabled: true } }),
    );
    renderPage();
    await screen.findByText("前端工程师");
    expect(screen.getByText(/今日配额 3 \/ 10 · 还剩 7/)).toBeInTheDocument();
  });

  /** 停住原因有才显示。 */
  it("整批停住时把原因说出来；没停就别渲染这块", async () => {
    const { unmount } = renderPage();
    await screen.findByText("前端工程师");
    expect(screen.queryByText(/发送停住了/)).not.toBeInTheDocument();
    unmount();

    vi.stubGlobal("fetch", stubFetch({ stopped_reason: "今日发对话配额用完，剩下的切掉了" }));
    renderPage();
    await screen.findByText("前端工程师");
    expect(screen.getByText(/发送停住了：今日发对话配额用完/)).toBeInTheDocument();
  });

  /** 缺安全快照的行不可发送且说明原因。 */
  it("缺安全快照的行标出来，不进可发送候选", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        matches: [
          {
            encrypt_job_id: "j9",
            job_name: "没快照的岗",
            brand_name: "某某科技",
            match_score: 95,
            greeting: "你好。",
          },
        ],
      }),
    );
    renderPage();
    await screen.findByText("没快照的岗");
    expect(screen.getAllByText("缺少匹配时安全快照").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "一键发送全部（0）" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "一键发送全部（0）" }));
    expect(await screen.findByText(/没有「评分/)).toBeInTheDocument();
  });
});

/** 确认后发送与阈值保存。 */
describe("DeliverPage 发送", () => {
  /** 一键发送先确认，只带够分的可发行。 */
  it("一键发送全部先弹确认，确认后打 /deliver/start 且只带够分的", async () => {
    renderPage();
    await screen.findByText("前端工程师");

    await userEvent.click(screen.getByRole("button", { name: "一键发送全部（1）" }));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("你好，我对这个岗位很感兴趣。")).toBeInTheDocument();
    expect(within(drawer).getByText(/评分 ≥ 70/)).toBeInTheDocument();
    expect(within(drawer).queryByText("后端工程师")).not.toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole("button", { name: "确认发送" }));

    await waitFor(() => {
      const body = startBody();
      expect(body.analysis_id).toBe("a1");
      expect(body.mode).toBe("all");
      expect(body.confirmed).toBe(true);
      expect(body.encrypt_job_ids).toEqual(["j1"]);
    });
  });

  /** 受限职位标注原因且不进一键发送。 */
  it("受限职位带原因标出来，且不进「一键发送全部」", async () => {
    renderPage();
    await screen.findByText("前端工程师");

    expect(screen.getByText("公司黑名单")).toBeInTheDocument();
    expect(screen.getByText(/不可发送（公司黑名单）/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "一键发送全部（1）" }));
    const drawer = await screen.findByRole("dialog");
    await userEvent.click(within(drawer).getByRole("button", { name: "确认发送" }));

    await waitFor(() => {
      expect(startBody().encrypt_job_ids).toEqual(["j1"]);
    });
  });

  /** 发送选中只带勾选项。 */
  it("发送选中只带勾上的，且要显式确认", async () => {
    renderPage();
    await screen.findByText("前端工程师");

    await userEvent.click(screen.getByRole("checkbox", { name: "选择 前端工程师" }));
    await userEvent.click(screen.getByRole("button", { name: "发送选中（1）" }));

    const drawer = await screen.findByRole("dialog");
    await userEvent.click(within(drawer).getByRole("button", { name: "确认发送" }));

    await waitFor(() => {
      const body = startBody();
      expect(body.mode).toBe("selected");
      expect(body.confirmed).toBe(true);
      expect(body.encrypt_job_ids).toEqual(["j1"]);
    });
  });

  /** 阈值失焦自动保存。 */
  it("阈值改完自动保存到 /deliver/config", async () => {
    renderPage();
    await screen.findByText("前端工程师");

    const input = screen.getByRole("spinbutton", { name: "评分阈值" });
    await userEvent.clear(input);
    await userEvent.type(input, "85");
    await userEvent.tab();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/sites/boss/deliver/config",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ min_score: 85 }) }),
      );
    });
  });
});
