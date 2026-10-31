/** 横向条形图：名义类目排名，条末直接标注 + 完整取数走表格孪生。 */

import { useMemo } from "react";

import { EmptyState } from "./EmptyState";
import { EChart, useChartColors, type ChartOption } from "./EChart";
import { fmtNumber } from "../../utils/format";
import { fontFamily } from "../../theme/tokens";

/** 一条横向柱：标签、数值与 tooltip 次要说明。 */
export interface BarDatum {
  label: string;
  value: number;
  /** tooltip 里的次要说明（悬停/聚焦才出现） */
  hint?: string;
}

/** 条形图属性。 */
export interface BarChartProps {
  data: BarDatum[];
  /** 跟在数值后的单位（「312 个」） */
  unit?: string;
  formatValue?: (v: number) => string;
}

/** 条的满值宽度留白：给条末直接标注（value at the tip）留位置 */
const TIP_RESERVE_PCT = 74;

/** 行块高度：24px 命中轨 + 2px 行间表面间隙 ≈ 28px 行（原 DOM 版比例） */
const ROW_PITCH = 30;

/** 条形图：细条 + 2px 行距，值标在条末，悬停整行出 tooltip；空数据出空态。 */
export function BarChart({
  data,
  unit = "",
  formatValue = fmtNumber,
}: BarChartProps) {
  const colors = useChartColors();

  const option = useMemo<ChartOption>(() => {
    const max = data.reduce((m, d) => Math.max(m, d.value), 0);
    return {
      textStyle: { fontFamily },
      grid: { left: 8, right: 8, top: 6, bottom: 6, containLabel: true },
      tooltip: {
        trigger: "axis",
        confine: true,
        backgroundColor: colors.surface,
        borderColor: colors.divider,
        textStyle: { color: colors.text1, fontSize: 12 },
        axisPointer: { type: "shadow", shadowStyle: { color: colors.surface2 } },
        /** tooltip：值先行，行标签与 hint 次之。 */
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
        type: "value",
        show: false,
        max: max > 0 ? (max * 100) / TIP_RESERVE_PCT : undefined,
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.map((d) => d.label),
        axisLine: { lineStyle: { color: colors.divider, width: 1 } },
        axisTick: { show: false },
        axisLabel: {
          color: colors.text2,
          fontSize: 12,
          fontFamily,
          interval: 0,
        },
      },
      series: [
        {
          type: "bar",
          data: data.map((d) => d.value),
          barCategoryGap: "2px",
          barMaxWidth: 14,
          itemStyle: { color: colors.accent, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: "right",
            distance: 6,
            color: colors.text1,
            fontSize: 12,
            fontFamily,
            formatter: (p: { value: number }) => `${formatValue(p.value)}${unit}`,
          },
        },
      ],
    };
  }, [data, unit, formatValue, colors]);

  if (data.length === 0) {
    return <EmptyState title="暂无数据" />;
  }

  return (
    <EChart
      option={option}
      height={data.length * ROW_PITCH + 12}
      ariaLabel={`条形图：${data.map((d) => `${d.label} ${formatValue(d.value)}${unit}`).join("、")}`}
    />
  );
}
