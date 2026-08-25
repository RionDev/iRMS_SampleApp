import { describe, expect, it } from 'vitest';
import type { FilterMeta } from '../types/sample';
import { modifierToken, parseSearchInput, upsertModifierToken } from './searchQuery';

const META: FilterMeta = {
  tags: [
    { id: 1, name: 'apt' },
    { id: 2, name: 'in the wild' },
  ],
  labels: [{ id: 10, name: 'critical' }],
  vendors: [],
  formats: [{ id: 20, name: 'EXE' }],
  categories: [{ id: 30, name: 'trojan' }],
  locales: [
    { id: 40, name: 'Republic of Korea', label: 'KR' },
    { id: 41, name: "People's Republic of China", label: 'CN' },
    { id: 42, name: 'Taiwan, Province of China', label: 'TW' },
  ],
  sources: [{ id: 50, name: 'honeypot' }],
  pools: [{ id: 60, name: 'black' }],
};

describe('parseSearchInput', () => {
  it('사전 필터를 name → id 로 해석하고 자유 텍스트를 남긴다', () => {
    const r = parseSearchInput('format:exe tag:apt Trojan.Win32', META);
    expect(r.errors).toEqual([]);
    expect(r.freeText).toBe('Trojan.Win32');
    expect(r.filters).toEqual({ format: [20], tag: [1] });
    expect(r.modifierCount).toBe(2);
  });

  it('대소문자 무시 매칭 + 따옴표 값(공백 포함)을 지원한다', () => {
    const r = parseSearchInput('FORMAT:Exe tag:"in the wild"', META);
    expect(r.errors).toEqual([]);
    expect(r.filters).toEqual({ format: [20], tag: [2] });
  });

  it('tag/label 은 반복 지정 시 AND 누적, 단일 lookup 은 반복 시 OR 합집합', () => {
    const ok = parseSearchInput('tag:apt tag:"in the wild"', META);
    expect(ok.filters.tag).toEqual([1, 2]);

    const dup = parseSearchInput('locale:KR locale:CN', META);
    expect(dup.errors).toEqual([]);
    expect(dup.filters.locale).toEqual([40, 41]);
  });

  it('모르는 key 콜론(진단명)은 자유 텍스트로 남긴다', () => {
    const r = parseSearchInput('Trojan:Win32/Wacatac', META);
    expect(r.errors).toEqual([]);
    expect(r.freeText).toBe('Trojan:Win32/Wacatac');
    expect(r.modifierCount).toBe(0);
  });

  it('존재하지 않는 사전 값은 에러', () => {
    const r = parseSearchInput('tag:nope', META);
    expect(r.errors).toHaveLength(1);
  });

  it('로케일은 알파-2 코드와 부분 일치를 지원한다', () => {
    expect(parseSearchInput('locale:KR', META).filters).toEqual({ locale: [40] });
    expect(parseSearchInput('locale:korea', META).filters).toEqual({ locale: [40] });
  });

  it('단일 lookup 필터의 부분 일치가 여러 값에 걸리면 전부 OR 로 검색한다', () => {
    const r = parseSearchInput('locale:china', META);
    expect(r.errors).toEqual([]);
    expect(r.filters).toEqual({ locale: [41, 42] });
  });

  it('tag/label 은 AND 규약이라 부분 일치가 여러 값에 걸리면 후보와 함께 에러', () => {
    const r = parseSearchInput('tag:t', META); // 'apt' / 'in the wild' 둘 다 t 포함
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('apt');
    expect(r.filters).toEqual({});
  });

  it('ratio 단일/범위/한쪽 생략을 지원한다', () => {
    expect(parseSearchInput('ratio:50', META).filters).toEqual({ ratio_min: 50, ratio_max: 50 });
    expect(parseSearchInput('ratio:30..70', META).filters).toEqual({ ratio_min: 30, ratio_max: 70 });
    expect(parseSearchInput('ratio:30..', META).filters).toEqual({ ratio_min: 30, ratio_max: undefined });
    expect(parseSearchInput('ratio:70..30', META).errors).toHaveLength(1);
    expect(parseSearchInput('ratio:abc', META).errors).toHaveLength(1);
  });

  it('date 단일/범위/한쪽 생략을 지원한다', () => {
    expect(parseSearchInput('date:2026-01-01', META).filters).toEqual({
      date_from: '2026-01-01',
      date_to: '2026-01-01',
    });
    expect(parseSearchInput('date:2026-01-01..2026-06-30', META).filters).toEqual({
      date_from: '2026-01-01',
      date_to: '2026-06-30',
    });
    expect(parseSearchInput('date:..2026-06-30', META).filters).toEqual({
      date_from: undefined,
      date_to: '2026-06-30',
    });
    expect(parseSearchInput('date:2026-06-30..2026-01-01', META).errors).toHaveLength(1);
  });

  it('meta 미로딩 상태에서 사전 필터를 쓰면 에러', () => {
    const r = parseSearchInput('tag:apt', null);
    expect(r.errors).toHaveLength(1);
  });

  it('해시 목록 + 필터 혼용 시 자유 텍스트에 해시가 남는다', () => {
    const sha = 'a'.repeat(64);
    const md5 = 'b'.repeat(32);
    const r = parseSearchInput(`${sha} ${md5} tag:apt`, META);
    expect(r.freeText).toBe(`${sha} ${md5}`);
    expect(r.filters.tag).toEqual([1]);
  });
});

describe('modifierToken', () => {
  it('공백 포함 값은 따옴표로 감싼다', () => {
    expect(modifierToken('tag', 'apt')).toBe('tag:apt');
    expect(modifierToken('tag', 'in the wild')).toBe('tag:"in the wild"');
  });
});

describe('upsertModifierToken', () => {
  it('같은 key 토큰을 교체하고 나머지는 보존한다', () => {
    expect(upsertModifierToken('Trojan format:exe', 'format', 'format:zip')).toBe(
      'Trojan format:zip',
    );
    expect(upsertModifierToken('tag:"in the wild" abc', 'tag', 'tag:apt')).toBe('abc tag:apt');
  });

  it('token=null 이면 제거만 한다', () => {
    expect(upsertModifierToken('abc ratio:30..70', 'ratio', null)).toBe('abc');
  });

  it('없던 key 는 끝에 덧붙인다', () => {
    expect(upsertModifierToken('abc', 'date', 'date:2026-01-01..')).toBe(
      'abc date:2026-01-01..',
    );
  });
});
