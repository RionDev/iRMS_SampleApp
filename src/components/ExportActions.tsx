import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@common/components/Button';
import { Modal } from '@common/components/Modal';
import { SearchInput } from '@common/components/SearchInput';
import { useThemeStore } from '@common/stores/themeStore';
import { batchDownload, extractErrorDetail } from '../services/sampleService';
import type { SampleSummary } from '../types/sample';
import {
  BATCH_DOWNLOAD_MAX,
  BATCH_DOWNLOAD_MAX_BYTES,
  BATCH_ZIP_PASSWORD,
} from '../types/sample';
import { CSV_COLUMNS, samplesToCsv } from '../utils/csv';
import { formatSize, saveBlob } from '../utils/format';
import { sampleKey } from './SampleTable';

/** "검색 전체" 내보내기 상한 (100건 페이지 반복 조회) */
export const EXPORT_ALL_MAX = 5000;

/**
 * 선택 항목 액션 — CSV 내보내기 / 배치 파일(ZIP) 다운로드.
 * 버튼을 누르면 모달에서 범위·컬럼·파일명 등 상세 설정 후 실행한다.
 * 범위: 선택 항목 / 현재 목록, 검색을 수행한 경우(all 제공 시) 검색 전체까지.
 */
interface ExportAllSource {
  /** 검색 전체 건수 */
  total: number;
  /** 전체 결과 페이지 반복 조회 (EXPORT_ALL_MAX 상한) */
  fetchAll: () => Promise<SampleSummary[]>;
}

interface ExportActionsProps {
  /** 체크박스로 선택된 항목 (페이지 넘어 유지) */
  selected: SampleSummary[];
  /** 현재 목록 — 단일: 현재 페이지, 멀티: 일치 전체 */
  listItems: SampleSummary[];
  /** 현재 목록 라벨 (예: "현재 페이지", "일치 전체") */
  listLabel: string;
  /** 검색을 수행한 상태에서만 제공 — "검색 전체" 범위 활성화 */
  all?: ExportAllSource;
}

type Scope = 'selected' | 'list' | 'all';

function isStored(s: SampleSummary): boolean {
  return s.storage_status === 'Stored';
}

/** ESC 로 모달 닫기 (공통 Modal 은 배경 클릭만 지원) */
function useEscClose(onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
}

function FieldLabel({ children }: { children: ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <div
      style={{
        fontSize: theme.fontSize.sm,
        fontWeight: 700,
        color: theme.colors.textMuted,
        margin: '14px 0 6px',
      }}
    >
      {children}
    </div>
  );
}

