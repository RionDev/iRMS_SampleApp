import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@common/components/Button';
import { Modal } from '@common/components/Modal';
import { SearchInput } from '@common/components/SearchInput';
import { useThemeStore } from '@common/stores/themeStore';
import { batchDownload, extractErrorDetail } from '../services/sampleService';
import type { SampleSummary } from '../types/sample';
import { BATCH_DOWNLOAD_MAX, BATCH_ZIP_PASSWORD } from '../types/sample';
import { CSV_COLUMNS, samplesToCsv } from '../utils/csv';
import { saveBlob } from '../utils/format';
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

function ScopeRadios({
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
  const radio = (value: Scope, label: string, disabled: boolean, title?: string): ReactNode => (
    <label
      key={value}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: theme.fontSize.base,
        color: disabled ? theme.colors.textMuted : theme.colors.text,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <input
        type="radio"
        checked={scope === value}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      {label}
    </label>
  );

  const allOverMax = (all?.total ?? 0) > EXPORT_ALL_MAX;
  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
      {radio('selected', `선택 항목 (${selectedCount.toLocaleString()})`, selectedCount === 0)}
      {radio('list', `${listLabel} (${listCount.toLocaleString()})`, listCount === 0)}
      {all &&
        radio(
          'all',
          `검색 전체 (${all.total.toLocaleString()})`,
          all.total === 0 || allOverMax,
          allOverMax
            ? `검색 전체 내보내기는 최대 ${EXPORT_ALL_MAX.toLocaleString()}건까지 가능합니다 — 검색을 좁혀 주세요`
            : undefined,
        )}
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

  const checkboxLabel: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    cursor: 'pointer',
  };

  return (
    <Modal isOpen onClose={onClose} title="CSV 내보내기">
      <FieldLabel>대상 범위</FieldLabel>
      <ScopeRadios
        scope={scope}
        onChange={setScope}
        selectedCount={selected.length}
        listCount={listItems.length}
        listLabel={listLabel}
        all={all}
      />

      <FieldLabel>
        컬럼 ({keys.size}/{CSV_COLUMNS.length}){' '}
        <button
          type="button"
          onClick={() =>
            setKeys(allChecked ? new Set() : new Set(CSV_COLUMNS.map((c) => c.key)))
          }
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            marginLeft: '6px',
            cursor: 'pointer',
            fontSize: theme.fontSize.sm,
            color: theme.colors.primary,
            textDecoration: 'underline',
          }}
        >
          {allChecked ? '전체 해제' : '전체 선택'}
        </button>
      </FieldLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px 12px',
        }}
      >
        {CSV_COLUMNS.map((c) => (
          <label key={c.key} style={checkboxLabel}>
            <input type="checkbox" checked={keys.has(c.key)} onChange={() => toggleKey(c.key)} />
            {c.label}
          </label>
        ))}
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleExport} disabled={!canExport || busy}>
          {busy ? '내보내는 중...' : `내보내기 (${targetCount.toLocaleString()}건)`}
        </Button>
      </div>
    </Modal>
  );
}

function ZipModal({ selected, listItems, listLabel, all, defaultScope, onClose }: ExportModalProps) {
  const { theme } = useThemeStore();
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [filename, setFilename] = useState('samples');
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 실제 파일이 보관(Stored)된 샘플만 다운로드 대상 — 아니면 파일 없는 ZIP 만 내려온다
  const knownTarget = scope === 'selected' ? selected : scope === 'list' ? listItems : null;
  const knownStored = useMemo(
    () => (knownTarget ? knownTarget.filter(isStored) : null),
    [knownTarget],
  );
  const overMax = knownStored !== null && knownStored.length > BATCH_DOWNLOAD_MAX;
  const canDownload =
    scope === 'all'
      ? (all?.total ?? 0) > 0
      : knownStored !== null && knownStored.length > 0 && !overMax;

  const handleDownload = async () => {
    if (!canDownload || downloading) return;
    setDownloading(true);
    setNotice(null);
    try {
      const stored =
        knownStored ?? (await all!.fetchAll()).filter(isStored);
      if (stored.length === 0) {
        setNotice('파일이 보관(Stored)된 샘플이 없어 다운로드할 항목이 없습니다.');
        setDownloading(false);
        return;
      }
      if (stored.length > BATCH_DOWNLOAD_MAX) {
        setNotice(
          `파일 보관 샘플이 ${stored.length.toLocaleString()}개로 한도(${BATCH_DOWNLOAD_MAX}개)를 초과합니다 — 범위를 좁혀 주세요.`,
        );
        setDownloading(false);
        return;
      }
      const blob = await batchDownload(stored.map(sampleKey));
      saveBlob(blob, `${filename.trim() || 'samples'}.zip`);
      onClose();
    } catch (err) {
      const detail = await extractErrorDetail(err);
      setNotice(detail ?? '배치 다운로드에 실패했습니다.');
      setDownloading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="샘플 파일 다운로드">
      <FieldLabel>대상 범위</FieldLabel>
      <ScopeRadios
        scope={scope}
        onChange={setScope}
        selectedCount={selected.length}
        listCount={listItems.length}
        listLabel={listLabel}
        all={all}
      />

      <div
        style={{
          marginTop: '14px',
          padding: '10px 12px',
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surfaceMuted,
          fontSize: theme.fontSize.sm,
          color: theme.colors.text,
          lineHeight: 1.7,
        }}
      >
        {knownStored !== null ? (
          <>
            대상 {(knownTarget?.length ?? 0).toLocaleString()}건 중 파일 보관(Stored){' '}
            <b>{knownStored.length.toLocaleString()}건</b>이 다운로드됩니다.
            {overMax && (
              <div style={{ color: theme.colors.danger }}>
                파일 다운로드는 한 번에 최대 {BATCH_DOWNLOAD_MAX}개까지 가능합니다 — 범위를
                좁혀 주세요.
              </div>
            )}
            {knownStored.length === 0 && (
              <div style={{ color: theme.colors.danger }}>
                파일이 보관된 샘플이 없어 다운로드할 수 없습니다.
              </div>
            )}
          </>
        ) : (
          <>
            실행 시 검색 전체 {(all?.total ?? 0).toLocaleString()}건을 조회해 파일 보관(Stored)
            샘플만 담습니다 (최대 {BATCH_DOWNLOAD_MAX}개 — 초과 시 중단).
          </>
        )}
        <div style={{ color: theme.colors.warning }}>
          AES 암호화 ZIP — 비밀번호: <b>{BATCH_ZIP_PASSWORD}</b>
        </div>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
        <Button variant="secondary" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleDownload} disabled={!canDownload || downloading}>
          {downloading
            ? '다운로드 중...'
            : knownStored !== null
              ? `다운로드 (${knownStored.length.toLocaleString()}건)`
              : '다운로드'}
        </Button>
      </div>
    </Modal>
  );
}
