import { describe, expect, it } from 'vitest';
import { detectHashType, parseHashList } from './hash';

describe('detectHashType', () => {
  it('SHA256과 MD5를 길이와 hex 형식으로 구분한다', () => {
    expect(detectHashType('a'.repeat(64))).toBe('sha256');
    expect(detectHashType('B'.repeat(32))).toBe('md5');
    expect(detectHashType('z'.repeat(64))).toBeNull();
  });
});

describe('parseHashList', () => {
  it('구분자를 처리하고 해시를 정규화·중복 제거한다', () => {
    const sha = 'A'.repeat(64);
    const md5 = 'b'.repeat(32);
    expect(parseHashList(`${sha}, ${md5}\n${sha} invalid`)).toEqual({
      valid: [sha.toLowerCase(), md5],
      invalid: ['invalid'],
    });
  });
});
