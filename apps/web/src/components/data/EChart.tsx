import { useEffect, useMemo, useRef } from "react";
import { Box, useTheme } from "@mui/material";

import { init, use, type EChartsCoreOption, type EChartsType } from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// 只注册两张图用到的部件（条/柱 + 网格 + tooltip + canvas），不整包 echarts
use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

export type ChartOption = EChartsCoreOption;

export interface EChartProps {
  option: ChartOption;
  /** 容器高（px）：canvas 不随内容撑高，必须显式给 */
  height: number;
  /** 屏读摘要：canvas 内容读不出，整图一个 role="img" 把系列说清 */
  ariaLabel: string;
}

/**
 * 图表配色（明暗两套单色系，都过 validate_palette：#0071E3 / #0A84FF）。
 * canvas 吃不到 CSS 变量，只能从 MUI 主题取具体色值；主题模式来自 useTheme()，
 * 由 ThemeModeProvider 接线——模式一变 option 里的颜色跟着变（见 EChart 的重铺）。
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
 *
 * 无障碍：canvas 内容屏读不透，整图挂 role="img" + 系列摘要 aria-label；
 * 强制高对比（forced-colors）下 canvas 不会跟着换系统色——完整取数走
 * ChartCard 的表格孪生（MANDATORY），这里不重复兜底。
 */
export function EChart({ option, height, ariaLabel }: EChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const chart = init(el, undefined, { renderer: "canvas" });
    // 零尺寸/无 canvas 环境拿不到实例（jsdom），此时连 resize/dispose 一起跳过
    if (!chart) return;
    chartRef.current = chart;

    // jsdom 没有 ResizeObserver——降级 window resize；浏览器里才做像素级跟随
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

  // 数据或主题一变就整体重铺（notMerge：轴范围、标注下标不残留旧状态）
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
