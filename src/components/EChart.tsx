import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import type { Theme } from '@common/styles/theme';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

export function EChart({ option, height }: { option: EChartsCoreOption; height: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const chart = echarts.init(container);
    chartRef.current = chart;
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} style={{ width: '100%', height: `${height}px` }} />;
}

export function baseChartOption(theme: Theme): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: theme.colors.textMuted, fontFamily: theme.fontFamily },
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      textStyle: { color: theme.colors.text, fontSize: 12 },
    },
  };
}

export function axisStyle(theme: Theme) {
  return {
    axisLine: { lineStyle: { color: theme.colors.border } },
    axisTick: { lineStyle: { color: theme.colors.border } },
    axisLabel: { color: theme.colors.textMuted, fontSize: 11 },
    splitLine: { lineStyle: { color: theme.colors.border, opacity: 0.6 } },
  };
}

export function chartPalette(theme: Theme): string[] {
  return [
    theme.colors.primary,
    '#0ea5e9',
    '#4f46e5',
    theme.colors.success,
    theme.colors.warning,
    theme.colors.danger,
    '#93c5fd',
    '#a5b4fc',
    '#64748b',
    '#f59e0b',
  ];
}
