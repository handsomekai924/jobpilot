/** ECharts 生命周期壳：init/resize/dispose 与配色 hook，canvas 内容靠 aria-label 兜底。 */

import { useEffect, useMemo, useRef } from "react";
import { Box, useTheme } from "@mui/material";

import { init, use, type EChartsCoreOption, type EChartsType } from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

/** ECharts 配置项。 */
export type ChartOption = EChartsCoreOption;

/** 图表壳属性。 */
export interface EChartProps {
  option: ChartOption;
  /** 容器高（px）：canvas 不随内容撑高，必须显式给 */
  height: number;
  /** 屏读摘要：canvas 内容读不出，整图一个 role="img" 把系列说清 */
  ariaLabel: string;
}

/**
 * 图表配色（明暗两套单色系，都过 validate_palette：`#0071E3` / `#0A84FF`）。
 * canvas 吃不到 CSS 变量，只能从 MUI 主题取具体色值。
 */
export function useChartColors() {
  const theme = useTheme();
  return useMemo(
    () => ({
      accent: theme.palette.primary.main,
      text1: theme.palette.text.primary,
      text2: theme.palette.text.secondary,
      divider: theme.palette.divider,
      surface: theme.palette.background.paper,
      surface2: theme.palette.surface2,
    }),
    [theme],
  );
}

/**
 * ECharts 生命周期壳：init/resize/dispose + option 重铺。
 * 整图挂 `role="img"` + 系列摘要，完整取数走 ChartCard 的表格孪生。
 */
export function EChart({ option, height, ariaLabel }: EChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const chart = init(el, undefined, { renderer: "canvas" });
    if (!chart) return;
    chartRef.current = chart;

    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => chart.resize())
      : null;
    const onResize = () => chart.resize();
    if (ro) ro.observe(el);
    else window.addEventListener("resize", onResize);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <Box
      ref={hostRef}
      role="img"
      aria-label={ariaLabel}
      sx={{ width: "100%", height: `${height}px` }}
    />
  );
}
