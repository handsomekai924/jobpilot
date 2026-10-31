/**
 * 求职期望缓存（缺陷清单「求职期望不应该每次都请求真实数据」）。
 *
 * 期望列表是「登录后就基本不变」的账号数据：登录完成时拉一次、落 localStorage，
 * 之后 CollectionSheet（求职期望已并入采集条件）读缓存，不再每次打开都打真接口；
 * 用户在招聘站那边改了期望，用页面上的「同步」按钮手动刷新（force）。
 */

import { create } from "zustand";

import { useSessionStore } from "@/stores/sessionStore";
import { filtersApi, type ExpectLists } from "@/api/platform";

/** localStorage 键前缀（按站点分桶）。 */
const STORAGE_PREFIX = "console.expects.";

/** 某站点的期望缓存：列表 + 拉取时间。 */
export interface ExpectCache {
  lists: ExpectLists;
  /** 拉取时间（ms），给手动同步前展示「上次同步」用 */
  at: number;
}

/** 空列表，站点缺失或首屏未拉取时兜底。 */
const EMPTY_LISTS: ExpectLists = { mix: null, expects: [], partTime: [] };

/** 从 localStorage 读某站缓存；缺失或损坏回 `null`。 */
function readStored(site: string): ExpectCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + site);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExpectCache;
    if (!parsed || typeof parsed.at !== "number" || !parsed.lists) return null;
    return {
      at: parsed.at,
      lists: {
        mix: parsed.lists.mix ?? null,
        expects: Array.isArray(parsed.lists.expects) ? parsed.lists.expects : [],
        partTime: Array.isArray(parsed.lists.partTime) ? parsed.lists.partTime : [],
      },
    };
  } catch {
    return null;
  }
}

/** 写某站缓存；存储不可用时静默跳过。 */
function writeStored(site: string, cache: ExpectCache): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + site, JSON.stringify(cache));
  } catch {
  }
}

/** 期望缓存 store 形状。 */
interface ExpectStore {
  bySite: Record<string, ExpectCache>;
  /** 正在拉的站点（同步按钮转圈用） */
  loading: Record<string, boolean>;
  /**
   * 读某站的期望列表：有缓存就直接回，没有才打接口；
   * `force` = 手动同步（用户在平台改过，强制重拉并覆盖缓存）。
   */
  load: (site: string, opts?: { force?: boolean }) => Promise<ExpectLists>;
  /** 测试 / 登出时清内存缓存（localStorage 由调用方按需清） */
  reset: () => void;
}

/** 期望缓存 store（按站点分桶）。 */
export const useExpectStore = create<ExpectStore>((set, get) => ({
  bySite: {},
  loading: {},

  /** 读缓存或拉接口；`force` 时强制重拉并覆盖。 */
  load: async (site, opts) => {
    if (!site) return EMPTY_LISTS;
    const cached = get().bySite[site] ?? readStored(site);
    if (cached && !opts?.force) {
      if (!get().bySite[site]) set((s) => ({ bySite: { ...s.bySite, [site]: cached } }));
      return cached.lists;
    }
    set((s) => ({ loading: { ...s.loading, [site]: true } }));
    try {
      const lists = await filtersApi.expects(site);
      const next: ExpectCache = {
        at: Date.now(),
        lists: {
          mix: lists?.mix ?? null,
          expects: Array.isArray(lists?.expects) ? lists.expects : [],
          partTime: Array.isArray(lists?.partTime) ? lists.partTime : [],
        },
      };
      set((s) => ({ bySite: { ...s.bySite, [site]: next }, loading: { ...s.loading, [site]: false } }));
      writeStored(site, next);
      return next.lists;
    } catch (e) {
      set((s) => ({ loading: { ...s.loading, [site]: false } }));
      throw e;
    }
  },

  reset: () => set({ bySite: {}, loading: {} }),
}));

/** 登录完成后自动拉该站点期望并写缓存。 */
useSessionStore.subscribe((state, prev) => {
  for (const [site, session] of Object.entries(state.sessions)) {
    const was = prev.sessions[site]?.logged_in ?? false;
    if (session.logged_in && !was) {
      void useExpectStore.getState().load(site, { force: true }).catch(() => undefined);
    }
  }
});
