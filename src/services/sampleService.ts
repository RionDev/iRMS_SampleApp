// sample-service API 레이어 — 계약: iRMS_BE/docs/plan/vt-sample-service.md
// UI 단독 개발 시에는 VITE_USE_MOCK=1 로 mock 구현을 사용할 수 있다.

import apiClient from '@common/services/apiClient';
import type { Page } from '@common/types/pagination';
import type {
  FilterMeta,
  MultiSearchResult,
  SampleDetail,
  SampleSearchQuery,
  SampleSummary,
} from '../types/sample';
import * as mock from './mock/mockSampleService';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1';

/** 다운로드는 SFTP 페치+ZIP 생성 후 스트림 — 게이트웨이 300s 에 맞춰 늘린다 */
const DOWNLOAD_TIMEOUT_MS = 300_000;

export async function getSamples(
  query: SampleSearchQuery,
  cursor?: string,
  snapshotIdx?: number,
  size: number = 50,
): Promise<Page<SampleSummary>> {
  if (USE_MOCK) return mock.getSamples(query, cursor, snapshotIdx, size);
  const res = await apiClient.get<Page<SampleSummary>>('/api/sample/samples', {
    params: {
      cursor,
      snapshot_idx: snapshotIdx,
      size,
      q: query.q || undefined,
      match: query.match,
      pool: query.pool,
      locale: query.locale,
      source: query.source,
      format: query.format,
      category: query.category,
      spectype: query.spectype,
      compiler: query.compiler,
      linker: query.linker,
      library: query.library,
      crypter: query.crypter,
      overlay: query.overlay,
      resource: query.resource,
      tag: query.tag,
      label: query.label,
      ratio_min: query.ratio_min,
      ratio_max: query.ratio_max,
      date_from: query.date_from,
      date_to: query.date_to,
    },
    // 배열 파라미터를 ?tag=1&tag=2 형태로 직렬화
    paramsSerializer: { indexes: null },
  });
  return res.data;
}

/** 64hex→sha256 / 32hex→md5 자동 판별 (그 외 BE 가 400) */
export async function getSampleDetail(hash: string): Promise<SampleDetail> {
  if (USE_MOCK) return mock.getSampleDetail(hash);
  const res = await apiClient.get<SampleDetail>(`/api/sample/samples/${hash}`);
  return res.data;
}

/** 해시 최대 500개 → matched/unmatched 분리 */
export async function multiSearch(hashes: string[]): Promise<MultiSearchResult> {
  if (USE_MOCK) return mock.multiSearch(hashes);
  const res = await apiClient.post<MultiSearchResult>('/api/sample/samples/multi-search', {
    hashes,
  });
  return res.data;
}

/** 필터 옵션 사전 일괄 조회 (id+name 쌍) — 화면 진입 시 1회 */
export async function getFilterMeta(): Promise<FilterMeta> {
  if (USE_MOCK) return mock.getFilterMeta();
  const res = await apiClient.get<FilterMeta>('/api/sample/meta/filters');
  return res.data;
}

/** 단건 파일 다운로드 — 미보관/SFTP 실패 시 404 {"detail": "not_stored"|"fetch_failed"} */
export async function downloadSample(hash: string): Promise<Blob> {
  if (USE_MOCK) return mock.downloadSample(hash);
  const res = await apiClient.get<Blob>(`/api/sample/samples/${hash}/download`, {
    responseType: 'blob',
    timeout: DOWNLOAD_TIMEOUT_MS,
  });
  return res.data;
}

/** 배치 다운로드 (최대 50개) — AES ZIP 스트림 */
export async function batchDownload(hashes: string[]): Promise<Blob> {
  if (USE_MOCK) return mock.batchDownload(hashes);
  const res = await apiClient.post<Blob>(
    '/api/sample/samples/batch-download',
    { hashes },
    { responseType: 'blob', timeout: DOWNLOAD_TIMEOUT_MS },
  );
  return res.data;
}

/**
 * blob 응답 에러에서 detail 메시지를 추출한다 (다운로드 실패 처리용).
 * axios 가 responseType: 'blob' 이면 에러 body 도 Blob 으로 온다.
 */
export async function extractErrorDetail(error: unknown): Promise<string | null> {
  const response = (error as { response?: { data?: unknown } })?.response;
  if (!response?.data) return null;
  try {
    if (response.data instanceof Blob) {
      const text = await response.data.text();
      return (JSON.parse(text) as { detail?: string }).detail ?? null;
    }
    return (response.data as { detail?: string }).detail ?? null;
  } catch {
    return null;
  }
}
