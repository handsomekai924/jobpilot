/** 柱状图：离散序列量级比较，选择性柱帽标注 + 完整取数走表格孪生。 */

import { useMemo } from "react";

import { EmptyState } from "@/components/data/EmptyState";
import { EChart, useChartColors, type ChartOption } from "@/components/data/EChart";
import { fmtCompact, fmtNumber } from "@/utils/format";
import { fontFamily } from "@/theme/tokens";

/** 一根柱：标签、数值与 tooltip 次要说明。 */
export interface ColumnDatum {
  label: string;
  value: number;
  /** tooltip 里的次要说明（悬停/聚焦才出现） */
  hint?: string;
}

/** 柱状图属性。 */
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

/** y 轴刻度取整到 1/2/5×10^k，返回顶值与 0/mid/top 三条刻度。 */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { top: 1, ticks: [0, 0.5, 1] };
  /** 向上取到 1/2/5×10^k。 */
  const ladderCeil = (x: number) => {
    const mag = 10 ** Math.floor(Math.log10(x));
    const norm = x / mag;
    return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  };
  const mid = ladderCeil(max / 2);
  return { top: mid * 2, ticks: [0, mid, mid * 2] };
}

/** 柱状图：细柱 + 选择性柱帽标注，悬停整槽位出 tooltip；空数据出空态。 */
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
      grid: { left: 36, right: 8, top: CAP_ROOM, bottom: X_LABEL_BAND },
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: colors.surface,
        borderColor: colors.divider,
        textStyle: { color: colors.text1, fontSize: 12 },
        axisPointer: { type: "shadow", shadowStyle: { color: colors.surface2 } },
        /** tooltip：值先行，hint 跟在行标签后。 */
        formatter: (params: unknown) => {
          const p = (Array.isArray(params) ? params[0] : params) as {
            value: number;
            dataIndex: number;
          };
          const d = data[p.dataIndex];
          if (!d) return "";
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
          hideOverlap: false,
          formatter: (v: string, i: number) => (showAllLabels || i % 2 === 0 ? v : ""),
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: top,
        interval: ticks[1] - ticks[0],
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
            label: { show: marked.has(i) },
          })),
          barCategoryGap: "2px",
          barMaxWidth: 18,
          itemStyle: { color: colors.accent, borderRadius: [4, 4, 0, 0] },
          label: {
            show: false,
            position: "top",
            distance: 4,
            color: colors.text1,
            fontSize: 11,
            fontFamily,
            fontWeight: 590,
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