/** 범위 선택 — 세그먼티드 컨트롤 (개수는 아래 줄에 크게) */
function ScopeSegments({
  scope,
  onChange,
  selectedCount,
  listCount,
  listLabel,
  all,
}: {
  scope: Scope;
  onChange: (scope: Scope) => void;
  selectedCount: number;
  listCount: number;
  listLabel: string;
  all?: ExportAllSource;
}) {
  const { theme } = useThemeStore();
  const allOverMax = (all?.total ?? 0) > EXPORT_ALL_MAX;

  const segments: { value: Scope; label: string; count: number; disabled: boolean; title?: string }[] = [
    // 선택이 없으면 선택 항목 칸 자체를 숨긴다
    ...(selectedCount > 0
      ? [{ value: 'selected' as Scope, label: '선택 항목', count: selectedCount, disabled: false }]
      : []),
    { value: 'list', label: listLabel, count: listCount, disabled: listCount === 0 },
    ...(all
      ? [
          {
            value: 'all' as Scope,
            label: '검색 전체',
            count: all.total,
            disabled: all.total === 0 || allOverMax,
            title: allOverMax
              ? `검색 전체는 최대 ${EXPORT_ALL_MAX.toLocaleString()}건까지 가능합니다 — 검색을 좁혀 주세요`
              : undefined,
          },
        ]
      : []),
  ];

  return (
    <div
      style={{
        display: 'flex',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      }}
    >
      {segments.map((seg, i) => {
        const active = scope === seg.value;
        return (
          <button
            key={seg.value}
            type="button"
            disabled={seg.disabled}
            title={seg.title}
            onClick={() => onChange(seg.value)}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              borderLeft: i > 0 ? `1px solid ${theme.colors.border}` : 'none',
              backgroundColor: active ? `${theme.colors.primary}1a` : 'transparent',
              cursor: seg.disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              fontFamily: theme.fontFamily,
            }}
          >
            <span
              style={{
                fontSize: theme.fontSize.sm,
                fontWeight: active ? 700 : 500,
                color: seg.disabled
                  ? theme.colors.textMuted
                  : active
                    ? theme.colors.primary
                    : theme.colors.text,
              }}
            >
              {seg.label}
            </span>
            <span
              style={{
                fontSize: theme.fontSize.lg,
                fontWeight: 700,
                color: seg.disabled
                  ? theme.colors.textMuted
                  : active
                    ? theme.colors.primary
                    : theme.colors.textMuted,
              }}
            >
              {seg.count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 모달 하단 버튼 행 (구분선 포함) */
function ModalFooter({ children }: { children: ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '20px',
        paddingTop: '14px',
        borderTop: `1px solid ${theme.colors.border}`,
      }}
    >
      {children}
    </div>
  );
}

export function ExportActions({ selected, listItems, listLabel, all }: ExportActionsProps) {
  const { theme } = useThemeStore();
  const [csvOpen, setCsvOpen] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);

  const hasAny = selected.length > 0 || listItems.length > 0 || (all?.total ?? 0) > 0;
  const hasSelection = selected.length > 0;
  const selectedStored = useMemo(() => selected.filter(isStored), [selected]);

  const defaultScope: Scope = hasSelection ? 'selected' : listItems.length > 0 ? 'list' : 'all';

  const modalProps = { selected, listItems, listLabel, all, defaultScope };

  return (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <Button
        variant="secondary"
        onClick={() => setCsvOpen(true)}
        disabled={!hasAny}
        title={hasAny ? undefined : '내보낼 결과가 없습니다'}
      >
        CSV 내보내기
      </Button>
      <Button
        onClick={() => setZipOpen(true)}
        disabled={!hasAny}
        title={hasAny ? '샘플 파일(AES ZIP) 다운로드 설정' : '내보낼 결과가 없습니다'}
      >
        파일 다운로드
      </Button>
      <span
        title={
          hasSelection
            ? `선택 ${selected.length}개 중 파일 보관 ${selectedStored.length}개`
            : undefined
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '999px',
          fontSize: theme.fontSize.base,
          fontWeight: 700,
          color: hasSelection ? theme.colors.primary : theme.colors.textMuted,
          backgroundColor: hasSelection ? `${theme.colors.primary}1a` : 'transparent',
          border: `1px solid ${hasSelection ? theme.colors.primary : theme.colors.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        선택 {selected.length.toLocaleString()}
        {hasSelection && (
          <span style={{ fontWeight: 400, fontSize: theme.fontSize.sm }}>
            · 파일 {selectedStored.length.toLocaleString()}
          </span>
        )}
      </span>

      {csvOpen && <CsvModal {...modalProps} onClose={() => setCsvOpen(false)} />}
      {zipOpen && <ZipModal {...modalProps} onClose={() => setZipOpen(false)} />}
    </div>
  );
}

interface ExportModalProps {
  selected: SampleSummary[];
  listItems: SampleSummary[];
  listLabel: string;
  all?: ExportAllSource;
  defaultScope: Scope;
  onClose: () => void;
}

function CsvModal({ selected, listItems, listLabel, all, defaultScope, onClose }: ExportModalProps) {
  const { theme } = useThemeStore();
  useEscClose(onClose);
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [keys, setKeys] = useState<Set<string>>(new Set(CSV_COLUMNS.map((c) => c.key)));
  const [filename, setFilename] = useState('samples');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const targetCount =
    scope === 'selected' ? selected.length : scope === 'list' ? listItems.length : (all?.total ?? 0);
  const allChecked = keys.size === CSV_COLUMNS.length;
  const canExport =
    keys.size > 0 &&
    targetCount > 0 &&
    (scope !== 'all' || (all !== undefined && all.total <= EXPORT_ALL_MAX));

  const toggleKey = (key: string) => {
    setKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExport = async () => {
    if (!canExport || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const items =
        scope === 'selected' ? selected : scope === 'list' ? listItems : await all!.fetchAll();
      const name = `${filename.trim() || 'samples'}.csv`;
      saveBlob(
        new Blob([samplesToCsv(items, Array.from(keys))], { type: 'text/csv;charset=utf-8' }),
        name,
      );
      onClose();
    } catch {
      setNotice('검색 전체 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  const chipStyle = (active: boolean): CSSProperties => ({
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: theme.fontSize.sm,
    fontWeight: active ? 600 : 400,
    lineHeight: '18px',
    cursor: 'pointer',
    border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
    backgroundColor: active ? `${theme.colors.primary}1a` : 'transparent',
    color: active ? theme.colors.primary : theme.colors.textMuted,
    fontFamily: theme.fontFamily,
  });

  return (
    <Modal isOpen onClose={onClose} title="CSV 내보내기">
      <FieldLabel>대상 범위</FieldLabel>
      <ScopeSegments
        scope={scope}
        onChange={setScope}
        selectedCount={selected.length}
        listCount={listItems.length}
        listLabel={listLabel}
        all={all}
      />

      <FieldLabel>
        컬럼{' '}
        <span style={{ color: theme.colors.primary }}>
          {keys.size}
        </span>
        /{CSV_COLUMNS.length}
        <button
          type="button"
          onClick={() =>
            setKeys(allChecked ? new Set() : new Set(CSV_COLUMNS.map((c) => c.key)))
          }
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            marginLeft: '8px',
            cursor: 'pointer',
            fontSize: theme.fontSize.sm,
            color: theme.colors.primary,
            textDecoration: 'underline',
          }}
        >
          {allChecked ? '전체 해제' : '전체 선택'}
        </button>
      </FieldLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {CSV_COLUMNS.map((c) => {
          const active = keys.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleKey(c.key)}
              aria-pressed={active}
              style={chipStyle(active)}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <FieldLabel>파일명</FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <SearchInput
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>.csv</span>
      </div>

      {notice && (
        <div style={{ marginTop: '10px', fontSize: theme.fontSize.sm, color: theme.colors.danger }}>
          {notice}
        </div>
      )}

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleExport} disabled={!canExport || busy}>
          {busy ? '내보내는 중...' : `내보내기 (${targetCount.toLocaleString()}건)`}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function ZipModal({ selected, listItems, listLabel, all, defaultScope, onClose }: ExportModalProps) {
  const { theme } = useThemeStore();
  useEscClose(onClose);
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [filename, setFilename] = useState('samples');
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // "검색 전체" 선택 시 즉시 전체 조회 — 파일 보관 수를 다른 범위처럼 M/N 으로 보여준다
  // (deps 는 scope 만 — 상태 갱신이 cleanup 을 유발해 결과가 버려지지 않도록)
  const [allItems, setAllItems] = useState<SampleSummary[] | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  useEffect(() => {
    if (scope !== 'all' || !all || allItems !== null) return;
    let active = true;
    setAllLoading(true);
    all
      .fetchAll()
      .then((items) => {
        if (active) setAllItems(items);
      })
      .catch(() => {
        if (active) setNotice('검색 전체 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      })
      .finally(() => {
        if (active) setAllLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // 실제 파일이 보관(Stored)된 샘플만 다운로드 대상 — 아니면 파일 없는 ZIP 만 내려온다
  const target = scope === 'selected' ? selected : scope === 'list' ? listItems : allItems;
  const stored = useMemo(() => (target ? target.filter(isStored) : null), [target]);
  const storedBytes = useMemo(
    () => (stored ? stored.reduce((sum, s) => sum + s.file_size, 0) : 0),
    [stored],
  );
  const overMax = stored !== null && stored.length > BATCH_DOWNLOAD_MAX;
  const overSize = storedBytes > BATCH_DOWNLOAD_MAX_BYTES;
  // 보관 0건은 버튼을 막지 않고 클릭 시 알림창으로 알린다
  const canDownload = stored !== null && !overMax && !overSize;

  const handleDownload = async () => {
    if (!canDownload || downloading || stored === null) return;
    if (stored.length === 0) {
      window.alert('파일이 보관(Stored)된 샘플이 없어 다운로드할 항목이 없습니다.');
      return;
    }
    setDownloading(true);
    setNotice(null);
    try {
      const blob = await batchDownload(stored.map(sampleKey));
      saveBlob(blob, `${filename.trim() || 'samples'}.zip`);
      onClose();
    } catch (err) {
      const detail = await extractErrorDetail(err);
      setNotice(
        detail === 'size_limit_exceeded'
          ? `총 용량 한도(${formatSize(BATCH_DOWNLOAD_MAX_BYTES)})를 초과했습니다 — 범위를 좁혀 주세요.`
          : (detail ?? '배치 다운로드에 실패했습니다.'),
      );
      setDownloading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="샘플 파일 다운로드">
      <FieldLabel>대상 범위</FieldLabel>
      <ScopeSegments
        scope={scope}
        onChange={(s) => {
          setScope(s);
          setNotice(null);
        }}
        selectedCount={selected.length}
        listCount={listItems.length}
        listLabel={listLabel}
        all={all}
      />

      <FieldLabel>다운로드 정보</FieldLabel>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surfaceMuted,
          fontSize: theme.fontSize.sm,
          color: theme.colors.text,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex' }}>
          <span style={{ width: '96px', flexShrink: 0, color: theme.colors.textMuted }}>
            파일 보관
          </span>
          {stored !== null ? (
            <b
              style={{
                color:
                  stored.length === 0 || overMax ? theme.colors.danger : theme.colors.text,
              }}
            >
              {stored.length.toLocaleString()} / {(target?.length ?? 0).toLocaleString()}건
            </b>
          ) : (
            <span style={{ color: theme.colors.textMuted }}>
              {allLoading ? '검색 전체 조회 중...' : '-'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '96px', flexShrink: 0, color: theme.colors.textMuted }}>
            예상 용량
          </span>
          {stored !== null ? (
            <b style={{ color: overSize ? theme.colors.danger : theme.colors.text }}>
              {formatSize(storedBytes)}
            </b>
          ) : (
            <span style={{ color: theme.colors.textMuted }}>-</span>
          )}
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '96px', flexShrink: 0, color: theme.colors.textMuted }}>
            한도
          </span>
          <span>
            1회 최대 {BATCH_DOWNLOAD_MAX}개 · 총 {formatSize(BATCH_DOWNLOAD_MAX_BYTES)}
          </span>
        </div>
        <div style={{ display: 'flex' }}>
          <span style={{ width: '96px', flexShrink: 0, color: theme.colors.textMuted }}>
            ZIP 비밀번호
          </span>
          <b style={{ color: theme.colors.warning }}>{BATCH_ZIP_PASSWORD}</b>
        </div>
        {(overMax || overSize) && (
          <div style={{ color: theme.colors.danger }}>
            {overMax
              ? '보관 샘플 개수가 한도를 초과합니다 — 범위를 좁혀 주세요.'
              : '예상 용량이 한도를 초과합니다 — 범위를 좁혀 주세요.'}
          </div>
        )}
      </div>

      <FieldLabel>파일명</FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <SearchInput
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>.zip</span>
      </div>

      {notice && (
        <div style={{ marginTop: '10px', fontSize: theme.fontSize.sm, color: theme.colors.danger }}>
          {notice}
        </div>
      )}

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleDownload} disabled={!canDownload || downloading || allLoading}>
          {downloading
            ? '다운로드 중...'
            : allLoading
              ? '조회 중...'
              : stored !== null
                ? `다운로드 (${stored.length.toLocaleString()}건)`
                : '다운로드'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
