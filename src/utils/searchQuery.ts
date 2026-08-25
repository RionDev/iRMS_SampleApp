// 검색창 필터 문법 파서 (VirusTotal Intelligence 스타일)
//
//   tag:apt label:critical format:exe ratio:30..70 date:2026-01-01.. Trojan.Win32
//
// - key:value 토큰 중 key 가 아는 필터면 modifier, 아니면 자유 텍스트로 남긴다
//   (진단명에 콜론이 들어가는 경우 — 예: Trojan:Win32/Wacatac — 를 위해)
// - 값에 공백이 있으면 tag:"a b" 처럼 따옴표로 감싼다
// - 사전 필터 값은 /meta/filters 의 name 과 대소문자 무시 정확 일치 → id 로 변환
//   (BE 검색 파라미터는 id 규약이므로 BE 수정 없이 동작)

import type { FilterMeta, FilterOption, SampleSearchQuery } from '../types/sample';

/** 사전(dict) 필터 key → FilterMeta 목록 매핑 */
export const DICT_MODIFIERS = {
  format: 'formats',
  category: 'categories',
  pool: 'pools',
  locale: 'locales',
  source: 'sources',
  tag: 'tags',
  label: 'labels',
} as const;

export type DictModifierKey = keyof typeof DICT_MODIFIERS;

/** 범위/특수 필터 key */
export const RANGE_MODIFIERS = ['ratio', 'date'] as const;

const MODIFIER_KEYS = new Set<string>([...Object.keys(DICT_MODIFIERS), ...RANGE_MODIFIERS]);

export interface ParsedSearchInput {
  /** modifier 를 뺀 나머지 자유 텍스트 (해시 목록 또는 진단명) */
  freeText: string;
  /** 해석된 필터 (q/match 제외) */
  filters: Omit<SampleSearchQuery, 'q' | 'match'>;
  /** 적용된 필터 수 */
  modifierCount: number;
  errors: string[];
}

/** 따옴표를 존중하는 공백 분리 토크나이저 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let inQuote = false;
  for (const ch of input) {
    if (ch === '"') {
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if (!inQuote && /\s/.test(ch)) {
      if (cur) tokens.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * 사전 값 해석 — 정확 일치 우선, 없으면 부분 일치로 걸리는 모든 id.
 * name 과 label(로케일 알파-2 코드) 둘 다 본다. 예: locale:KR, locale:china.
 */
function resolveDict(options: FilterOption[], value: string): FilterOption[] {
  const lower = value.toLowerCase();
  const exact = options.find(
    (o) => o.name.toLowerCase() === lower || o.label?.toLowerCase() === lower,
  );
  if (exact) return [exact];
  return options.filter(
    (o) => o.name.toLowerCase().includes(lower) || o.label?.toLowerCase().includes(lower),
  );
}

const RATIO_RANGE_RE = /^(\d{1,3})?\.\.(\d{1,3})?$/;
const RATIO_SINGLE_RE = /^(\d{1,3})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_RANGE_RE = /^(\d{4}-\d{2}-\d{2})?\.\.(\d{4}-\d{2}-\d{2})?$/;

function parseRatio(value: string, errors: string[]): { min?: number; max?: number } {
  const single = RATIO_SINGLE_RE.exec(value);
  const range = RATIO_RANGE_RE.exec(value);
  const min = single ? Number(single[1]) : range?.[1] !== undefined ? Number(range[1]) : undefined;
  const max = single ? Number(single[1]) : range?.[2] !== undefined ? Number(range[2]) : undefined;
  if ((!single && !range) || (min === undefined && max === undefined)) {
    errors.push(`ratio 형식 오류: "${value}" (예: ratio:30..70, ratio:50, ratio:30..)`);
    return {};
  }
  if ((min !== undefined && min > 100) || (max !== undefined && max > 100)) {
    errors.push('ratio 는 0~100 사이여야 합니다');
    return {};
  }
  if (min !== undefined && max !== undefined && min > max) {
    errors.push('ratio 범위가 뒤집혔습니다 (최소..최대)');
    return {};
  }
  return { min, max };
}

