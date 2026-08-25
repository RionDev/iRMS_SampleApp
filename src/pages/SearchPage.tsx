import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@common/components/AppLayout';
import { TABLE_ROW_H, TABLE_THEAD_H } from '@common/components/BaseTable';
import { Button } from '@common/components/Button';
import { Drawer } from '@common/components/Drawer';
import { Pagination } from '@common/components/Pagination';
import { TableBlock } from '@common/components/TableBlock';
import { TableEmptyState } from '@common/components/TableEmptyState';
import { useAppAccess } from '@common/hooks/useAuth';
import { LAYOUT, useFixedPageSize } from '@common/hooks/useFixedPageSize';
import { usePagedNav } from '@common/hooks/usePagedNav';
import { useThemeStore } from '@common/stores/themeStore';
import { CopyButton } from '../components/CopyButton';
import { SampleDetailPanel } from '../components/SampleDetailPanel';
import {
  SAMPLE_SEARCHBAR_EXPANDED_H,
  SAMPLE_SEARCHBAR_H,
  SampleSearchBar,
} from '../components/SampleSearchBar';
import { SampleTable, sampleKey } from '../components/SampleTable';
import {
  batchDownload,
  extractErrorDetail,
  getFilterMeta,
  getSamples,
  multiSearch,
} from '../services/sampleService';
import type {
  FilterMeta,
  MultiSearchResult,
  SampleSearchQuery,
  SampleSummary,
  SearchRequest,
} from '../types/sample';
import { BATCH_DOWNLOAD_MAX, BATCH_ZIP_PASSWORD } from '../types/sample';
import { saveBlob } from '../utils/format';

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

/** 멀티 검색 요약 툴바(40) + 아래 여백(8) + 전체 선택 행(26) */
const MULTI_TOOLBAR_H = 74;

export function SearchPage() {
  useAppAccess('/sample');
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [req, setReq] = useState<SearchRequest>({ mode: 'single', query: {} });
  // 상세는 페이지 이동 대신 오버레이 드로어 — 검색 결과/페이지 상태가 유지된다 (admin 패턴)
  const [detailHash, setDetailHash] = useState<string | null>(null);
  // 필터 패널 확장 시 검색바 블럭이 커지므로 테이블 overhead 를 보정한다
  const [barExpanded, setBarExpanded] = useState(false);
  const overhead = OVERHEAD + (barExpanded ? SAMPLE_SEARCHBAR_EXPANDED_H - SAMPLE_SEARCHBAR_H : 0);

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

  return (
    <AppLayout
      title="샘플 검색"
      appName="샘플"
      hideSidebar
      version={__APP_VERSION__}
      contentMaxWidth="1700px"
    >
      <SampleSearchBar meta={meta} onSearch={setReq} onExpandChange={setBarExpanded} />
      {req.mode === 'single' ? (
        <SingleResults
          query={req.query}
          overhead={overhead}
          onSelect={(s) => setDetailHash(sampleKey(s))}
        />
      ) : (
        <MultiResults
          hashes={req.hashes}
          overhead={overhead}
          onSelect={(s) => setDetailHash(sampleKey(s))}
        />
      )}
      <Drawer isOpen={detailHash !== null} onClose={() => setDetailHash(null)} width="880px">
        {detailHash && (
          <SampleDetailPanel hash={detailHash} onClose={() => setDetailHash(null)} />
        )}
      </Drawer>
    </AppLayout>
  );
}

/** 단일 검색 (해시 1개/진단명 + 상세 필터) — cursor 페이지네이션 */
function SingleResults({
  query,
  overhead,
  onSelect,
}: {
  query: SampleSearchQuery;
  overhead: number;
  onSelect: (sample: SampleSummary) => void;
}) {
  const filterKey = JSON.stringify(query);

  const pageSize = useFixedPageSize({ overhead, rowHeight: TABLE_ROW_H });

  const fetcher = useCallback(
    (cursor: string | undefined, snapshotIdx: number | undefined, size: number) =>
      getSamples(query, cursor, snapshotIdx, size),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  );

  const nav = usePagedNav<SampleSummary>({
    fetcher,
    size: pageSize,
    deps: [filterKey],
  });

  return (
    <TableBlock>
      <SampleTable items={nav.items} onSelect={onSelect} />
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
  );
}

/**
 * 멀티 해시 검색 결과 — 같은 화면에서 matched 테이블 + 배치 다운로드,
 * unmatched 는 요약 툴바에서 펼쳐 확인 (결과 ≤ 500 이라 클라이언트 페이지네이션)
 */
