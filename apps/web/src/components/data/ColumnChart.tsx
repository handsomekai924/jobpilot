import { useMemo } from "react";

import { EmptyState } from "./EmptyState";
import { EChart, useChartColors, type ChartOption } from "./EChart";
import { fmtCompact, fmtNumber } from "../../utils/format";
import { fontFamily } from "../../theme/tokens";

export interface ColumnDatum {
  label: string;
  value: number;
  /** tooltip 里的次要说明（悬停/聚焦才出现） */
  hint?: string;
}

export interface ColumnChartProps {
  data: ColumnDatum[];
  /** 跟在数值后的单位（「42 个」） */
  unit?: string;
  formatValue?: (v: number) => string;
  /** 直接标注柱帽的下标；默认只标最大值（选择性标注，不给每根柱都写数字） */
  labeled?: number[];
  /** 绘图区高度（x 轴标签带另算，容器自适应增高） */
  plotHeight?: number;
}

/** 柱帽直接标注的顶部留白 */
const CAP_ROOM = 20;
/** x 轴标签带（算在图里，容器随内容增高） */
const X_LABEL_BAND = 22;

/** y 刻度取整到 1/2/5×10^k：mid 之上再翻倍封顶，0/mid/top 三条 */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { top: 1, ticks: [0, 0.5, 1] };
  const ladderCeil = (x: number) => {
    const mag = 10 ** Math.floor(Math.log10(x));
    const norm = x / mag;
    return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  };
  const mid = ladderCeil(max / 2);
  return { top: mid * 2, ticks: [0, mid, mid * 2] };
}

/**
 * 柱状图（离散序列的量级比较，如每页采集流水）。
 *
 * dataviz 规范：柱同用 slot-1 蓝（`--accent`），柱宽 ≤18px、柱帽 4px 圆角、
 * 基线端直角，柱间 2px 表面间隙（barCategoryGap）；柱帽直接标注只标极值
 * （选择性标注），其余数值靠悬停/聚焦 tooltip 与表格孪生；y 刻度取整到干净
 * 数字，网格线是 1px 实线、退到背景（零线稍强）；命中区是整条槽位（≥24px，
 * 也兜住 0 值——trigger=axis）。x 标签过密时隔一个显示，不硬塞不裁切。
 */
export function ColumnChart({
  data,
  unit = "",
  formatValue = fmtNumber,
  labeled,
  plotHeight = 160,
}: ColumnChartProps) {
  const colors = useChartColors();

  const option = useMemo<ChartOption>(() => {
    const max = data.reduce((m, d) => Math.max(m, d.value), 0);
    const { top, ticks } = niceScale(max);
    const showAllLabels = data.length <= 8;
    const marked = new Set(
      labeled ?? [data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -Infinity) ? i : best), 0)],
    );
    return {
      textStyle: { fontFamily },
      // 显式边距：左 36px 放 y 刻度，顶 20px 给柱帽标注，底 22px 是 x 标签带
      grid: { left: 36, right: 8, top: CAP_ROOM, bottom: X_LABEL_BAND },
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: colors.surface,
        borderColor: colors.divider,
        textStyle: { color: colors.text1, fontSize: 12 },
        axisPointer: { type: "shadow", shadowStyle: { color: colors.surface2 } },
        formatter: (params: unknown) => {
          const p = (Array.isArray(params) ? params[0] : params) as {
            value: number;
            dataIndex: number;
          };
          const d = data[p.dataIndex];
          if (!d) return "";
          // 值先行；hint（页/原始/丢弃/新增/更新）跟在行标签后
          return (
            `<div style="font-weight:600">${formatValue(p.value)}${unit}</div>` +
            `<div style="color:${colors.text2}">${d.label}${d.hint ? ` · ${d.hint}` : ""}</div>`
          );
        },
      },
      xAxis: {
        type: "category",
        data: data.map((d) => d.label),
        axisLine: { lineStyle: { color: colors.divider, width: 1 } },
        axisTick: { show: false },
        axisLabel: {
          color: colors.text2,
          fontSize: 11,
          fontFamily,
          interval: 0,
          hideOverlap: false, // 隔一个显示由 formatter 控制，不交给自动隐藏（不硬塞不裁切）
          formatter: (v: string, i: number) => (showAllLabels || i % 2 === 0 ? v : ""),
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: top,
        interval: ticks[1] - ticks[0], // 0/mid/top 三条
        // 零线用分割线本色、稍强；网格 1px 实线退一档（canvas 画不了 tabular-nums，
        // 等宽数字只落表格孪生的数值列）
        axisLine: { show: true, lineStyle: { color: colors.divider, width: 1 } },
        axisTick: { show: false },
        axisLabel: {
          color: colors.text2,
          fontSize: 11,
          fontFamily,
          formatter: (v: number) => fmtCompact(v),
        },
        splitLine: { lineStyle: { color: colors.divider, width: 1, opacity: 0.6 } },
      },
      series: [
        {
          type: "bar",
          data: data.map((d, i) => ({
            value: d.value,
            // 选择性标注：只给指定下标（默认最大值）开柱帽数字
            label: { show: marked.has(i) },
          })),
          barCategoryGap: "2px", // 相邻柱 2px 表面间隙（barGap 是多系列间距，单系列用不到）
          barMaxWidth: 18, // 细标记：柱宽 ≤18px（密集时随槽位收细，不重叠）
          itemStyle: { color: colors.accent, borderRadius: [4, 4, 0, 0] },
          label: {
            show: false,
            position: "top",
            distance: 4,
            color: colors.text1,
            fontSize: 11,
            fontFamily,
            fontWeight: 590,
            // 柱帽只写数字不带单位（短促极值标注），完整数值在 tooltip 与表格孪生
            formatter: (p: { value: number }) => formatValue(p.value),
          },
        },
      ],
    };
  }, [data, unit, formatValue, labeled, colors]);

  if (data.length === 0) {
    return <EmptyState title="暂无数据" />;
  }

  return (
    <EChart
      option={option}
      height={plotHeight + CAP_ROOM + X_LABEL_BAND}
      ariaLabel={`柱状图：${data.map((d) => `${d.label} ${formatValue(d.value)}${unit}`).join("、")}`}
    />
  );
}
