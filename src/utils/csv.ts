// 선택 샘플 CSV 내보내기 — 클라이언트에서 SampleSummary 목록을 직렬화한다.

import type { SampleSummary } from '../types/sample';

/** CSV 컬럼 그룹 (내보내기 모달에서 섹션으로 묶어 표시) */
export type CsvGroup = '해시' | '파일' | '분류' | '진단' | '메타';

export interface CsvColumnDef {
  key: string;
  /** 내보내기 모달 표시명 */
  label: string;
  group: CsvGroup;
  /** 진단명(diagnoses)은 별도 맵에서 채우므로 get 없음 */
  get?: (s: SampleSummary) => string | number | null;
}

/** 진단명 컬럼 key — 대상 해시로 벌크 조회한 맵에서 채운다 */
export const DIAGNOSES_KEY = 'diagnoses';

export const CSV_COLUMNS: CsvColumnDef[] = [
  { key: 'sha256', label: 'SHA256', group: '해시', get: (s) => s.sha256 },
  { key: 'md5', label: 'MD5', group: '해시', get: (s) => s.md5 },
  { key: 'ssdeep', label: 'SSDEEP', group: '해시', get: (s) => s.ssdeep },
  { key: 'file_size', label: '크기(bytes)', group: '파일', get: (s) => s.file_size },
  { key: 'format', label: '포맷', group: '파일', get: (s) => s.format },
  { key: 'category', label: '카테고리', group: '파일', get: (s) => s.category },
  { key: 'spectype', label: '세부 타입', group: '파일', get: (s) => s.spectype },
  { key: 'compiler', label: '컴파일러', group: '파일', get: (s) => s.compiler },
  { key: 'linker', label: '링커', group: '파일', get: (s) => s.linker },
  { key: 'library', label: '라이브러리', group: '파일', get: (s) => s.library },
  { key: 'crypter', label: '크립터', group: '파일', get: (s) => s.crypter },
  { key: 'overlay', label: '오버레이', group: '파일', get: (s) => s.overlay },
  { key: 'resource', label: '리소스', group: '파일', get: (s) => s.resource },
  { key: 'pool', label: '풀', group: '분류', get: (s) => s.pool },
  { key: 'locale', label: '로케일', group: '분류', get: (s) => s.locale },
  { key: 'source', label: '수집 소스', group: '분류', get: (s) => s.source },
  { key: 'tags', label: '태그', group: '분류', get: (s) => s.tags.join(';') },
  { key: 'labels', label: '라벨', group: '분류', get: (s) => s.labels.join(';') },
  { key: 'detect_count', label: '진단수', group: '진단', get: (s) => s.detect_count },
  { key: 'total_count', label: '전체 엔진수', group: '진단', get: (s) => s.total_count },
  { key: 'detect_ratio', label: '진단율(%)', group: '진단', get: (s) => s.detect_ratio },
  { key: DIAGNOSES_KEY, label: '벤더별 진단명', group: '진단' }, // diagnosesMap 에서 채움
  { key: 'register_date', label: '등록일', group: '메타', get: (s) => s.register_date },
  { key: 'storage_status', label: '보관 상태', group: '메타', get: (s) => s.storage_status },
];

/** 표시 순서를 유지한 그룹 목록 */
export const CSV_GROUPS: CsvGroup[] = ['해시', '파일', '분류', '진단', '메타'];

function escapeCell(value: string | number | null): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV 내보내기에 진단명 컬럼이 포함되는지 (포함 시 벌크 조회 필요) */
export function needsDiagnoses(keys: string[]): boolean {
  return keys.includes(DIAGNOSES_KEY);
}

/**
 * UTF-8 BOM 포함 CSV 문자열 (Excel 한글 호환).
 * keys 를 주면 해당 컬럼만 (CSV_COLUMNS 정의 순서 유지), 없으면 전체.
 * 진단명 컬럼은 diagnosesMap[sampleKey] 에서 채운다 (sampleKey = sha256 ?? md5).
 */
export function samplesToCsv(
  items: SampleSummary[],
  keys?: string[],
  diagnosesMap?: Record<string, string>,
): string {
  const cols = keys ? CSV_COLUMNS.filter((c) => keys.includes(c.key)) : CSV_COLUMNS;
  const header = cols.map((c) => c.label).join(',');
  const rows = items.map((s) => {
    const key = s.sha256 ?? s.md5;
    return cols
      .map((c) =>
        escapeCell(c.key === DIAGNOSES_KEY ? (diagnosesMap?.[key] ?? '') : (c.get?.(s) ?? null)),
      )
      .join(',');
  });
  return `﻿${[header, ...rows].join('\r\n')}\r\n`;
}
