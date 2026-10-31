/** 设置页：LLM 配置、程序更新、黑名单规则与外观四段。 */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { ThemeModeProvider } from "@/theme/ThemeModeProvider";
import { ToastProvider } from "@/components/feedback/Toast";
import { PlatformProvider } from "@/platform/PlatformProvider";
import { SettingsPage } from "@/views/shared/settings/SettingsPage";
import { resetStores } from "@/ws/dispatch";

/** 平台描述符桩：两个站点，boss 当前生效。 */
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
    {
      site_id: "other",
      display_name: "另一家",
      icon: "other",
      caps: {
        auth: { sms: false, slider: false, qr: true },
        source: { expect_flow: false, tags: false, skills: false },
        catalog: { unsupported: [] },
        delivery: { apply_gate: "never", apply_channel: "im" },
      },
      session: { logged_in: false, phone_masked: "", busy: false },
      nav_extras: [],
    },
  ],
};

/** 配置快照：返回的是打码 Key（`has_key`/`fixed` 是 masked() 的附加字段）。 */
const LLM_CONFIG = {
  api_key: "sk-***abcd",
  has_key: true,
  base_url: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  configured: true,
  fixed: { temperature: 0.7, max_tokens: 2048, resume_parse_max_tokens: 8192, match_max_tokens: 4096, timeout: 120 },
};

/** 模型列表回包桩。 */
const MODELS = {
  models: ["deepseek-chat", "deepseek-reasoner"],
  source: "https://api.deepseek.com/v1/models",
  selected: "deepseek-chat",
};

/** 测试连通成功回包桩。 */
const LLM_TEST_OK = { ok: true, latency_ms: 88, model: "deepseek-chat", message: "正常，一切就绪" };

/** 检查更新回包桩：有新版本且可自更新。 */
const UPDATE_STATUS = {
  ok: true,
  current: "1.2.3",
  latest: "1.2.4",
  has_update: true,
  should_prompt: true,
  ignored: null,
  notes: "修复了一批问题",
  can_self_update: true,
  zip_asset: { name: "app.zip", url: "https://example.com/app.zip" },
  checked_at: 1700000000,
  error: null,
};

/** 更新日志回包桩：一份日志文件与诊断摘要。 */
const UPDATE_LOG = {
  ok: true,
  hint: "（没有日志）",
  files: [{ name: "update.log", exists: true, size: 1024, truncated: false, content: "[2026-01-01] 下载完成" }],
  diagnostics: {
    current: "1.2.3",
    latest: "1.2.4",
    has_update: true,
    should_prompt: true,
    ignored: null,
    error: null,
    checked_at: 1700000000,
    install_mode_label: "安装版（可自动更新）",
    can_self_update: true,
    zip_asset: { name: "app.zip", url: "https://example.com/app.zip" },
    last_stage: "",
    last_stage_text: "",
  },
};

/** 两条规则：r1 启用（全站 `site=''`）、r2 停用（本站专属），启停与归属徽标各自可认。 */
const RULES = {
  items: [
    {
      rule_id: "r1",
      rule_type: "company",
      pattern: "某外包公司",
      match_mode: "exact",
      scope: "",
      description: "全是外包",
      enabled: true,
      hit_count: 3,
      last_error: "",
      site: "",
      created_at: "2026-01-01 00:00:00",
      updated_at: "2026-01-01 00:00:00",
    },
    {
      rule_id: "r2",
      rule_type: "jd_keyword",
      pattern: "996",
      match_mode: "contains",
      scope: "both",
      description: "",
      enabled: false,
      hit_count: 0,
      last_error: "",
      site: "boss",
      created_at: "2026-01-02 00:00:00",
      updated_at: "2026-01-02 00:00:00",
    },
  ],
};

/** 构造一个 200 JSON 回包。 */
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

/** 按 URL 分流的 fetch 假实现；URL 全等分流，别用 includes 误匹配子路径。 */
function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/platforms") return json(PLATFORMS);
    if (url === "/api/llm/models") return json(MODELS);
    if (url === "/api/llm/test") return json(LLM_TEST_OK);
    if (url === "/api/llm/config") return json(LLM_CONFIG);
    if (url === "/api/system/update/log") return json(UPDATE_LOG);
    if (url === "/api/system/update" || url.startsWith("/api/system/update?")) return json(UPDATE_STATUS);
    if (url === "/api/sites/boss/blacklist/rules") return json(RULES);
    if (url.includes("/blacklist/rules") && method === "POST") {
      return json({ item: { ...RULES.items[0], enabled: false } });
    }
    if (url.includes("/blacklist/rules") && method === "DELETE") return json({ deleted: true });
    return json({ ok: true });
  });
}

/** 在主题、Toast、路由与平台 Provider 里渲染设置页。 */
function renderPage() {
  return render(
    <ThemeModeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={["/settings"]}>
          <PlatformProvider>
            <SettingsPage />
          </PlatformProvider>
        </MemoryRouter>
      </ToastProvider>
    </ThemeModeProvider>,
  );
}

/** 取 fetch 假实现的调用流水（URL + init），断言请求体用。 */
function fetchCalls(): [string, RequestInit | undefined][] {
  return (globalThis.fetch as unknown as Mock).mock.calls.map(([u, init]) => [
    String(u),
    init as RequestInit | undefined,
  ]);
}

/** 每个用例前重置 store、localStorage 与 fetch 桩。 */
beforeEach(() => {
  resetStores();
  globalThis.localStorage?.clear();
  vi.stubGlobal("fetch", stubFetch());
});

