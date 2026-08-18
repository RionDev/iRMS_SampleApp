import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@common/components/Button';
import { SearchInput } from '@common/components/SearchInput';
import { SearchSelect } from '@common/components/SearchSelect';
import { useThemeStore } from '@common/stores/themeStore';
import type { FilterMeta, FilterOption, MatchMode, SampleSearchQuery } from '../types/sample';
import { detectHashType } from '../utils/hash';

/**
 * 검색바(2행: 검색어 / 상세 필터) 고정 높이 — useFixedPageSize overhead 계산용.
 * 공통 SearchBar(72px) 대신 필터 항목이 많아 2행 카드로 확장했다.
 */
export const SAMPLE_SEARCHBAR_H = 112;

interface SampleSearchBarProps {
  /** GET /meta/filters 응답 (로딩 전 null — select 는 비활성) */
  meta: FilterMeta | null;
  onSearch: (query: SampleSearchQuery) => void;
}

const EMPTY = {
  q: '',
  match: 'prefix' as MatchMode,
  pool: '',
  format: '',
  category: '',
  locale: '',
  source: '',
  tag: '',
  label: '',
  ratioMin: '',
  ratioMax: '',
  dateFrom: '',
  dateTo: '',
};

function FilterSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: FilterOption[] | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <SearchSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!options}
      style={{ minWidth: '104px', flex: 1 }}
    >
      <option value="">{placeholder}</option>
      {options?.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </SearchSelect>
  );
}

export function SampleSearchBar({ meta, onSearch }: SampleSearchBarProps) {
  const { theme } = useThemeStore();
  const [draft, setDraft] = useState(EMPTY);

  const set = (patch: Partial<typeof EMPTY>) => setDraft((d) => ({ ...d, ...patch }));

  const hashType = useMemo(() => detectHashType(draft.q), [draft.q]);
  const isDiagname = draft.q.trim() !== '' && hashType === null;

  const hint = !draft.q.trim()
    ? ''
    : hashType
      ? `해시 검색 (${hashType.toUpperCase()})`
      : draft.match === 'substring'
        ? '진단명 검색 — 느릴 수 있음'
        : '진단명 검색';

  const buildQuery = (d: typeof EMPTY): SampleSearchQuery => {
    const num = (v: string) => (v === '' ? undefined : Number(v));
    const q: SampleSearchQuery = {
      q: d.q.trim() || undefined,
      match: isDiagname && d.match !== 'prefix' ? d.match : undefined,
      pool: num(d.pool),
      format: num(d.format),
      category: num(d.category),
      locale: num(d.locale),
      source: num(d.source),
      tag: d.tag === '' ? undefined : [Number(d.tag)],
      label: d.label === '' ? undefined : [Number(d.label)],
      ratio_min: num(d.ratioMin),
      ratio_max: num(d.ratioMax),
      date_from: d.dateFrom || undefined,
      date_to: d.dateTo || undefined,
    };
    return q;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(buildQuery(draft));
  };

  const handleReset = () => {
    setDraft(EMPTY);
    onSearch({});
  };

  const numInputStyle = { minWidth: '64px', width: '64px' } as const;
  const dateInputStyle = { minWidth: '128px', width: '128px' } as const;

  return (
    <div
      style={{
        backgroundColor: theme.colors.surface,
        height: `${SAMPLE_SEARCHBAR_H}px`,
        padding: '16px 24px',
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.border}`,
        boxShadow: theme.shadow.card,
        marginBottom: '16px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SearchInput
            value={draft.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="SHA256/MD5 해시 또는 진단명 (예: Trojan.Win32)"
            style={{ flex: 1, minWidth: '280px' }}
          />
          <span
            style={{
              width: '170px',
              flexShrink: 0,
              fontSize: theme.fontSize.sm,
              color: draft.match === 'substring' && isDiagname ? theme.colors.warning : theme.colors.textMuted,
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {hint}
          </span>
          <SearchSelect
            value={draft.match}
            onChange={(e) => set({ match: e.target.value as MatchMode })}
            disabled={!isDiagname}
            title="진단명 검색 매칭 모드"
            style={{ minWidth: '150px' }}
          >
            <option value="prefix">진단명 전방일치</option>
            <option value="substring">진단명 부분일치</option>
          </SearchSelect>
          <span
            aria-hidden
            style={{
              width: '1px',
              height: '24px',
              backgroundColor: theme.colors.border,
              margin: '0 4px',
            }}
          />
          <Button type="submit">검색</Button>
          <Button type="button" variant="secondary" onClick={handleReset}>
            초기화
          </Button>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <FilterSelect value={draft.format} placeholder="포맷 전체" options={meta?.formats} onChange={(v) => set({ format: v })} />
          <FilterSelect value={draft.category} placeholder="카테고리 전체" options={meta?.categories} onChange={(v) => set({ category: v })} />
          <FilterSelect value={draft.pool} placeholder="풀 전체" options={meta?.pools} onChange={(v) => set({ pool: v })} />
          <FilterSelect value={draft.locale} placeholder="로케일 전체" options={meta?.locales} onChange={(v) => set({ locale: v })} />
          <FilterSelect value={draft.source} placeholder="소스 전체" options={meta?.sources} onChange={(v) => set({ source: v })} />
          <FilterSelect value={draft.tag} placeholder="태그 전체" options={meta?.tags} onChange={(v) => set({ tag: v })} />
          <FilterSelect value={draft.label} placeholder="라벨 전체" options={meta?.labels} onChange={(v) => set({ label: v })} />
          <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted, whiteSpace: 'nowrap' }}>
            진단율
          </span>
          <SearchInput
            type="number"
            min={0}
            max={100}
            value={draft.ratioMin}
            onChange={(e) => set({ ratioMin: e.target.value })}
            placeholder="0"
            style={numInputStyle}
          />
          <span style={{ color: theme.colors.textMuted }}>~</span>
          <SearchInput
            type="number"
            min={0}
            max={100}
            value={draft.ratioMax}
            onChange={(e) => set({ ratioMax: e.target.value })}
            placeholder="100"
            style={numInputStyle}
          />
          <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted, whiteSpace: 'nowrap' }}>
            등록일
          </span>
          <SearchInput
            type="date"
            value={draft.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            style={dateInputStyle}
          />
          <span style={{ color: theme.colors.textMuted }}>~</span>
          <SearchInput
            type="date"
            value={draft.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
            style={dateInputStyle}
          />
        </div>
      </form>
    </div>
  );
}
