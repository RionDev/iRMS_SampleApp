// 선택 샘플 CSV 내보내기 — 클라이언트에서 SampleSummary 목록을 직렬화한다.

import type { SampleSummary } from '../types/sample';

export interface CsvColumnDef {
  key: string;
  /** 내보내기 모달 표시명 */
  label: string;
  get: (s: SampleSummary) => string | number | null;
}

export const CSV_COLUMNS: CsvColumnDef[] = [
  { key: 'sha256', label: 'SHA256', get: (s) => s.sha256 },
  { key: 'md5', label: 'MD5', get: (s) => s.md5 },
  { key: 'file_size', label: '크기(bytes)', get: (s) => s.file_size },
  { key: 'pool', label: '풀', get: (s) => s.pool },
  { key: 'format', label: '포맷', get: (s) => s.format },
  { key: 'category', label: '카테고리', get: (s) => s.category },
  { key: 'spectype', label: '세부 타입', get: (s) => s.spectype },
  { key: 'detect_count', label: '진단수', get: (s) => s.detect_count },
  { key: 'total_count', label: '전체 엔진수', get: (s) => s.total_count },
  { key: 'detect_ratio', label: '진단율(%)', get: (s) => s.detect_ratio },
  { key: 'locale', label: '로케일', get: (s) => s.locale },
  { key: 'source', label: '수집 소스', get: (s) => s.source },
  { key: 'tags', label: '태그', get: (s) => s.tags.join(';') },
  { key: 'register_date', label: '등록일', get: (s) => s.register_date },
  { key: 'storage_status', label: '보관 상태', get: (s) => s.storage_status },
];

function escapeCell(value: string | number | null): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * UTF-8 BOM 포함 CSV 문자열 (Excel 한글 호환).
 * keys 를 주면 해당 컬럼만 (CSV_COLUMNS 정의 순서 유지), 없으면 전체.
 */
export function samplesToCsv(items: SampleSummary[], keys?: string[]): string {
  const cols = keys ? CSV_COLUMNS.filter((c) => keys.includes(c.key)) : CSV_COLUMNS;
  const header = cols.map((c) => c.label).join(',');
  const rows = items.map((s) => cols.map((c) => escapeCell(c.get(s))).join(','));
  return `﻿${[header, ...rows].join('\r\n')}\r\n`;
}
