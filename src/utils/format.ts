import type { Theme } from '@common/styles/theme';

export function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

/** 상세 화면용: "1,234,567 bytes (1.2 MB)" */
export function formatSizeDetailed(bytes: number): string {
  return `${bytes.toLocaleString()} bytes (${formatSize(bytes)})`;
}

/** ISO/DATETIME 문자열 → "YYYY-MM-DD HH:mm" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return value.replace('T', ' ').substring(0, 16);
}

/** ISO/DATETIME 문자열 → "YYYY-MM-DD" */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '-';
  return value.substring(0, 10);
}

/**
 * 진단율 색상 규칙 (VT 스타일, 테이블/게이지 공통):
 * 미진단(0) → success, 30% 이하 → warning, 초과 → danger
 */
export function detectionColor(
  theme: Theme,
  detectCount: number | null,
  totalCount: number | null,
): string {
  if (detectCount === null || totalCount === null) return theme.colors.textMuted;
  if (totalCount === 0 || detectCount === 0) return theme.colors.success;
  const ratio = detectCount / totalCount;
  if (ratio <= 0.3) return theme.colors.warning;
  return theme.colors.danger;
}

/** Blob 을 파일로 저장 (다운로드 응답 처리용) */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 알파-2 국가 코드 → 국기 이모지 (형식이 아니면 null — 예: '??' Unknown) */
export function flagEmoji(code: string): string | null {
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

/** 보관 상태 name(Stored/Moved/None) → 한글 표시 (그 외 값은 원문 유지) */
export function storageStatusLabel(status: string | null): string {
  if (!status) return '-';
  const map: Record<string, string> = {
    Stored: '보관중',
    Moved: '이동됨',
    None: '미보관',
  };
  return map[status] ?? status;
}
