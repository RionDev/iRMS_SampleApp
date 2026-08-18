const HEX_RE = /^[0-9a-fA-F]+$/;

export type HashType = 'sha256' | 'md5';

/** 64자리 hex → sha256, 32자리 hex → md5, 그 외 null (진단명 검색으로 처리) */
export function detectHashType(value: string): HashType | null {
  const v = value.trim();
  if (v.length === 64 && HEX_RE.test(v)) return 'sha256';
  if (v.length === 32 && HEX_RE.test(v)) return 'md5';
  return null;
}

export function isHash(value: string): boolean {
  return detectHashType(value) !== null;
}

/**
 * 개행/쉼표/공백 구분 해시 목록 파싱 (멀티 검색용).
 * 유효 해시는 소문자로 정규화하고 중복을 제거한다.
 */
export function parseHashList(text: string): { valid: string[]; invalid: string[] } {
  const tokens = text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (detectHashType(token)) {
      const normalized = token.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        valid.push(normalized);
      }
    } else {
      invalid.push(token);
    }
  }
  return { valid, invalid };
}
