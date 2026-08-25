import { useMemo, useState, type ClipboardEvent, type FormEvent } from 'react';
import { Button } from '@common/components/Button';
import { SearchInput } from '@common/components/SearchInput';
import { SearchSelect } from '@common/components/SearchSelect';
import { useThemeStore } from '@common/stores/themeStore';
import type { FilterMeta, FilterOption, SearchRequest } from '../types/sample';
import { MULTI_SEARCH_MAX } from '../types/sample';
import { detectHashType, parseHashList } from '../utils/hash';
import {
  DICT_MODIFIERS,
  modifierToken,
  parseSearchInput,
  upsertModifierToken,
  type DictModifierKey,
} from '../utils/searchQuery';

/** 검색바(1행) 고정 높이 — useFixedPageSize overhead 계산용 */
export const SAMPLE_SEARCHBAR_H = 72;
/** 필터 패널 확장 시 높이 (선택 2행 + 진단율/등록일 1행 추가) */
export const SAMPLE_SEARCHBAR_EXPANDED_H = 212;

/** 도움말 섹션당 한 번에 보여줄 값 칩 수 (로케일 등 사전이 커서 제한) */
const HELP_CHIP_LIMIT = 30;

interface SampleSearchBarProps {
  /** GET /meta/filters 응답 (로딩 전 null — 필터 문법 사용 시 안내) */
  meta: FilterMeta | null;
  onSearch: (req: SearchRequest) => void;
  /** 필터 패널 확장 여부 변경 알림 — 부모의 useFixedPageSize overhead 보정용 */
  onExpandChange?: (expanded: boolean) => void;
}

/** 사전 필터 섹션 정의 — 필터 패널 select 행/도움말 팝오버 공용 (short: 좁은 select 용) */
const DICT_SECTIONS: { key: keyof typeof DICT_MODIFIERS; label: string; short?: string }[] = [
  { key: 'format', label: '파일 포맷', short: '포맷' },
  { key: 'category', label: '파일 타입 분류', short: '분류' },
  { key: 'spectype', label: '세부 타입' },
  { key: 'compiler', label: '컴파일러' },
  { key: 'linker', label: '링커' },
  { key: 'library', label: '라이브러리' },
  { key: 'crypter', label: '크립터' },
  { key: 'overlay', label: '오버레이' },
  { key: 'resource', label: '리소스' },
  { key: 'pool', label: '풀' },
  { key: 'locale', label: '로케일' },
  { key: 'source', label: '수집 소스', short: '소스' },
  { key: 'tag', label: '태그' },
  { key: 'label', label: '위협 유형 (VT 라벨)', short: '위협 유형' },
];

/** 필터 패널 select 배치 — 1행: 파일 타입 관련 9종(좁게), 2행: 나머지 5종 */
const PANEL_ROWS = [
  { sections: DICT_SECTIONS.slice(0, 9), minWidth: '76px' },
  { sections: DICT_SECTIONS.slice(9), minWidth: '104px' },
];

/** 특수 값(미분류/실패류)은 이름순에 묻히지 않게 목록 최상단으로 올린다 */
const SPECIAL_OPTION_RANK: Record<string, number> = {
  unknown: 0,
  fail: 1,
  multi: 2,
  error: 3,
};

function sortSpecialFirst(options: FilterOption[]): FilterOption[] {
  return [...options].sort((a, b) => {
    const ra = SPECIAL_OPTION_RANK[a.name.toLowerCase()] ?? 99;
    const rb = SPECIAL_OPTION_RANK[b.name.toLowerCase()] ?? 99;
    return ra - rb; // 특수 값만 앞으로, 나머지는 원래 순서(이름순) 유지 — sort 는 stable
  });
}

function FilterSelect({
  value,
  placeholder,
  options,
  isLocale,
  minWidth = '104px',
  onChange,
}: {
  value: string;
  placeholder: string;
  options: FilterOption[] | undefined;
  isLocale?: boolean;
  minWidth?: string;
  onChange: (value: string) => void;
}) {
  return (
    <SearchSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={!options}
      title={placeholder}
      style={{ minWidth, flex: 1 }}
    >
      <option value="">{placeholder} 전체</option>
      {options &&
        sortSpecialFirst(options).map((o) => (
          <option key={o.id} value={o.id}>
            {isLocale && o.label ? `${o.label} — ${o.name}` : o.name}
          </option>
        ))}
    </SearchSelect>
  );
}

