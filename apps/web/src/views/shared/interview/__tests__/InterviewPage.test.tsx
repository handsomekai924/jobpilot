/**
 * InterviewPage 契约测试：出题请求体、补题语义、生成任务迁任务中心、导出是链接不发 fetch。
 *
 * 与 TasksPage.test 同一套骨架（ThemeMode + Toast + MemoryRouter + Platform + resetStores），
 * fetch 按 URL 分流；断言 URL 用全等（防子路径误匹配），请求体看 JSON 片段。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { ThemeModeProvider } from "@/theme/ThemeModeProvider";
import { ToastProvider } from "@/components/feedback/Toast";
import { PlatformProvider } from "@/platform/PlatformProvider";
import { InterviewPage } from "@/views/shared/interview/InterviewPage";
import { resetStores } from "@/ws/dispatch";

/** 平台描述符桩：一个已登录的 boss 站点。 */
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
      nav_extras: [],
    },
  ],
};

/** 岗位列表两行：已有题 / 没有题，覆盖「已生成」徽章和行内生成。 */
const JOBS = {
  items: [
    {
      encrypt_job_id: "j1",
      job_name: "前端工程师",
      brand_name: "星河科技",
      location: "深圳",
      salary_desc: "20-30K",
      job_experience: "3-5年",
      job_degree: "本科",
      jd_status: "已抓取",
      question_count: 3,
    },
    {
      encrypt_job_id: "j2",
      job_name: "Java后端",
      brand_name: "云图软件",
      location: "广州",
      salary_desc: "25-35K",
      job_experience: "5年以上",
      job_degree: "硕士",
      jd_status: "已抓取",
      question_count: 0,
    },
  ],
  total: 2,
};

/** 生成记录桩：一个岗位一套题。 */
const RECORDS = {
  items: [
    {
      encrypt_job_id: "j1",
      analysis_id: "a1",
      job_name: "前端工程师",
      brand_name: "星河科技",
      question_count: 3,
      created_at: 1700000100,
      updated_at: 1700000200,
    },
  ],
  total: 1,
};

/** 题目列表桩：两道题，含提示与频次标记。 */
const QUESTIONS = {
  questions: [
    {
      id: 11,
      question_text: "说说虚拟 DOM 的 diff 策略？",
      question_type: "技术深度",
      difficulty: "中级",
      is_frequent: true,
      answer_hints: {
        approach: "从同层比较说起",
        key_points: ["同层比较", "key 的作用"],
        reference_answer: "……",
      },
    },
    {
      id: 12,
      question_text: "讲一个你主导的前端性能优化项目。",
      question_type: "项目经历",
      difficulty: "高级",
      is_frequent: false,
      answer_hints: { approach: "按 STAR 讲" },
    },
  ],
  total: 2,
  stats: { question_count: 3 },
};

/** 题目侧栏的上下文桩。 */
const CONTEXT = {
  encrypt_job_id: "j1",
  analysis_id: "a1",
  job_name: "前端工程师",
  brand_name: "星河科技",
  match_score: 86,
  question_count: 3,
  task: null,
};

/** 岗位题目数摘要桩。 */
const SUMMARY = { items: { j1: { question_count: 2 } } };

/** 一条在跑的出题任务（占着 j1，标题「面试题（1个岗位）」）。 */
const IV_TASKS = {
  running_count: 1,
  tasks: [
    {
      task_id: "it1",
      status: "running",
      current: "出题中",
      done: 0,
      total: 1,
      error: "",
      created_at: 1700000900,
      ended_at: null,
      question_total: 0,
      job_ids: ["j1"],
      events: [{ at: 1700000901, name: "interview.started", payload: { detail: "开始" } }],
    },
  ],
  busy_job_ids: { j1: "it1" },
};

/** 没有在跑任务的空快照。 */
const NO_TASKS = { running_count: 0, tasks: [], busy_job_ids: {} };

