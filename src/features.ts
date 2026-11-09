/**
 * 샘플 앱 기능 키 — BE sample_service `src/features.py` 와 같은 값.
 * 관리자가 admin 앱 → 앱 상세 → 기능 권한에서 기능별 최소 등급·허용 팀을 정한다.
 * 화면은 useFeatures(SAMPLE_APP).can(키) 로 버튼을 숨기고, 실제 차단은 BE 가 한다.
 */
export const SAMPLE_APP = '/sample';

export const Feature = {
  SEARCH: 'search',
  EXPORT_CSV: 'export_csv',
  DOWNLOAD: 'download',
} as const;
