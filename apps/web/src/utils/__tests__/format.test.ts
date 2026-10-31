/** 格式化与防抖工具的单测。 */

import { describe, expect, it, vi } from "vitest";
import { debounce, fmtClock, fmtCompact, fmtEta, fmtNumber, fmtTime, sanitize } from "../format";

/** 验时间格式化与无效值兜底。 */
describe("fmtTime / fmtClock", () => {
  /** 验秒级时间戳 → 本地化，无效值 → 兜底文案。 */
  it("秒级时间戳 → 本地化；无效 → 兜底", () => {
    const ts = 1700000000;
    expect(fmtTime(ts)).toContain("2023");
    expect(fmtTime(null)).toBe("—");
    expect(fmtTime("not-a-date")).toBe("—");
    expect(fmtClock(ts)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(fmtClock(undefined)).toBe("--:--:--");
  });

  /** 验 Date 对象可直接传入。 */
  it("Date 对象可用", () => {
    const d = new Date(2026, 0, 1, 8, 30, 0);
    expect(fmtTime(d)).toContain("2026");
  });
});

/** 验剩余时间的秒/分/时三段文案。 */
describe("fmtEta", () => {
  /** 验秒、分、时三段文案与非法值兜底。 */
  it("秒/分/时三段文案", () => {
    expect(fmtEta(48)).toBe("48 秒");
    expect(fmtEta(192)).toBe("3 分 12 秒");
    expect(fmtEta(180)).toBe("3 分");
    expect(fmtEta(3720)).toBe("1 小时 2 分");
    expect(fmtEta(-1)).toBe("…");
    expect(fmtEta(NaN)).toBe("…");
    expect(fmtEta(null)).toBe("…");
  });
});

/** 验千分位与无效值兜底。 */
describe("fmtNumber", () => {
  /** 验千分位；无效值 → 「—」。 */
  it("千分位；无效 → —", () => {
    expect(fmtNumber(12345)).toBe("12,345");
    expect(fmtNumber(null)).toBe("—");
    expect(fmtNumber(Infinity)).toBe("—");
  });
});

/** 验数字紧凑写法与无效值兜底。 */
describe("fmtCompact", () => {
  /** 验 <1000 原样、≥1000 紧凑；无效值 → 「—」。 */
  it("<1000 原样，≥1000 紧凑；无效 → —", () => {
    expect(fmtCompact(0)).toBe("0");
    expect(fmtCompact(42)).toBe("42");
    expect(fmtCompact(1000)).toBe("1K");
    expect(fmtCompact(1200)).toBe("1.2K");
    expect(fmtCompact(2000)).toBe("2K");
    expect(fmtCompact(1_500_000)).toBe("1.5M");
    expect(fmtCompact(null)).toBe("—");
    expect(fmtCompact(NaN)).toBe("—");
  });
});

/** 验 HTML 特殊字符转义。 */
describe("sanitize", () => {
  /** 验转义 HTML 特殊字符。 */
  it("转义 HTML 特殊字符", () => {
    expect(sanitize('<img src=x onerror="a">')).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;");
    expect(sanitize("a & b")).toBe("a &amp; b");
    expect(sanitize(null)).toBe("");
  });
});

/** 验防抖只留最后一次调用且可取消。 */
describe("debounce", () => {
  /** 验只留最后一次调用；cancel 可取消。 */
  it("只留最后一次调用；cancel 可取消", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(2);

    d(3);
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