function parseDate(value: string, errors: string[]): { from?: string; to?: string } {
  if (DATE_RE.test(value)) return { from: value, to: value };
  const range = DATE_RANGE_RE.exec(value);
  const from = range?.[1];
  const to = range?.[2];
  if (!range || (!from && !to)) {
    errors.push(`date 형식 오류: "${value}" (예: date:2026-01-01..2026-06-30, date:2026-01-01..)`);
    return {};
  }
  if (from && to && from > to) {
    errors.push('date 범위가 뒤집혔습니다 (시작..끝)');
    return {};
  }
  return { from, to };
}

/**
 * 검색 입력을 자유 텍스트 + 필터로 분해한다.
 * meta 가 아직 없으면 사전 필터 사용 시 에러를 낸다 (해시/진단명 검색은 가능).
 */
export function parseSearchInput(input: string, meta: FilterMeta | null): ParsedSearchInput {
  const freeTokens: string[] = [];
  const errors: string[] = [];
  const filters: Omit<SampleSearchQuery, 'q' | 'match'> = {};
  const seenSingle = new Set<string>();
  let modifierCount = 0;

  for (const token of tokenize(input)) {
    const m = /^([A-Za-z_]+):(.*)$/.exec(token);
    const key = m?.[1].toLowerCase();
    if (!m || !key || !MODIFIER_KEYS.has(key)) {
      freeTokens.push(token);
      continue;
    }
    const value = unquote(m[2]);
    if (!value) {
      errors.push(`${key}: 값이 비었습니다`);
      continue;
    }
    modifierCount += 1;

    if (key === 'ratio') {
      if (seenSingle.has(key)) {
        errors.push('ratio 필터가 중복되었습니다');
        continue;
      }
      seenSingle.add(key);
      const { min, max } = parseRatio(value, errors);
      filters.ratio_min = min;
      filters.ratio_max = max;
      continue;
    }
    if (key === 'date') {
      if (seenSingle.has(key)) {
        errors.push('date 필터가 중복되었습니다');
        continue;
      }
      seenSingle.add(key);
      const { from, to } = parseDate(value, errors);
      filters.date_from = from;
      filters.date_to = to;
      continue;
    }

    // 사전 필터 — meta name → id 변환
    if (!meta) {
      errors.push('필터 목록을 아직 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      continue;
    }
    const dictKey = key as DictModifierKey;
    const matched = resolveDict(meta[DICT_MODIFIERS[dictKey]], value);
    if (matched.length === 0) {
      errors.push(`존재하지 않는 ${key}: "${value}" (도움말에서 목록 확인)`);
      continue;
    }
    if (dictKey === 'tag' || dictKey === 'label') {
      // 반복 지정 시 AND (BE 규약) — 한 토큰이 여러 값에 걸리면 AND 로 의미가
      // 왜곡되므로 tag/label 만은 유일하게 좁혀야 한다
      if (matched.length > 1) {
        const names = matched.slice(0, 3).map((o) => o.name).join(', ');
        const rest = matched.length - 3;
        errors.push(
          `${key}:"${value}" 이(가) 여러 값과 일치: ${names}${rest > 0 ? ` 외 ${rest}개` : ''} — 더 구체적으로 입력해 주세요`,
        );
        continue;
      }
      const id = matched[0].id;
      const list = filters[dictKey] ?? [];
      if (!list.includes(id)) list.push(id);
      filters[dictKey] = list;
    } else {
      // 단일 lookup 필터 — 부분 일치 다건/반복 지정 모두 OR 로 누적 (BE in_ 검색)
      const list = filters[dictKey] ?? [];
      for (const o of matched) {
        if (!list.includes(o.id)) list.push(o.id);
      }
      filters[dictKey] = list;
    }
  }

  return { freeText: freeTokens.join(' '), filters, modifierCount, errors };
}

/** 필터 패널에서 값 선택 시 검색창에 붙일 토큰 (공백 포함 값은 따옴표) */
export function modifierToken(key: string, name: string): string {
  return /\s/.test(name) ? `${key}:"${name}"` : `${key}:${name}`;
}

/**
 * 검색 입력에서 key 필터 토큰을 제거하고 (있다면) 새 토큰을 끝에 덧붙인다.
 * 필터 패널의 드롭다운/입력 → 검색어 동기화용. token=null 이면 제거만 한다.
 */
export function upsertModifierToken(input: string, key: string, token: string | null): string {
  const prefix = `${key.toLowerCase()}:`;
  const keep = tokenize(input).filter((t) => !t.toLowerCase().startsWith(prefix));
  if (token) keep.push(token);
  return keep.join(' ');
}
