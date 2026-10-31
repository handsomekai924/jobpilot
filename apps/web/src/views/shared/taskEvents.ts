/**
 * 任务事件流归一：收口各业务任务不一的 `events` 形状，拼成 `EventStream` 认的 `TaskEvent`。
 *
 * 兼容 `event` / `type` / `payload` 等变体，并把「第 N 页 · 入库 +N」这类可读行拼出来。
 */

import type { EventKind, TaskEvent } from "../../components";

/** 后端事件原始形状（宽松：各业务任务自己拼的字典）。 */
export interface RawEvent {
  at?: number | string | null;
  ts?: number | string | null;
  time?: number | string | null;
  name?: string;
  event?: string;
  type?: string;
  payload?: Record<string, unknown>;
  [k: string]: unknown;
}

const ERROR_RE = /error|fail|bad|stopped/i;
const OK_RE = /ok|done|finish|success|sent/i;
const WARN_RE = /skip|cancel|warn/i;

/** 按事件名猜语义色调（错 / 成 / 警 / 常）。 */
function kindOf(name: string): EventKind {
  if (ERROR_RE.test(name)) return "error";
  if (OK_RE.test(name)) return "ok";
  if (WARN_RE.test(name)) return "warn";
  return "info";
}

/** 事件名 + 平铺字段 → 一行人话（对齐 legacy `formatEventLabel` 的主干分支）。 */
export function formatEventLabel(name: string, f: Record<string, unknown>): string {
  const n = String(name);
  const job = String(f.job_name ?? "");
  const brand = String(f.brand ?? f.brand_name ?? "");
  const who = job ? (brand ? `${job} @ ${brand}` : job) : "";

  const page = f.page;
  if (page != null && (f.inserted != null || f.kept_count != null)) {
    return `第 ${page} 页 · 原始 ${f.raw_count ?? "?"} · 入库 +${f.inserted ?? 0} · 更新 ${f.updated ?? 0}`;
  }
  if (who && (f.score != null || f.total != null)) {
    return `${who} · ${f.score ?? f.total}`;
  }
  if (who) return `${n} · ${who}`;
  if (f.detail != null) return `${n} · ${String(f.detail)}`;
  if (f.message != null) return `${n} · ${String(f.message)}`;
  return n;
}

/** 后端事件数组 → `EventStream` 事件数组。 */
export function toTaskEvents(raw: unknown, limit = 30): TaskEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: TaskEvent[] = [];
  for (const item of raw.slice(-limit)) {
    if (!item || typeof item !== "object") continue;
    const ev = item as RawEvent;
    const flat: Record<string, unknown> = { ...ev };
    if (ev.payload && typeof ev.payload === "object") Object.assign(flat, ev.payload);
    const name = String(ev.name ?? ev.event ?? ev.type ?? "event");
    out.push({
      name: formatEventLabel(name, flat),
      at: (ev.at ?? ev.ts ?? ev.time ?? null) as number | string | null,
      kind: kindOf(name),
    });
  }
  return out;
}
