import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@common/components/AppLayout';
import { TABLE_ROW_H, TABLE_THEAD_H } from '@common/components/BaseTable';
import { Pagination } from '@common/components/Pagination';
import { TableBlock } from '@common/components/TableBlock';
import { TableEmptyState } from '@common/components/TableEmptyState';
import { useAppAccess } from '@common/hooks/useAuth';
import { LAYOUT, useFixedPageSize } from '@common/hooks/useFixedPageSize';
import { usePagedNav } from '@common/hooks/usePagedNav';
import { SAMPLE_SEARCHBAR_H, SampleSearchBar } from '../components/SampleSearchBar';
import { SampleTable, sampleKey } from '../components/SampleTable';
import { sampleNavItems } from '../navigation';
import { getFilterMeta, getSamples } from '../services/sampleService';
import type { FilterMeta, SampleSearchQuery, SampleSummary } from '../types/sample';

/** TableBlock 상하 padding 합 (16*2) */
const TABLEBLOCK_PAD_Y = 32;
const OVERHEAD =
  LAYOUT.HEADER_H +
  LAYOUT.FOOTER_H +
  LAYOUT.MAIN_PAD_Y +
  SAMPLE_SEARCHBAR_H +
  LAYOUT.SEARCHBAR_MARGIN +
  TABLEBLOCK_PAD_Y +
  TABLE_THEAD_H +
  LAYOUT.PAGINATION_H;

export function SearchPage() {
  useAppAccess('/sample');
  const navigate = useNavigate();
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [filters, setFilters] = useState<SampleSearchQuery>({});
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let active = true;
    getFilterMeta()
      .then((m) => {
        if (active) setMeta(m);
      })
      .catch(() => {
        // 필터 옵션 로드 실패 시 select 만 비활성 유지 (검색어/기간 검색은 가능)
      });
    return () => {
      active = false;
    };
  }, []);

  const pageSize = useFixedPageSize({ overhead: OVERHEAD, rowHeight: TABLE_ROW_H });

  const fetcher = useCallback(
    (cursor: string | undefined, snapshotIdx: number | undefined, size: number) =>
      getSamples(filters, cursor, snapshotIdx, size),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  );

  const nav = usePagedNav<SampleSummary>({
    fetcher,
    size: pageSize,
    deps: [filterKey],
  });

  const handleSelect = (sample: SampleSummary) => {
    navigate(`/samples/${sampleKey(sample)}`);
  };

  return (
    <AppLayout
      title="샘플 검색"
      appName="샘플"
      sidebarItems={sampleNavItems}
      version={__APP_VERSION__}
      contentMaxWidth="1700px"
    >
      <SampleSearchBar meta={meta} onSearch={setFilters} />
      <TableBlock>
        <SampleTable items={nav.items} onSelect={handleSelect} />
        {nav.loading && <TableEmptyState>로딩 중...</TableEmptyState>}
        {!nav.loading && nav.error && <TableEmptyState>{nav.error}</TableEmptyState>}
        {!nav.loading && !nav.error && nav.items.length === 0 && (
          <TableEmptyState>검색 결과가 없습니다.</TableEmptyState>
        )}
        <div style={{ marginTop: 'auto' }}>
          <Pagination
            page={nav.page}
            totalPages={nav.totalPages}
            total={nav.total}
            hasPrev={nav.hasPrev}
            hasNext={nav.hasNext}
            onPrev={nav.prev}
            onNext={nav.next}
            loading={nav.loading}
          />
        </div>
      </TableBlock>
    </AppLayout>
  );
}
