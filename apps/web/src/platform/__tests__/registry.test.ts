/** 平台注册表与路由分类的单测。 */

import { describe, expect, it } from "vitest";

import { byId, siteIdFromPath } from "../registry";
import { platformKeyFromPath, routeSegmentForKey, sharedKeyFromPath } from "../../routes/match";
import type { PlatformDescriptor } from "../types";

/** 已登录的 BOSS 描述符（带 `expect` 私有入口）。 */
const BOSS = {
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
  nav_extras: [{ key: "expect", label: "求职期望", route: "expect" }],
} as unknown as PlatformDescriptor;

/** 第二个平台：无私有入口，用来验降级。 */
const OTHER = {
  ...BOSS,
  site_id: "51job",
  display_name: "前程无忧",
  nav_extras: [],
} as unknown as PlatformDescriptor;

/** 两个平台的清单。 */
const LIST = [BOSS, OTHER];

/** 验描述符查找与 URL 首段判定。 */
describe("registry", () => {
  /** 验只认已注册站点，空值与未知站点回 undefined。 */
  it("byId 只认已注册站点", () => {
    expect(byId(LIST, "boss")?.display_name).toBe("BOSS直聘");
    expect(byId(LIST, "51job")).toBeDefined();
    expect(byId(LIST, "notasite")).toBeUndefined();
    expect(byId(LIST, null)).toBeUndefined();
  });

  /** 验首段是站点 id 才算平台作用域。 */
  it("siteIdFromPath：首段是站点 id 才算平台作用域", () => {
    expect(siteIdFromPath("/boss/jobs", LIST)).toBe("boss");
    expect(siteIdFromPath("/51job", LIST)).toBe("51job");
    expect(siteIdFromPath("/overview", LIST)).toBeNull();
    expect(siteIdFromPath("/notasite/jobs", LIST)).toBeNull();
    expect(siteIdFromPath("/", LIST)).toBeNull();
  });
});

/** 验共用/平台路由分类与反查。 */
describe("routes/match", () => {
  /** 验共用路由 key 判定。 */
  it("共用路由 key 判定", () => {
    expect(sharedKeyFromPath("/overview", LIST)).toBe("overview");
    expect(sharedKeyFromPath("/resumes", LIST)).toBe("resumes");
    expect(sharedKeyFromPath("/settings", LIST)).toBe("settings");
    expect(sharedKeyFromPath("/boss/jobs", LIST)).toBeNull();
    expect(sharedKeyFromPath("/nonesuch", LIST)).toBeNull();
  });

  /** 验平台路由 key 来自固定项 + nav_extras。 */
  it("平台路由 key 判定：固定项 + nav_extras", () => {
    expect(platformKeyFromPath("/boss/login", LIST)).toBe("login");
    expect(platformKeyFromPath("/boss/jobs", LIST)).toBe("jobs");
    expect(platformKeyFromPath("/boss/deliver", LIST)).toBe("deliver");
    expect(platformKeyFromPath("/boss/settings", LIST)).toBeNull();
    expect(platformKeyFromPath("/boss/expect", LIST)).toBe("expect");
    expect(platformKeyFromPath("/51job/expect", LIST)).toBeNull();
    expect(platformKeyFromPath("/overview", LIST)).toBeNull();
  });

  /** 验由路由 key 反查路由段（切平台原地换站点用）。 */
  it("routeSegmentForKey 反查路由段（切平台原地换站点用）", () => {
    expect(routeSegmentForKey("jobs", BOSS)).toBe("jobs");
    expect(routeSegmentForKey("expect", BOSS)).toBe("expect");
    expect(routeSegmentForKey("expect", OTHER)).toBeNull();
    expect(routeSegmentForKey("nonesuch", BOSS)).toBeNull();
    expect(routeSegmentForKey("jobs", null)).toBeNull();
  });
});
