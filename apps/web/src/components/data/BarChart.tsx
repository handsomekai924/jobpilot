import { useMemo } from "react";

import { EmptyState } from "./EmptyState";
import { EChart, useChartColors, type ChartOption } from "./EChart";
import { fmtNumber } from "../../utils/format";
import { fontFamily } from "../../theme/tokens";

export interface BarDatum {
  label: string;
  value: number;
  /** tooltip 里的次要说明（悬停/聚焦才出现） */
  hint?: string;
}

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

/**
 * 横向条形图（nominal 类目排名）。
 *
 * dataviz 规范：所有条同用 slot-1 蓝（`--accent`，名义类目不按数值渐变）；
 * 条粗 14px、数据端 4px 圆角、基线端直角，行距 2px 表面间隙（barCategoryGap）；
 * 悬停整行出 tooltip（trigger=axis，命中区即行块）；数值直接标在条末
 * （这是「标注放到条末」的形态，不是每点一数的散点）。单系列不出图例——
 * 标题就是系列名。数值另有表格孪生兜底。
 */
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
      // 类目标签长短不一（含中文），containLabel 自动留位；右留 8% 给条末标注
      grid: { left: 8, right: 8, top: 6, bottom: 6, containLabel: true },
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
          // 值先行、行标签与 hint 次之（与原 DOM 版层级一致）
          return (
            `<div style="font-weight:600">${formatValue(p.value)}${unit}</div>` +
            `<div style="color:${colors.text2}">${d.label}${d.hint ? ` · ${d.hint}` : ""}</div>`
          );
        },
      },
      xAxis: {
        type: "value",
        show: false,
        // 满值只占 TIP_RESERVE_PCT，条末右侧空出一行给直接标注
        max: max > 0 ? (max * 100) / TIP_RESERVE_PCT : undefined,
      },
      yAxis: {
        type: "category",
        inverse: true, // 首项在上（ECharts 默认首项在下）
        data: data.map((d) => d.label),
        // 基线/零线用分割线本色、略强于网格（本图不出横向网格线）
        axisLine: { lineStyle: { color: colors.divider, width: 1 } },
        axisTick: { show: false },
        axisLabel: {
          color: colors.text2,
          fontSize: 12,
          fontFamily,
          interval: 0, // 行高 28px 不挤，类目全出
        },
      },
      series: [
        {
          type: "bar",
          data: data.map((d) => d.value),
          barCategoryGap: "2px", // 相邻条 2px 表面间隙（barGap 是多系列间距，单系列用不到）
          barMaxWidth: 14, // 细标记：条粗 ~14px（密集时随行宽收细，不重叠）
          itemStyle: { color: colors.accent, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: "right",
            distance: 6,
            color: colors.text1,
            fontSize: 12,
            fontFamily,
            // 数值直接标在条末（established pattern）：值 + 单位
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