export function SampleSearchBar({ meta, onSearch, onExpandChange }: SampleSearchBarProps) {
  const { theme, isDarkMode } = useThemeStore();
  const [q, setQ] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [helpFilter, setHelpFilter] = useState('');

  const parsed = useMemo(() => parseSearchInput(q, meta), [q, meta]);

  // 자유 텍스트에 유효 해시가 2개 이상이면 멀티 해시 검색 (VirusTotal 방식)
  const hashes = useMemo(() => parseHashList(parsed.freeText), [parsed.freeText]);
  const isMulti = hashes.valid.length >= 2;
  const overLimit = hashes.valid.length > MULTI_SEARCH_MAX;

  const freeText = parsed.freeText;
  const hashType = detectHashType(freeText);
  const isDiagname = freeText !== '' && hashType === null && !isMulti;

  // 진단명 검색은 항상 부분일치 (사용자가 습관적으로 붙인 * 는 제거)
  const diagQuery = isDiagname ? freeText.replace(/^\*+|\*+$/g, '') : freeText;

  const filterSuffix = parsed.modifierCount > 0 ? ` + 필터 ${parsed.modifierCount}` : '';
  const errorMessages = [
    ...(overLimit ? [`해시 ${hashes.valid.length}개 — 최대 ${MULTI_SEARCH_MAX}개까지 가능합니다`] : []),
    ...parsed.errors,
  ];
  const hasError = errorMessages.length > 0;

  const hint = hasError
    ? `입력 오류 ${errorMessages.length}건`
    : !q.trim()
      ? ''
      : isMulti
        ? `멀티 해시 검색 (${hashes.valid.length}개${
            hashes.invalid.length > 0 ? ` · 무시 ${hashes.invalid.length}` : ''
          })${parsed.modifierCount > 0 ? ' — 필터 미적용' : ''}`
        : hashType
          ? `해시 검색 (${hashType.toUpperCase()})${filterSuffix}`
          : isDiagname
            ? `진단명 검색 (부분일치)${filterSuffix}`
            : `필터 검색 (${parsed.modifierCount}개)`;

  const hintColor = hasError
    ? theme.colors.danger
    : isMulti && parsed.modifierCount > 0
      ? theme.colors.warning
      : isMulti
        ? theme.colors.primary
        : theme.colors.textMuted;

  const setFilterPanel = (open: boolean) => {
    setFilterOpen(open);
    onExpandChange?.(open);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (hasError) return;
    setHelpOpen(false);
    if (isMulti) {
      onSearch({ mode: 'multi', hashes: hashes.valid });
      return;
    }
    onSearch({
      mode: 'single',
      query: {
        ...parsed.filters,
        q: diagQuery || undefined,
        match: isDiagname ? 'substring' : undefined,
      },
    });
  };

  // 여러 줄 해시 목록 붙여넣기 지원 — input 은 개행을 버리므로 공백으로 정규화해 삽입
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[\r\n\t]/.test(text)) return;
    e.preventDefault();
    const normalized = text.replace(/[\s,]+/g, ' ').trim();
    const input = e.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    setQ(input.value.slice(0, start) + normalized + input.value.slice(end));
  };

  /** 도움말에서 값 클릭 → 검색창 끝에 토큰 추가 */
  const appendToken = (token: string) => {
    setQ((prev) => (prev.trim() ? `${prev.trim()} ${token}` : token));
  };

  // ── 필터 패널 (드롭다운/입력) ↔ 검색어 토큰 동기화 ──
  const f = parsed.filters;

  const setDict = (key: DictModifierKey, idStr: string) => {
    if (!idStr) {
      setQ((prev) => upsertModifierToken(prev, key, null));
      return;
    }
    const opt = meta?.[DICT_MODIFIERS[key]].find((o) => String(o.id) === idStr);
    if (!opt) return;
    // locale 은 알파-2 코드로 삽입 (국명은 길고 공백 포함)
    const value = key === 'locale' ? (opt.label ?? opt.name) : opt.name;
    setQ((prev) => upsertModifierToken(prev, key, modifierToken(key, value)));
  };

  const dictValue = (key: DictModifierKey): string => {
    const v = f[key];
    if (Array.isArray(v)) return String(v[0] ?? '');
    return v === undefined ? '' : String(v);
  };

  const ratioMin = f.ratio_min?.toString() ?? '';
  const ratioMax = f.ratio_max?.toString() ?? '';
  const setRatio = (min: string, max: string) => {
    setQ((prev) =>
      upsertModifierToken(prev, 'ratio', min === '' && max === '' ? null : `ratio:${min}..${max}`),
    );
  };

  const dateFrom = f.date_from ?? '';
  const dateTo = f.date_to ?? '';
  const setDates = (from: string, to: string) => {
    setQ((prev) =>
      upsertModifierToken(prev, 'date', from === '' && to === '' ? null : `date:${from}..${to}`),
    );
  };

  const codeStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: theme.fontSize.sm,
    backgroundColor: isDarkMode ? theme.colors.pageBackground : theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    padding: '1px 5px',
  } as const;

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: theme.colors.surface,
        height: `${filterOpen ? SAMPLE_SEARCHBAR_EXPANDED_H : SAMPLE_SEARCHBAR_H}px`,
        padding: '16px 24px',
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.colors.border}`,
        boxShadow: theme.shadow.card,
        marginBottom: '16px',
        boxSizing: 'border-box',
        flexShrink: 0,
        transition: 'height 150ms ease',
        overflow: 'visible',
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onPaste={handlePaste}
            placeholder='해시(여러 개 가능)/진단명 — 필터: label:trojan tag:stealer format:exe ratio:30..70'
            style={{ flex: 1, minWidth: '280px' }}
          />
          <span
            title={hint}
            style={{
              maxWidth: '320px',
              flexShrink: 0,
              fontSize: theme.fontSize.sm,
              color: hintColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {hint}
          </span>
          <span
            aria-hidden
            style={{
              width: '1px',
              height: '24px',
              backgroundColor: theme.colors.border,
              margin: '0 4px',
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFilterPanel(!filterOpen);
              setHelpOpen(false);
            }}
            title="필터 선택 패널"
            aria-label="필터 선택 패널"
            aria-expanded={filterOpen}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'block' }}
              aria-hidden
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setHelpOpen((v) => !v);
              setFilterPanel(false);
            }}
            title="필터 문법 도움말"
            aria-expanded={helpOpen}
          >
            ?
          </Button>
          <Button type="submit" disabled={hasError}>
            검색
          </Button>
        </div>

        {/* 필터 선택 행 — 선택하면 검색어에 key:값 토큰이 삽입/교체된다 (블럭 확장) */}
        {filterOpen && (
          <>
            {PANEL_ROWS.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {row.sections.map(({ key, label, short }) => (
                  <FilterSelect
                    key={key}
                    placeholder={short ?? label}
                    value={dictValue(key)}
                    options={meta?.[DICT_MODIFIERS[key]]}
                    isLocale={key === 'locale'}
                    minWidth={row.minWidth}
                    onChange={(v) => setDict(key, v)}
                  />
                ))}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: theme.fontSize.sm,
                  fontWeight: 600,
                  color: theme.colors.textMuted,
                  whiteSpace: 'nowrap',
                }}
              >
                진단율 (%)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <SearchInput
                  type="number"
                  min={0}
                  max={100}
                  value={ratioMin}
                  onChange={(e) => setRatio(e.target.value, ratioMax)}
                  placeholder="0"
                  title="진단율 하한"
                  style={{ minWidth: '72px', width: '72px', textAlign: 'center' }}
                />
                <span style={{ color: theme.colors.textMuted }}>~</span>
                <SearchInput
                  type="number"
                  min={0}
                  max={100}
                  value={ratioMax}
                  onChange={(e) => setRatio(ratioMin, e.target.value)}
                  placeholder="100"
                  title="진단율 상한"
                  style={{ minWidth: '72px', width: '72px', textAlign: 'center' }}
                />
              </span>
              <span
                aria-hidden
                style={{
                  width: '1px',
                  height: '24px',
                  backgroundColor: theme.colors.border,
                  margin: '0 4px',
                }}
              />
              <span
                style={{
                  fontSize: theme.fontSize.sm,
                  fontWeight: 600,
                  color: theme.colors.textMuted,
                  whiteSpace: 'nowrap',
                }}
              >
                등록일
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <SearchInput
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDates(e.target.value, dateTo)}
                  title="등록일 시작"
                  style={{ minWidth: '164px', width: '164px' }}
                />
                <span style={{ color: theme.colors.textMuted }}>~</span>
                <SearchInput
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDates(dateFrom, e.target.value)}
                  title="등록일 끝"
                  style={{ minWidth: '164px', width: '164px' }}
                />
              </span>
              <span style={{ marginLeft: 'auto', fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
                선택하면 검색어에 <span style={codeStyle}>key:값</span> 으로 반영됩니다
              </span>
            </div>
          </>
        )}
      </form>

      {/* 검색바 아래 오버레이 스택: 오류 안내 / 도움말 */}
      <div
        style={{
          position: 'absolute',
          top: `${(filterOpen ? SAMPLE_SEARCHBAR_EXPANDED_H : SAMPLE_SEARCHBAR_H) - 6}px`,
          left: '24px',
          right: '24px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
      {/* 입력 오류 — 후보 목록 등 긴 메시지를 잘림 없이 표시 */}
      {hasError && (
        <div
          style={{
            pointerEvents: 'auto',
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.danger}`,
            borderRadius: theme.radius.md,
            boxShadow: theme.shadow.card,
            padding: '10px 16px',
            fontSize: theme.fontSize.sm,
            color: theme.colors.danger,
            lineHeight: 1.6,
            wordBreak: 'break-all',
          }}
        >
          {errorMessages.map((msg) => (
            <div key={msg}>{msg}</div>
          ))}
        </div>
      )}


      {helpOpen && (
        <div
          style={{
            pointerEvents: 'auto',
            alignSelf: 'flex-end',
            width: 'min(640px, 100%)',
            maxHeight: '420px',
            overflowY: 'auto',
            boxSizing: 'border-box',
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            boxShadow: theme.shadow.card,
            padding: '16px 20px',
            fontSize: theme.fontSize.sm,
            color: theme.colors.text,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: theme.fontSize.base }}>검색 필터 문법</span>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              style={{
                marginLeft: 'auto',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: theme.colors.textMuted,
                fontSize: theme.fontSize.base,
              }}
              aria-label="도움말 닫기"
            >
              ✕
            </button>
          </div>
          <div style={{ color: theme.colors.textMuted, marginBottom: '12px', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 600, color: theme.colors.text, marginBottom: '2px' }}>기본</div>
            검색어와 <span style={codeStyle}>key:값</span> 필터를 섞어 씁니다. 값에 공백이 있으면{' '}
            <span style={codeStyle}>tag:&quot;a b&quot;</span> 처럼 따옴표로 감쌉니다.
            <br />
            해시(SHA256/MD5) 1개는 해시 검색, 여러 개를 붙여넣으면 멀티 해시 검색이 됩니다
            (멀티 검색에는 필터 미적용). 그 외 텍스트는 진단명으로 자동 부분일치 검색됩니다.
            <br />
            필터 값은 일부만 입력해도 됩니다 — 로케일은 코드/국명 어느 쪽이든{' '}
            <span style={codeStyle}>locale:KR</span> · <span style={codeStyle}>locale:china</span>.

            <div style={{ fontWeight: 600, color: theme.colors.text, margin: '8px 0 2px' }}>
              같은 필터를 여러 번 쓰면
            </div>
            <span style={{ color: theme.colors.text }}>
              포맷·카테고리·풀·로케일·소스는 <b>OR</b>
            </span>{' '}
            — <span style={codeStyle}>format:exe format:zip</span> 은 &quot;EXE 또는 ZIP&quot;.
            샘플당 값이 1개인 항목이라 <span style={codeStyle}>locale:china</span> 처럼 여러 값에
            걸려도 전부 OR 로 검색합니다.
            <br />
            <span style={{ color: theme.colors.text }}>
              태그·라벨은 <b>AND</b>
            </span>{' '}
            — <span style={codeStyle}>tag:apt tag:stealer</span> 는 &quot;두 태그를 모두 가진
            샘플&quot;. 그래서 tag/label 값은 하나로 정확히 좁혀야 하며, 여러 값에 걸리면 후보를
            안내합니다.

            <div style={{ fontWeight: 600, color: theme.colors.text, margin: '8px 0 2px' }}>범위</div>
            진단율 <span style={codeStyle}>ratio:30..70</span> · <span style={codeStyle}>ratio:50</span> ·{' '}
            <span style={codeStyle}>ratio:30..</span>(이상), 등록일{' '}
            <span style={codeStyle}>date:2026-01-01..2026-06-30</span> ·{' '}
            <span style={codeStyle}>date:2026-01-01..</span>(이후)
          </div>
          {!meta && (
            <div style={{ color: theme.colors.warning }}>필터 목록을 불러오는 중입니다...</div>
          )}
          {meta && (
            <>
              <SearchInput
                value={helpFilter}
                onChange={(e) => setHelpFilter(e.target.value)}
                placeholder="필터 값 검색 (예: trojan, KR)"
                style={{ width: '100%', marginBottom: '10px' }}
              />
              {DICT_SECTIONS.map(({ key, label }) => {
                const options = meta[DICT_MODIFIERS[key]];
                if (options.length === 0) return null;
                const needle = helpFilter.trim().toLowerCase();
                const visible = needle
                  ? options.filter(
                      (o) =>
                        o.name.toLowerCase().includes(needle) ||
                        o.label?.toLowerCase().includes(needle),
                    )
                  : options;
                // 값 검색 중에는 일치하는 섹션을 자동으로 펼친다
                const isOpen = needle ? visible.length > 0 : openSection === key;
                return (
                  <div key={key} style={{ marginBottom: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setOpenSection((cur) => (cur === key ? null : key))}
                      aria-expanded={isOpen}
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: '2px 0',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: theme.fontSize.sm,
                        color: theme.colors.text,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ color: theme.colors.textMuted }}>{isOpen ? '▾' : '▸'}</span>
                      {label} <span style={codeStyle}>{key}:</span>
                      <span style={{ color: theme.colors.textMuted, fontWeight: 400 }}>
                        {needle ? `${visible.length}/${options.length}개` : `${options.length}개`}
                      </span>
                    </button>
                    {isOpen && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          padding: '4px 0 4px 18px',
                        }}
                      >
                        {sortSpecialFirst(visible).slice(0, HELP_CHIP_LIMIT).map((o) => {
                          // locale 은 국명 대신 알파-2 코드 칩으로 (개수가 많고 코드 입력이 간편)
                          const value = key === 'locale' ? (o.label ?? o.name) : o.name;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => appendToken(modifierToken(key, value))}
                              title={o.label ? `${o.name} — ${key}:${value} 추가` : `${key}:${value} 추가`}
                              style={{
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: theme.radius.sm,
                                backgroundColor: isDarkMode
                                  ? theme.colors.pageBackground
                                  : theme.colors.surfaceMuted,
                                color: theme.colors.text,
                                fontSize: theme.fontSize.xs,
                                padding: '2px 8px',
                                cursor: 'pointer',
                              }}
                            >
                              {value}
                            </button>
                          );
                        })}
                        {visible.length > HELP_CHIP_LIMIT && (
                          <span
                            style={{
                              fontSize: theme.fontSize.xs,
                              color: theme.colors.textMuted,
                              alignSelf: 'center',
                            }}
                          >
                            외 {visible.length - HELP_CHIP_LIMIT}개 — 위 검색으로 좁혀 주세요
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
