import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@common/components/AppLayout';
import { TABLE_ROW_H, TABLE_THEAD_H } from '@common/components/BaseTable';
import { Drawer } from '@common/components/Drawer';
import { Pagination } from '@common/components/Pagination';
import { TableBlock } from '@common/components/TableBlock';
import { TableEmptyState } from '@common/components/TableEmptyState';
import { useAppAccess } from '@common/hooks/useAuth';
import { LAYOUT, useFixedPageSize } from '@common/hooks/useFixedPageSize';
import { usePagedNav } from '@common/hooks/usePagedNav';
import { useThemeStore } from '@common/stores/themeStore';
import { CopyButton } from '../components/CopyButton';
import { EXPORT_ALL_MAX, ExportActions } from '../components/ExportActions';
import { SampleDetailPanel } from '../components/SampleDetailPanel';
import {
  SAMPLE_SEARCHBAR_EXPANDED_H,
  SAMPLE_SEARCHBAR_H,
  SampleSearchBar,
} from '../components/SampleSearchBar';
import { SampleTable, sampleKey, type SampleSelection } from '../components/SampleTable';
import { getFilterMeta, getSamples, multiSearch } from '../services/sampleService';
import type {
  FilterMeta,
  MultiSearchResult,
  SampleSearchQuery,
  SampleSummary,
  SearchRequest,
} from '../types/sample';
import { modifierToken } from '../utils/searchQuery';

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

/** 선택/요약 툴바(40) + 아래 여백(8) + 전체 선택 행(26) — 단일/멀티 공통 */
const TOOLBAR_H = 74;

