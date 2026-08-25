// VT 샘플 조회 서비스 DTO — 계약 SoT: iRMS_BE/docs/plan/vt-sample-service.md
// (BE 1단계 구현 후에는 /api/sample/docs Swagger 기준으로 재검증)
//
// 규약: 응답의 lookup/dict 필드(pool/format/locale/... , tags/labels)는 BE가
// name 문자열로 해석해 내려주고, 검색 필터 파라미터는 id 로 보낸다.

export interface SampleSummary {
  id: number;
  /** DB 스키마상 NULL 허용 (md5 가 필수 UNIQUE 키) */
  sha256: string | null;
  md5: string;
  file_size: number;
  pool: string | null;
  format: string | null;
  category: string | null;
  /** 파일 세부 타입 name */
  spectype: string | null;
  detect_count: number | null;
  total_count: number | null;
  /** 정수 퍼센트 0~100 */
  detect_ratio: number | null;
  locale: string | null;
  source: string | null;
  tags: string[];
  register_date: string;
  storage_status: string | null;
}

/** 파일 세부 타입 (전부 name 해석, 값 없으면 null) */
export interface SampleTypeDetail {
  format: string | null;
  category: string | null;
  spectype: string | null;
  compiler: string | null;
  linker: string | null;
  library: string | null;
  crypter: string | null;
  overlay: string | null;
  resource: string | null;
}

export interface SampleDiagnosis {
  vendor: string;
  diagname: string;
}

export interface SampleDetail extends SampleSummary {
  labels: string[];
  type: SampleTypeDetail | null;
  /** bs:chunk1:chunk2 조합 문자열, 없으면 null */
  ssdeep: string | null;
  /** 미진단 벤더 제외 */
  diagnoses: SampleDiagnosis[];
  /** storage 상태 기반 다운로드 가능 여부 */
  downloadable: boolean;
}

export interface FilterOption {
  id: number;
  name: string;
  label?: string | null;
}

/** GET /api/sample/meta/filters 응답 */
export interface FilterMeta {
  tags: FilterOption[];
  labels: FilterOption[];
  vendors: FilterOption[];
  formats: FilterOption[];
  categories: FilterOption[];
  locales: FilterOption[];
  sources: FilterOption[];
  pools: FilterOption[];
  spectypes: FilterOption[];
  compilers: FilterOption[];
  linkers: FilterOption[];
  libraries: FilterOption[];
  crypters: FilterOption[];
  overlays: FilterOption[];
  resources: FilterOption[];
}

export type MatchMode = 'prefix' | 'substring';

/** GET /api/sample/samples 검색 조건 — lookup/dict 필터는 id 로 전달 */
export interface SampleSearchQuery {
  /** 64/32자리 hex 면 해시 검색, 그 외 진단명 검색 (BE 자동 판별) */
  q?: string;
  /** 진단명 검색 매칭 모드 (기본 prefix) */
  match?: MatchMode;
  /** 단일 lookup 필터 — 반복 지정 시 OR (부분 일치가 여러 id 로 풀릴 수 있음) */
  pool?: number[];
  locale?: number[];
  source?: number[];
  format?: number[];
  category?: number[];
  spectype?: number[];
  compiler?: number[];
  linker?: number[];
  library?: number[];
  crypter?: number[];
  overlay?: number[];
  resource?: number[];
  /** 반복 지정 시 AND */
  tag?: number[];
  label?: number[];
  ratio_min?: number;
  ratio_max?: number;
  /** YYYY-MM-DD */
  date_from?: string;
  date_to?: string;
}

/** POST /api/sample/samples/multi-search 응답 */
export interface MultiSearchResult {
  matched: SampleSummary[];
  unmatched: string[];
}

/**
 * 검색바 제출 요청 — 검색어에 유효 해시가 2개 이상이면 멀티 해시 검색으로
 * 전환된다 (VirusTotal 방식: 별도 화면 없이 같은 검색바에서 처리).
 * 멀티 모드에서는 상세 필터가 적용되지 않는다.
 */
export type SearchRequest =
  | { mode: 'single'; query: SampleSearchQuery }
  | { mode: 'multi'; hashes: string[] };

/** 멀티 검색 최대 해시 수 (BE 계약) */
export const MULTI_SEARCH_MAX = 500;
/** 배치 다운로드 최대 선택 수 (BE 계약) */
export const BATCH_DOWNLOAD_MAX = 50;
/** 배치 다운로드 ZIP 비밀번호 (BE 기본값 — env 로 변경 가능) */
export const BATCH_ZIP_PASSWORD = 'infected';