/** LLM 配置段：保存、拉模型、测试连通与请求在途状态。 */
describe("SettingsPage LLM 配置", () => {
  /** 三项输入齐全，保存只带 base_url 与 model。 */
  it("三项输入都在，保存走 PUT /api/llm/config（Key 留空不覆盖）", async () => {
    renderPage();

    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("接口地址")).toBeInTheDocument();
    expect(screen.getByLabelText("模型")).toBeInTheDocument();

    expect(await screen.findByDisplayValue("https://api.deepseek.com/v1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/llm/config",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    const put = fetchCalls().find(([u, init]) => u === "/api/llm/config" && init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({
      base_url: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
    });
  });

  /** 拉模型走 POST，Key 只进请求体且结果进下拉。 */
  it("「拉取模型」走 POST /api/llm/models，api_key 只进请求体不进 URL", async () => {
    renderPage();
    expect(await screen.findByDisplayValue("https://api.deepseek.com/v1")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("API Key"), "sk-test-12345678");
    await userEvent.click(screen.getByRole("button", { name: "拉取模型" }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/llm/models",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const modelCalls = fetchCalls().filter(([u]) => u.includes("llm/models"));
    expect(modelCalls.length).toBeGreaterThan(0);
    for (const [u] of modelCalls) expect(u).toBe("/api/llm/models");

    const withKey = modelCalls.find(([, init]) => String(init?.body ?? "").includes("sk-test-12345678"));
    expect(withKey).toBeDefined();
    expect(JSON.parse(String(withKey?.[1]?.body)).api_key).toBe("sk-test-12345678");

    await userEvent.click(screen.getByLabelText("模型"));
    expect(await screen.findByRole("option", { name: "deepseek-reasoner" })).toBeInTheDocument();
  });

  /** 测试连通把后端 message 原样展示。 */
  it("「测试连通」把返回的 message 原样显示出来", async () => {
    renderPage();
    expect(await screen.findByDisplayValue("https://api.deepseek.com/v1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "测试连通" }));
    expect(await screen.findByText("正常，一切就绪")).toBeInTheDocument();
  });

  /** 测试请求在飞时按钮转文案并禁用。 */
  it("「测试连通」请求在飞时按钮转「测试中…」并禁用，防连点重复测", async () => {
    let resolveTest!: (r: Response) => void;
    const testGate = new Promise<Response>((res) => { resolveTest = res; });
    const base = stubFetch();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/llm/test") return testGate;
        return base(input);
      }),
    );
    renderPage();
    expect(await screen.findByDisplayValue("https://api.deepseek.com/v1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "测试连通" }));
    expect(screen.getByRole("button", { name: "测试中…" })).toBeDisabled();

    resolveTest(json({ ok: true, message: "正常，一切就绪" }));
    expect(await screen.findByText("正常，一切就绪")).toBeInTheDocument();
  });

  /** 测试失败时 message 仍走行内 danger 提示。 */
  it("测试失败也是 200 带人话：message 走 danger 行内提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/platforms") return json(PLATFORMS);
        if (url === "/api/llm/test") return json({ ok: false, message: "余额不足，请充值后再试" });
        if (url === "/api/llm/config") return json(LLM_CONFIG);
        return json({ ok: true });
      }),
    );
    renderPage();
    expect(await screen.findByDisplayValue("https://api.deepseek.com/v1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "测试连通" }));
    expect(await screen.findByText("余额不足，请充值后再试")).toBeInTheDocument();
  });
});

/** 程序更新段。 */
describe("SettingsPage 程序更新", () => {
  /** 检查更新带 force，进页面先查一次且读日志。 */
  it("检查更新走 GET /api/system/update", async () => {
    renderPage();
    await screen.findByDisplayValue("https://api.deepseek.com/v1");

    await userEvent.click(screen.getByRole("radio", { name: "程序更新" }));
    expect(await screen.findByText("当前版本")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "检查更新" }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/system/update?force=true",
        expect.objectContaining({ method: "GET" }),
      );
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/system/update",
      expect.objectContaining({ method: "GET" }),
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/system/update/log",
      expect.objectContaining({ method: "GET" }),
    );
  });
});

/** 黑名单规则段。 */
describe("SettingsPage 黑名单规则", () => {
  /** 规则按当前平台渲染，归属徽标与停用接口都对。 */
  it("规则列表按当前平台渲染，「停用」走 toggle 接口", async () => {
    renderPage();
    await screen.findByDisplayValue("https://api.deepseek.com/v1");

    await userEvent.click(screen.getByRole("radio", { name: "黑名单规则" }));
    expect(await screen.findByText("某外包公司")).toBeInTheDocument();
    expect(screen.getByText("996")).toBeInTheDocument();
    expect(screen.getByText("全站")).toBeInTheDocument();
    expect(screen.getByText("本站")).toBeInTheDocument();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/sites/boss/blacklist/rules",
      expect.objectContaining({ method: "GET" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "停用" }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/sites/boss/blacklist/rules/r1/toggle",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const toggle = fetchCalls().find(([u]) => u === "/api/sites/boss/blacklist/rules/r1/toggle");
    expect(JSON.parse(String(toggle?.[1]?.body))).toEqual({ enabled: false });
  });
});

/** 外观段。 */
describe("SettingsPage 外观", () => {
  /** 浅色 / 深色切换反映到根节点 data-theme。 */
  it("浅色/深色切换走 setMode（主题根节点跟着换）", async () => {
    renderPage();
    await screen.findByDisplayValue("https://api.deepseek.com/v1");

    await userEvent.click(screen.getByRole("radio", { name: "外观" }));

    await userEvent.click(await screen.findByRole("radio", { name: "深色" }));
    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
    await userEvent.click(screen.getByRole("radio", { name: "浅色" }));
    await waitFor(() => {
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });
});
