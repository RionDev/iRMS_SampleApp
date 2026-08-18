import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@common/components/AppLayout';
import { SearchSelect } from '@common/components/SearchSelect';
import { useAppAccess } from '@common/hooks/useAuth';
import { useThemeStore } from '@common/stores/themeStore';
import type { Theme } from '@common/styles/theme';
import type { EChartsCoreOption } from 'echarts/core';
import { ChartCard, ChartState } from '../components/ChartCard';
import { EChart, axisStyle, baseChartOption, chartPalette } from '../components/EChart';
import { KpiCard } from '../components/KpiCard';
import { sampleNavItems } from '../navigation';
import {
  getDailyStats,
  getDetectionRatioStats,
  getFilterMeta,
  getLocalesStats,
  getStatsSummary,
  getTopDetections,
  getTypesStats,
} from '../services/sampleService';
import type { FilterMeta, NameCount } from '../types/sample';

const PERIODS = [
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
  { label: '1년', days: 365 },
] as const;

interface StatState<T> {
  data: T | null;
  loading: boolean;
  failed: boolean;
}

function useStat<T>(fetcher: () => Promise<T>, deps: unknown[]): StatState<T> {
  const [state, setState] = useState<StatState<T>>({ data: null, loading: true, failed: false });
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, failed: false });
    fetcher()
      .then((data) => {
        if (active) setState({ data, loading: false, failed: false });
      })
      .catch(() => {
        if (active) setState({ data: null, loading: false, failed: true });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function StatBody<T>({
  state,
  height,
  children,
}: {
  state: StatState<T>;
  height: number;
  children: (data: T) => React.ReactNode;
}) {
  if (state.loading) return <ChartState height={height}>로딩 중...</ChartState>;
  if (state.failed || !state.data) {
    return <ChartState height={height}>통계를 불러오지 못했습니다.</ChartState>;
  }
  return <>{children(state.data)}</>;
}

function horizontalBarOption(
  theme: Theme,
  items: NameCount[],
  color: string,
  labelWidth = 90,
): EChartsCoreOption {
  const sorted = [...items].sort((a, b) => a.count - b.count);
  return {
    ...baseChartOption(theme),
    grid: { left: labelWidth + 16, right: 56, top: 8, bottom: 24 },
    xAxis: { type: 'value', ...axisStyle(theme) },
    yAxis: {
      type: 'category',
      data: sorted.map((item) => item.name),
      ...axisStyle(theme),
      axisLabel: {
        color: theme.colors.textMuted,
        fontSize: 11,
        width: labelWidth,
        overflow: 'truncate',
      },
    },
    series: [
      {
        type: 'bar',
        data: sorted.map((item) => item.count),
        itemStyle: { color, borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 18,
        label: { show: true, position: 'right', color: theme.colors.textMuted, fontSize: 10 },
      },
    ],
  };
}

export function StatsPage() {
  useAppAccess('/sample');
  const { theme } = useThemeStore();
  const [days, setDays] = useState(30);
  const [vendorId, setVendorId] = useState<number | null>(null);

  const summary = useStat(() => getStatsSummary(), []);
  const daily = useStat(() => getDailyStats(days), [days]);
  const types = useStat(() => getTypesStats(), []);
  const locales = useStat(() => getLocalesStats(), []);
  const ratio = useStat(() => getDetectionRatioStats(), []);
  const filters = useStat<FilterMeta>(() => getFilterMeta(), []);
  const top = useStat(
    () =>
      vendorId === null
        ? Promise.resolve({ vendor_id: null, items: [] })
        : getTopDetections(vendorId),
    [vendorId],
  );

  useEffect(() => {
    if (vendorId === null && filters.data?.vendors.length) {
      setVendorId(filters.data.vendors[0].id);
    }
  }, [filters.data, vendorId]);

  const blackRatio = useMemo(() => {
    if (!summary.data) return null;
    const total = summary.data.pools.reduce((sum, pool) => sum + pool.count, 0);
    const black = summary.data.pools.find((pool) => pool.name.toLowerCase() === 'black')?.count ?? 0;
    return total ? Math.round((black / total) * 100) : 0;
  }, [summary.data]);

  const dailyOption = useMemo<EChartsCoreOption | null>(() => {
    if (!daily.data) return null;
    return {
      ...baseChartOption(theme),
      grid: { left: 56, right: 24, top: 16, bottom: 28 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: daily.data.items.map((item) => item.date),
        ...axisStyle(theme),
        axisLabel: { color: theme.colors.textMuted, fontSize: 11, formatter: (v: string) => v.slice(5) },
      },
      yAxis: { type: 'value', ...axisStyle(theme) },
      series: [
        {
          name: '등록 수',
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: daily.data.items.map((item) => item.count),
          lineStyle: { color: theme.colors.primary, width: 2 },
          itemStyle: { color: theme.colors.primary },
          areaStyle: { color: theme.colors.primary, opacity: 0.12 },
        },
      ],
    };
  }, [daily.data, theme]);

  const localesOption = useMemo<EChartsCoreOption | null>(() => {
    if (!locales.data) return null;
    return {
      ...baseChartOption(theme),
      tooltip: {
        trigger: 'item',
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        textStyle: { color: theme.colors.text, fontSize: 12 },
      },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'middle',
        textStyle: { color: theme.colors.textMuted, fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          center: ['40%', '50%'],
          color: chartPalette(theme),
          data: locales.data.items.map((item) => ({ name: item.name, value: item.count })),
          label: { show: false },
          itemStyle: { borderColor: theme.colors.surface, borderWidth: 1 },
        },
      ],
    };
  }, [locales.data, theme]);

  const ratioOption = useMemo<EChartsCoreOption | null>(() => {
    if (!ratio.data) return null;
    return {
      ...baseChartOption(theme),
      grid: { left: 56, right: 16, top: 16, bottom: 40 },
      xAxis: {
        type: 'category',
        data: ratio.data.buckets.map((bucket) => bucket.range),
        ...axisStyle(theme),
        axisLabel: { color: theme.colors.textMuted, fontSize: 10, rotate: 30 },
      },
      yAxis: { type: 'value', ...axisStyle(theme) },
      series: [
        {
          type: 'bar',
          data: ratio.data.buckets.map((bucket) => bucket.count),
          itemStyle: { color: theme.colors.warning, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 26,
        },
      ],
    };
  }, [ratio.data, theme]);

  const CHART_H = 280;
  return (
    <AppLayout
      title="샘플 통계"
      appName="샘플"
      sidebarItems={sampleNavItems}
      version={__APP_VERSION__}
      contentMaxWidth="1700px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <KpiCard label="전체 샘플" value={summary.data?.total_samples.toLocaleString() ?? '—'} />
          <KpiCard label="최근 24시간" value={summary.data?.last_24h.toLocaleString() ?? '—'} accentColor={theme.colors.primary} />
          <KpiCard label="최근 7일" value={summary.data?.last_7d.toLocaleString() ?? '—'} accentColor={theme.colors.primary} />
          <KpiCard label="평균 진단율" value={summary.data ? `${summary.data.avg_detect_ratio}%` : '—'} accentColor={theme.colors.warning} />
          <KpiCard
            label="Black 풀 비율"
            value={blackRatio === null ? '—' : `${blackRatio}%`}
            accentColor={theme.colors.danger}
            sub={summary.data?.pools.map((pool) => `${pool.name} ${pool.count.toLocaleString()}`).join(' · ')}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
          <ChartCard
            title="일별 등록 추이"
            style={{ gridColumn: 'span 2' }}
            controls={
              <div style={{ display: 'flex', gap: '6px' }}>
                {PERIODS.map((period) => (
                  <button
                    key={period.days}
                    type="button"
                    onClick={() => setDays(period.days)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: theme.radius.sm,
                      border: `1px solid ${days === period.days ? theme.colors.primary : theme.colors.border}`,
                      backgroundColor: days === period.days ? theme.colors.primary : theme.colors.surface,
                      color: days === period.days ? theme.colors.primaryText : theme.colors.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            }
          >
            <StatBody state={daily} height={300}>
              {() => (dailyOption ? <EChart option={dailyOption} height={300} /> : null)}
            </StatBody>
          </ChartCard>

          <ChartCard title="파일 포맷 분포">
            <StatBody state={types} height={CHART_H}>
              {(data) => <EChart option={horizontalBarOption(theme, data.formats, theme.colors.primary)} height={CHART_H} />}
            </StatBody>
          </ChartCard>
          <ChartCard title="파일 카테고리 분포">
            <StatBody state={types} height={CHART_H}>
              {(data) => <EChart option={horizontalBarOption(theme, data.categories, '#0ea5e9')} height={CHART_H} />}
            </StatBody>
          </ChartCard>
          <ChartCard title="로케일 분포 (TOP 10)">
            <StatBody state={locales} height={CHART_H}>
              {() => (localesOption ? <EChart option={localesOption} height={CHART_H} /> : null)}
            </StatBody>
          </ChartCard>
          <ChartCard title="진단율 분포">
            <StatBody state={ratio} height={CHART_H}>
              {() => (ratioOption ? <EChart option={ratioOption} height={CHART_H} /> : null)}
            </StatBody>
          </ChartCard>
          <ChartCard
            title="벤더별 TOP 진단명"
            style={{ gridColumn: 'span 2' }}
            controls={
              <SearchSelect
                value={vendorId ?? ''}
                onChange={(event) => setVendorId(Number(event.target.value))}
                disabled={!filters.data?.vendors.length}
                style={{ minWidth: '180px' }}
              >
                {(filters.data?.vendors ?? []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </SearchSelect>
            }
          >
            <StatBody state={top} height={360}>
              {(data) => <EChart option={horizontalBarOption(theme, data.items, theme.colors.danger, 220)} height={360} />}
            </StatBody>
          </ChartCard>
        </div>
      </div>
    </AppLayout>
  );
}
