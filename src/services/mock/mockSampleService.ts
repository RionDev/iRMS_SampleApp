// sampleService 의 mock 구현 — BE cursor+snapshot_idx 페이지네이션 규약을 그대로 흉내낸다.
// (common/docs/pagination.md 참조. BE 가 뜨면 VITE_USE_MOCK 을 꺼서 우회한다.)

import type { Page } from '@common/types/pagination';
import type {
  FilterMeta,
  FilterOption,
  MultiSearchResult,
  SampleDetail,
  SampleSearchQuery,
  SampleSummary,
} from '../../types/sample';
import { detectHashType } from '../../utils/hash';
import { FILTER_META, SAMPLES, SAMPLES_BY_HASH } from './mockDb';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** axios 에러와 동일한 모양으로 HTTP 에러를 흉내낸다 */
function httpError(status: number, detail: string): Error {
  const err = new Error(detail) as Error & {
    isAxiosError: boolean;
    response: { status: number; data: { detail: string } };
  };
  err.isAxiosError = true;
  err.response = { status, data: { detail } };
  return err;
}

function nameOf(options: FilterOption[], id: number | undefined): string | undefined {
  if (id === undefined) return undefined;
  return options.find((o) => o.id === id)?.name;
}

function toSummary(s: SampleDetail): SampleSummary {
  const { labels, type, ssdeep, diagnoses, downloadable, ...summary } = s;
  void labels; void type; void ssdeep; void diagnoses; void downloadable;
  return summary;
}

function encodeCursor(idx: number): string {
  return btoa(JSON.stringify({ idx }));
}

function decodeCursor(cursor: string): number {
  try {
    const parsed = JSON.parse(atob(cursor)) as { idx: number };
    return parsed.idx;
  } catch {
    throw httpError(400, 'invalid cursor');
  }
}

function matchesQuery(s: SampleDetail, query: SampleSearchQuery): boolean {
  const q = query.q?.trim();
  if (q) {
    const hashType = detectHashType(q);
    if (hashType) {
      const target = q.toLowerCase();
      if (s.sha256 !== target && s.md5 !== target) return false;
    } else {
      const needle = q.toLowerCase();
      const mode = query.match ?? 'prefix';
      const hit = s.diagnoses.some((d) =>
        mode === 'prefix'
          ? d.diagname.toLowerCase().startsWith(needle)
          : d.diagname.toLowerCase().includes(needle),
      );
      if (!hit) return false;
    }
  }

  // 단일 lookup 필터 — 반복 지정 시 OR (BE in_ 검색과 동일)
  const inNames = (options: FilterOption[], ids: number[] | undefined, actual: string | null) => {
    if (!ids || ids.length === 0) return true;
    const names = ids.map((id) => nameOf(options, id)).filter(Boolean);
    return actual !== null && names.includes(actual);
  };
  if (!inNames(FILTER_META.pools, query.pool, s.pool)) return false;
  if (!inNames(FILTER_META.formats, query.format, s.format)) return false;
  if (!inNames(FILTER_META.categories, query.category, s.category)) return false;
  if (!inNames(FILTER_META.locales, query.locale, s.locale)) return false;
  if (!inNames(FILTER_META.sources, query.source, s.source)) return false;

  for (const tagId of query.tag ?? []) {
    const tag = nameOf(FILTER_META.tags, tagId);
    if (tag && !s.tags.includes(tag)) return false;
  }
  for (const labelId of query.label ?? []) {
    const label = nameOf(FILTER_META.labels, labelId);
    if (label && !s.labels.includes(label)) return false;
  }

  if (query.ratio_min !== undefined && (s.detect_ratio ?? -1) < query.ratio_min) return false;
  if (query.ratio_max !== undefined && (s.detect_ratio ?? 101) > query.ratio_max) return false;

  const date = s.register_date.substring(0, 10);
  if (query.date_from && date < query.date_from) return false;
  if (query.date_to && date > query.date_to) return false;

  return true;
}

export async function getSamples(
  query: SampleSearchQuery,
  cursor?: string,
  snapshotIdx?: number,
  size: number = 50,
): Promise<Page<SampleSummary>> {
  await delay(200);

  // snapshot 상한 고정 → total 이 페이지 이동 중 불변
  const snapshot = snapshotIdx ?? Math.max(...SAMPLES.map((s) => s.id), 0);
  const matched = SAMPLES.filter((s) => s.id <= snapshot && matchesQuery(s, query)).sort(
    (a, b) => b.id - a.id,
  );

  const afterIdx = cursor !== undefined ? decodeCursor(cursor) : Infinity;
  const startIdx = matched.findIndex((s) => s.id < afterIdx);
  const pageItems = startIdx === -1 ? [] : matched.slice(startIdx, startIdx + size);
  const hasMore = startIdx !== -1 && startIdx + size < matched.length;

  return {
    items: pageItems.map(toSummary),
    next_cursor: hasMore ? encodeCursor(pageItems[pageItems.length - 1].id) : null,
    has_more: hasMore,
    total: matched.length,
    snapshot_idx: snapshot,
  };
}

export async function getSampleDetail(hash: string): Promise<SampleDetail> {
  await delay(150);
  if (!detectHashType(hash)) throw httpError(400, 'invalid hash');
  const sample = SAMPLES_BY_HASH.get(hash.toLowerCase());
  if (!sample) throw httpError(404, 'not found');
  return sample;
}

export async function multiSearch(hashes: string[]): Promise<MultiSearchResult> {
  await delay(300);
  const matched: SampleSummary[] = [];
  const unmatched: string[] = [];
  for (const hash of hashes) {
    const sample = SAMPLES_BY_HASH.get(hash.toLowerCase());
    if (sample) matched.push(toSummary(sample));
    else unmatched.push(hash);
  }
  return { matched, unmatched };
}

export async function getFilterMeta(): Promise<FilterMeta> {
  await delay(100);
  return FILTER_META;
}

export async function downloadSample(hash: string): Promise<Blob> {
  await delay(400);
  const sample = SAMPLES_BY_HASH.get(hash.toLowerCase());
  if (!sample) throw httpError(404, 'not found');
  if (!sample.downloadable) throw httpError(404, 'not_stored');
  return new Blob([`mock sample binary: ${sample.sha256 ?? sample.md5}\n`], {
    type: 'application/octet-stream',
  });
}

export async function batchDownload(hashes: string[]): Promise<Blob> {
  await delay(600);
  // mock 은 실제 AES ZIP 이 아니라 매니페스트 텍스트를 담는다.
  const lines = ['mock batch download (실제 BE 는 AES ZIP 을 반환)', ...hashes];
  return new Blob([lines.join('\n')], { type: 'application/zip' });
}