export function SearchPage() {
  useAppAccess('/sample');
  const [meta, setMeta] = useState<FilterMeta | null>(null);
  const [req, setReq] = useState<SearchRequest>({ mode: 'single', query: {} });
  // 상세는 페이지 이동 대신 오버레이 드로어 — 검색 결과/페이지 상태가 유지된다 (admin 패턴)
  const [detailHash, setDetailHash] = useState<string | null>(null);
  // 필터 패널 확장 시 검색바 블럭이 커지므로 테이블 overhead 를 보정한다
  const [barExpanded, setBarExpanded] = useState(false);
  // 태그 뱃지 클릭 → 검색바에 tag:값 주입 후 즉시 검색
  const [inject, setInject] = useState<{ text: string; seq: number } | null>(null);
  const handleTagClick = useCallback((tag: string) => {
    setInject((prev) => ({ text: modifierToken('tag', tag), seq: (prev?.seq ?? 0) + 1 }));
  }, []);
  const overhead =
    OVERHEAD +
    TOOLBAR_H +
    (barExpanded ? SAMPLE_SEARCHBAR_EXPANDED_H - SAMPLE_SEARCHBAR_H : 0);

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

  // 검색바가 비어 있는 초기 전체 목록인지 — 검색어/필터가 하나라도 있어야 내보내기 허용
  const searched =
    req.mode === 'multi' ||
    Object.values(req.query).some(
      (v) => v !== undefined && (!Array.isArray(v) || v.length > 0),
    );

  // 로케일 국명 → 알파-2 코드 (테이블 국기 표시용)
  const localeCodes = useMemo(
    () =>
      new Map(
        (meta?.locales ?? [])
          .filter((o) => o.label)
          .map((o) => [o.name, o.label as string]),
      ),
    [meta],
  );

  return (
    <AppLayout
      title="샘플 검색"
      appName="샘플"
      hideSidebar
      version={__APP_VERSION__}
      contentMaxWidth="1700px"
    >
      <SampleSearchBar
        meta={meta}
        onSearch={setReq}
        onExpandChange={setBarExpanded}
        inject={inject}
      />
      {req.mode === 'single' ? (
        <SingleResults
          query={req.query}
          searched={searched}
          overhead={overhead}
          localeCodes={localeCodes}
          onSelect={(s) => setDetailHash(sampleKey(s))}
          onTagClick={handleTagClick}
        />
      ) : (
        <MultiResults
          hashes={req.hashes}
          overhead={overhead}
          localeCodes={localeCodes}
          onSelect={(s) => setDetailHash(sampleKey(s))}
          onTagClick={handleTagClick}
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

/**
 * 체크박스 선택 상태 — 해시 키로 요약을 보관해 페이지를 넘겨도 선택이 유지된다.
 * (CSV/ZIP 내보내기가 선택 항목의 데이터를 그대로 쓴다)
 */
function useSampleSelection() {
  const [map, setMap] = useState<Map<string, SampleSummary>>(new Map());

  const toggle = useCallback((sample: SampleSummary) => {
    setMap((prev) => {
      const next = new Map(prev);
      const key = sampleKey(sample);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, sample);
      }
      return next;
    });
  }, []);

  /** items 가 모두 선택돼 있으면 해제, 아니면 모두 추가 */
  const toggleAllOf = useCallback((items: SampleSummary[]) => {
    setMap((prev) => {
      const next = new Map(prev);
      const allIn = items.length > 0 && items.every((s) => next.has(sampleKey(s)));
      items.forEach((s) => {
        if (allIn) {
          next.delete(sampleKey(s));
        } else {
          next.set(sampleKey(s), s);
        }
      });
      return next;
    });
  }, []);

  const clear = useCallback(() => setMap(new Map()), []);

  const selected = useMemo(() => new Set(map.keys()), [map]);
  const items = useMemo(() => Array.from(map.values()), [map]);
  return { selected, items, toggle, toggleAllOf, clear };
}

/** 단일 검색 (해시 1개/진단명 + 필터) — cursor 페이지네이션, 선택은 페이지를 넘어 유지 */
function SingleResults({
  query,
  searched,
  overhead,
  localeCodes,
  onSelect,
  onTagClick,
}: {
  query: SampleSearchQuery;
  searched: boolean;
  overhead: number;
  localeCodes: Map<string, string>;
  onSelect: (sample: SampleSummary) => void;
  onTagClick: (tag: string) => void;
}) {
  const { theme } = useThemeStore();
  const filterKey = JSON.stringify(query);
  const sel = useSampleSelection();

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

  // 검색 조건이 바뀌면 이전 선택은 의미가 없다
  useEffect(() => {
    sel.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // "검색 전체" 내보내기 — cursor 페이지 반복 조회 (EXPORT_ALL_MAX 상한)
  const fetchAllResults = useCallback(async () => {
    const acc: SampleSummary[] = [];
    let cursor: string | undefined;
    let snapshot: number | undefined;
    for (;;) {
      const page = await getSamples(query, cursor, snapshot, 100);
      acc.push(...page.items);
      snapshot = page.snapshot_idx;
      if (!page.has_more || !page.next_cursor || acc.length >= EXPORT_ALL_MAX) break;
      cursor = page.next_cursor;
    }
    return acc.slice(0, EXPORT_ALL_MAX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const selection: SampleSelection = {
    selected: sel.selected,
    onToggle: sel.toggle,
    onToggleAll: () => sel.toggleAllOf(nav.items),
    allSelected:
      nav.items.length > 0 && nav.items.every((s) => sel.selected.has(sampleKey(s))),
  };

  return (
    <TableBlock>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '40px',
          marginBottom: '8px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: theme.fontSize.base,
            fontWeight: 700,
            color: theme.colors.text,
            whiteSpace: 'nowrap',
          }}
        >
          검색 결과{' '}
          <span style={{ color: theme.colors.primary }}>{nav.total.toLocaleString()}</span> 건
        </span>
        <ExportActions
          selected={sel.items}
          listItems={nav.items}
          listLabel="현재 페이지"
          all={searched ? { total: nav.total, fetchAll: fetchAllResults } : undefined}
        />
      </div>
      <SampleTable
        items={nav.items}
        onSelect={onSelect}
        localeCodes={localeCodes}
        selection={selection}
        onTagClick={onTagClick}
      />
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
 * 멀티 해시 검색 결과 — 같은 화면에서 matched 테이블 + 선택 액션,
 * unmatched 는 요약 툴바에서 펼쳐 확인 (결과 ≤ 500 이라 클라이언트 페이지네이션)
 */
function MultiResults({
  hashes,
  overhead,
  localeCodes,
  onSelect,
  onTagClick,
}: {
  hashes: string[];
  overhead: number;
  localeCodes: Map<string, string>;
  onSelect: (sample: SampleSummary) => void;
  onTagClick: (tag: string) => void;
}) {
  const { theme, isDarkMode } = useThemeStore();

  const [result, setResult] = useState<MultiSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const sel = useSampleSelection();

  const hashesKey = hashes.join(',');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setPage(1);
    setShowUnmatched(false);
    sel.clear();
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

  const pageSize = useFixedPageSize({ overhead, rowHeight: TABLE_ROW_H });

  const matched = result?.matched ?? [];
  const unmatched = result?.unmatched ?? [];

  const totalPages = Math.max(1, Math.ceil(matched.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => matched.slice((safePage - 1) * pageSize, safePage * pageSize),
    [matched, safePage, pageSize],
  );

  const selection: SampleSelection = {
    selected: sel.selected,
    onToggle: sel.toggle,
    // 멀티 검색은 matched 전체가 메모리에 있으므로 전체 선택은 전 페이지 대상
    onToggleAll: () => sel.toggleAllOf(matched),
    allSelected:
      matched.length > 0 && matched.every((s) => sel.selected.has(sampleKey(s))),
  };

  const countStyle = (color: string) => ({ color, fontWeight: 700 as const });

  return (
    <TableBlock>
      {/* 요약 + 선택 액션 툴바 */}
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
        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
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
                whiteSpace: 'nowrap',
              }}
            >
              {showUnmatched ? '불일치 해시 접기' : '불일치 해시 보기'}
            </button>
            <CopyButton text={unmatched.join('\n')} title="불일치 해시 전체 복사" />
          </span>
        )}
        <ExportActions selected={sel.items} listItems={matched} listLabel="일치 전체" />
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
        localeCodes={localeCodes}
        selection={selection}
        onTagClick={onTagClick}
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