function MultiResults({
  hashes,
  overhead,
  onSelect,
}: {
  hashes: string[];
  overhead: number;
  onSelect: (sample: SampleSummary) => void;
}) {
  const { theme, isDarkMode } = useThemeStore();

  const [result, setResult] = useState<MultiSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

  const hashesKey = hashes.join(',');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setPage(1);
    setNotice(null);
    setShowUnmatched(false);
    multiSearch(hashes)
      .then((r) => {
        if (active) setResult(r);
      })
      .catch(() => {
        if (active) setError('멀티 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashesKey]);

  const pageSize = useFixedPageSize({
    overhead: overhead + MULTI_TOOLBAR_H,
    rowHeight: TABLE_ROW_H,
  });

  const matched = result?.matched ?? [];
  const unmatched = result?.unmatched ?? [];

  const totalPages = Math.max(1, Math.ceil(matched.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => matched.slice((safePage - 1) * pageSize, safePage * pageSize),
    [matched, safePage, pageSize],
  );

  const toggle = (sample: SampleSummary) => {
    const key = sampleKey(sample);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= BATCH_DOWNLOAD_MAX) {
          setNotice(`배치 다운로드는 최대 ${BATCH_DOWNLOAD_MAX}개까지 선택할 수 있습니다.`);
          return prev;
        }
        next.add(key);
      }
      return next;
    });
  };

  const allSelected =
    matched.length > 0 &&
    matched.slice(0, BATCH_DOWNLOAD_MAX).every((s) => selected.has(sampleKey(s)));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    if (matched.length > BATCH_DOWNLOAD_MAX) {
      setNotice(`배치 다운로드 한도(${BATCH_DOWNLOAD_MAX}개)까지만 선택했습니다.`);
    }
    setSelected(new Set(matched.slice(0, BATCH_DOWNLOAD_MAX).map(sampleKey)));
  };

  const handleBatchDownload = async () => {
    if (selected.size === 0 || downloading) return;
    setDownloading(true);
    setNotice(null);
    try {
      const blob = await batchDownload(Array.from(selected));
      saveBlob(blob, 'samples.zip');
    } catch (err) {
      const detail = await extractErrorDetail(err);
      setNotice(detail ?? '배치 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const countStyle = (color: string) => ({ color, fontWeight: 700 as const });

  return (
    <TableBlock>
      {/* 요약 툴바 — 일치/불일치 + 배치 다운로드 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          height: '40px',
          marginBottom: '8px',
          flexShrink: 0,
          fontSize: theme.fontSize.base,
          color: theme.colors.text,
        }}
      >
        <span style={{ fontWeight: 700 }}>
          일치 <span style={countStyle(theme.colors.success)}>{matched.length.toLocaleString()}</span>
          {' · '}불일치{' '}
          <span style={countStyle(unmatched.length > 0 ? theme.colors.danger : theme.colors.textMuted)}>
            {unmatched.length.toLocaleString()}
          </span>
        </span>
        {unmatched.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setShowUnmatched((v) => !v)}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: theme.fontSize.sm,
                color: theme.colors.primary,
                textDecoration: 'underline',
              }}
            >
              {showUnmatched ? '불일치 해시 접기' : '불일치 해시 보기'}
            </button>
            <CopyButton text={unmatched.join('\n')} title="불일치 해시 전체 복사" />
          </span>
        )}
        <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
          선택 {selected.size}/{BATCH_DOWNLOAD_MAX}
        </span>
        {notice && (
          <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.danger }}>{notice}</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.warning, fontWeight: 600 }}>
            다운로드 ZIP 비밀번호: {BATCH_ZIP_PASSWORD}
          </span>
          <Button onClick={handleBatchDownload} disabled={selected.size === 0 || downloading}>
            {downloading ? '다운로드 중...' : '선택 샘플 다운로드 (ZIP)'}
          </Button>
        </div>
      </div>

      {/* 불일치 해시 목록 (펼침 시 — 페이지가 세로 스크롤될 수 있음) */}
      {showUnmatched && unmatched.length > 0 && (
        <div
          style={{
            maxHeight: '160px',
            overflowY: 'auto',
            marginBottom: '8px',
            padding: '10px 12px',
            borderRadius: theme.radius.sm,
            backgroundColor: isDarkMode ? theme.colors.pageBackground : theme.colors.surfaceMuted,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: theme.fontSize.sm,
            color: theme.colors.textMuted,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            flexShrink: 0,
          }}
        >
          {unmatched.join('\n')}
        </div>
      )}

      <SampleTable
        items={pageItems}
        onSelect={onSelect}
        selection={{ selected, onToggle: toggle, onToggleAll: toggleAll, allSelected }}
      />
      {loading && <TableEmptyState>멀티 검색 중...</TableEmptyState>}
      {!loading && error && <TableEmptyState>{error}</TableEmptyState>}
      {!loading && !error && matched.length === 0 && (
        <TableEmptyState>일치하는 샘플이 없습니다.</TableEmptyState>
      )}
      <div style={{ marginTop: 'auto' }}>
        <Pagination
          page={safePage}
          totalPages={totalPages}
          total={matched.length}
          hasPrev={safePage > 1}
          hasNext={safePage < totalPages}
          onPrev={() => setPage(safePage - 1)}
          onNext={() => setPage(safePage + 1)}
          loading={loading}
        />
      </div>
    </TableBlock>
  );
}
