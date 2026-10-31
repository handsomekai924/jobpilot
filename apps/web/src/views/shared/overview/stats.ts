/**
 * 总览「职位库」数据：归一并合并各站点 `GET /api/sites/{site}/jobs/stats` 的返回。
 *
 * 后端形状与合并口径见 `notes/apps/web/src/views/shared/overview/stats.md`。
 */

/** 城市计数。 */
export interface CityCount {
  city: string;
  count: number;
}

/** 一条采集流水（`at` 为 "YYYY-MM-DD HH:MM:SS"）。 */
export interface PageLogRow {
  site: string;
  page: number;
  at: string;
  raw: number;
  kept: number;
  dropped: number;
  inserted: number;
  updated: number;
}

/** 合并后的职位库统计。 */
export interface LibraryStats {
  jobs: number;
  pages: number;
  raw: number;
  kept: number;
  dropped: number;
  missingDesc: number;
  cities: CityCount[];
  pageLog: PageLogRow[];
}

export const CITY_LIMIT = 8;
export const PAGE_LOG_LIMIT = 10;

/** 非有限数字一律归 0。 */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** 归一单条城市计数；形状不对回 null。 */
function cityRow(v: unknown): CityCount | null {
  if (typeof v !== "object" || v == null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.city !== "string") return null;
  return { city: o.city, count: num(o.count) };
}

/** 归一单条采集流水；形状不对回 null。 */
function pageRow(site: string, v: unknown): PageLogRow | null {
  if (typeof v !== "object" || v == null) return null;
  const o = v as Record<string, unknown>;
  return {
    site,
    page: num(o.page),
    at: typeof o.fetched_at === "string" ? o.fetched_at : "",
    raw: num(o.raw_count),
    kept: num(o.kept_count),
    dropped: num(o.dropped_count),
    inserted: num(o.inserted ?? o.inserted_count),
    updated: num(o.updated ?? o.updated_count),
  };
}

/** 单站点 stats 归一；完全不是 stats 形状（关键字段全缺）→ null，免得把别的 JSON 画成全 0。 */
export function normalizeStats(site: string, raw: unknown): LibraryStats | null {
  if (typeof raw !== "object" || raw == null) return null;
  const o = raw as Record<string, unknown>;
  if (o.jobs == null && o.pages == null && o.top_cities == null && o.pages_log == null) return null;

  const cities = (Array.isArray(o.top_cities) ? o.top_cities : [])
    .map(cityRow)
    .filter((c): c is CityCount => c != null);
  const pageLog = (Array.isArray(o.pages_log) ? o.pages_log : [])
    .map((r) => pageRow(site, r))
    .filter((r): r is PageLogRow => r != null);

  return {
    jobs: num(o.jobs),
    pages: num(o.pages),
    raw: num(o.raw_seen),
    kept: num(o.kept_seen),
    dropped: num(o.dropped_seen),
    missingDesc: num(o.missing_desc),
    cities,
    pageLog,
  };
}

/**
 * 多站点合并：计数求和；城市按名字求和取前 N（各站点的 top_cities 是各自
 * LIMIT 10，合并是近似，总览用途够）；页流水按时间倒序取最近 N 条再翻回时间正序。
 * fetched_at 是定宽字符串，localeCompare 就是时间序。
 */
export function mergeStats(raws: Array<{ site: string; data: unknown }>): LibraryStats {
  const parts = raws
    .map(({ site, data }) => normalizeStats(site, data))
    .filter((p): p is LibraryStats => p != null);

  const cityMap = new Map<string, number>();
  for (const p of parts) {
    for (const c of p.cities) {
      cityMap.set(c.city, (cityMap.get(c.city) ?? 0) + c.count);
    }
  }
  const cities = [...cityMap.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, CITY_LIMIT);

  const pageLog = parts
    .flatMap((p) => p.pageLog)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, PAGE_LOG_LIMIT)
    .reverse();

  const sum = (f: (p: LibraryStats) => number) => parts.reduce((n, p) => n + f(p), 0);
  return {
    jobs: sum((p) => p.jobs),
    pages: sum((p) => p.pages),
    raw: sum((p) => p.raw),
    kept: sum((p) => p.kept),
    dropped: sum((p) => p.dropped),
    missingDesc: parts.reduce((n, p) => Math.max(n, p.missingDesc), 0),
    cities,
    pageLog,
  };
}
