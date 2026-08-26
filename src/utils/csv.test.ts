import { describe, expect, it } from 'vitest';
import type { SampleSummary } from '../types/sample';
import { samplesToCsv } from './csv';

const SAMPLE: SampleSummary = {
  id: 1,
  sha256: 'a'.repeat(64),
  md5: 'b'.repeat(32),
  file_size: 1024,
  pool: 'Black',
  format: 'PE32',
  category: 'Format',
  spectype: 'NSIS, "Archive"',
  detect_count: 10,
  total_count: 60,
  detect_ratio: 17,
  locale: 'Republic of Korea',
  source: null,
  tags: ['apt', 'stealer'],
  register_date: '2026-08-01 10:00:00',
  storage_status: 'Stored',
};

describe('samplesToCsv', () => {
  it('BOM + 헤더 + 행을 만들고 쉼표/따옴표 값을 이스케이프한다', () => {
    const csv = samplesToCsv([SAMPLE]);
    expect(csv.startsWith('﻿')).toBe(true);
    const [header, row] = csv.slice(1).split('\r\n');
    expect(header.split(',')[0]).toBe('SHA256');
    expect(row).toContain('"NSIS, ""Archive"""');
    expect(row).toContain('apt;stealer');
    // null 은 빈 셀
    expect(row).toContain(',,');
  });

  it('keys 를 주면 해당 컬럼만 정의 순서대로 내보낸다', () => {
    const csv = samplesToCsv([SAMPLE], ['md5', 'sha256', 'pool']);
    const [header, row] = csv.slice(1).split('\r\n');
    expect(header).toBe('SHA256,MD5,풀');
    expect(row).toBe(`${'a'.repeat(64)},${'b'.repeat(32)},Black`);
  });
});