/** 按 URL 分流的 fetch 假实现；顺序：精确路由先于前缀路由。 */
function stubFetch(overrides?: {
  jobs?: unknown;
  tasks?: unknown;
}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/platforms")) {
      return new Response(JSON.stringify(PLATFORMS), { status: 200 });
    }
    if (url.includes("/api/interview/generate")) {
      return new Response(JSON.stringify({ task_id: "it-new" }), { status: 200 });
    }
    if (url.includes("/api/interview/tasks/cancel")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes("/api/interview/task/")) {
      return new Response(
        JSON.stringify({ task_id: "it1", status: "running", job_ids: ["j9"], question_total: 0 }),
        { status: 200 },
      );
    }
    if (url.includes("/api/interview/tasks")) {
      return new Response(JSON.stringify(overrides?.tasks ?? NO_TASKS), { status: 200 });
    }
    if (url.includes("/api/interview/jobs")) {
      return new Response(JSON.stringify(overrides?.jobs ?? JOBS), { status: 200 });
    }
    if (url.includes("/api/interview/records")) {
      return new Response(JSON.stringify(RECORDS), { status: 200 });
    }
    if (url.includes("/api/interview/list")) {
      return new Response(JSON.stringify(QUESTIONS), { status: 200 });
    }
    if (url.includes("/api/interview/context")) {
      return new Response(JSON.stringify(CONTEXT), { status: 200 });
    }
    if (url.includes("/api/interview/summary")) {
      return new Response(JSON.stringify(SUMMARY), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
}

/** 在主题、Toast、路由与平台 Provider 里渲染面试题页。 */
function renderPage() {
  return render(
    <ThemeModeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={["/interview"]}>
          <PlatformProvider>
            <InterviewPage />
          </PlatformProvider>
        </MemoryRouter>
      </ToastProvider>
    </ThemeModeProvider>,
  );
}

/** MUI Select 的触发器是 `role="combobox"`，按 label 找（label 自己有 pointer-events: none）。 */
function combo(label: string) {
  return screen.getByLabelText(label);
}

/** 每个用例前重置 store、localStorage 与 fetch 桩。 */
beforeEach(() => {
  resetStores();
  globalThis.localStorage?.clear();
  vi.stubGlobal("fetch", stubFetch());
});

/** 岗位列表与空态。 */
describe("InterviewPage 岗位列表", () => {
  /** 岗位行渲染公司与薪资，已生成有徽章；空列表给空态。 */
  it("渲染岗位行（公司/薪资/已生成徽章），空列表给空态", async () => {
    renderPage();
    expect(await screen.findByText("前端工程师")).toBeInTheDocument();
    expect(screen.getByText("星河科技")).toBeInTheDocument();
    expect(screen.getByText("20-30K")).toBeInTheDocument();
    expect(screen.getAllByText("已生成").length).toBeGreaterThan(0);
    expect(screen.getByText("Java后端")).toBeInTheDocument();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/platforms")) {
          return new Response(JSON.stringify(PLATFORMS), { status: 200 });
        }
        if (url.includes("/api/interview/jobs")) {
          return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
        }
        return new Response(JSON.stringify(NO_TASKS), { status: 200 });
      }),
    );
    renderPage();
    expect(await screen.findByText("没有符合条件的岗位")).toBeInTheDocument();
  });
});

/** 出题请求体。 */
describe("InterviewPage 出题", () => {
  /** 勾选岗位后只发 encrypt_job_ids，题量自动不手填。 */
  it("勾选岗位 → generate 只带 encrypt_job_ids（题量自动，不给手填）", async () => {
    renderPage();
    await screen.findByText("前端工程师");

    expect(screen.queryByLabelText("题量")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("选择 前端工程师"));
    await userEvent.click(screen.getByRole("button", { name: /出题/ }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/interview/generate",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const calls = (globalThis.fetch as unknown as {
      mock: { calls: Array<[unknown, unknown]> };
    }).mock.calls;
    const gen = calls.find((c) => String(c[0]) === "/api/interview/generate");
    expect(gen).toBeDefined();
    const init = gen?.[1] as { body?: string };
    expect(String(init.body ?? "")).toContain('"encrypt_job_ids":["j1"]');
    expect(String(init.body ?? "")).not.toContain("question_count");
  });
});

/** 补题请求体。 */
describe("InterviewPage 补题", () => {
  /** 选题型与条数后请求体带上对应字段。 */
  it("选题型 + 条数 → generate 带 question_type/question_count", async () => {
    renderPage();
    await screen.findByText("前端工程师");
    await userEvent.click(screen.getAllByRole("button", { name: "查看" })[0]);

    expect(await screen.findByText("上下文与摘要")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "补题" }));
    await userEvent.click(combo("题型"));
    await userEvent.click(await screen.findByRole("option", { name: "场景" }));

    const countBox = screen.getByLabelText("补几条");
    await userEvent.clear(countBox);
    await userEvent.type(countBox, "5");
    await userEvent.click(screen.getByRole("button", { name: "开始补题" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/interview/generate",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const calls = (globalThis.fetch as unknown as {
      mock: { calls: Array<[unknown, unknown]> };
    }).mock.calls;
    const gen = calls.find((c) => String(c[0]) === "/api/interview/generate");
    const init = gen?.[1] as { body?: string };
    expect(String(init.body ?? "")).toContain('"question_type":"场景"');
    expect(String(init.body ?? "")).toContain('"question_count":5');
    expect(String(init.body ?? "")).toContain('"encrypt_job_ids":["j1"]');
  });
});

/** 生成任务迁到任务中心后的占位语义。 */
describe("InterviewPage 生成任务迁任务中心", () => {
  /** 在跑任务占着的岗位按钮转「任务中」，本页不再有生成任务段。 */
  it("任务态照旧占岗位（行内生成转「任务中」），分段里不再有「生成任务」", async () => {
    vi.stubGlobal("fetch", stubFetch({ tasks: IV_TASKS }));
    renderPage();
    await screen.findByText("前端工程师");

    expect(screen.getByRole("button", { name: "任务中" })).toBeDisabled();

    expect(screen.queryByRole("radio", { name: "生成任务" })).not.toBeInTheDocument();
  });
});

/** 导出走链接而非 fetch。 */
describe("InterviewPage 导出", () => {
  /** 导出是 a[href]，不会发 fetch。 */
  it("导出是 <a href>（不发 fetch），链接指向 /api/interview/export", async () => {
    renderPage();
    await screen.findByText("前端工程师");
    await userEvent.click(screen.getAllByRole("button", { name: "查看" })[0]);

    const link = await screen.findByRole("link", { name: "导出 Markdown" });
    expect(link).toHaveAttribute("href", "/api/interview/export?encrypt_job_id=j1");

    const calls = (globalThis.fetch as unknown as {
      mock: { calls: Array<[unknown, unknown]> };
    }).mock.calls;
    for (const [req] of calls) {
      expect(String(req)).not.toContain("/api/interview/export");
    }
  });
});
