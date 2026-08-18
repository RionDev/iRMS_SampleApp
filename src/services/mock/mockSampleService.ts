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
  StatsDaily,
  StatsDetectionRatio,
  StatsLocales,
  StatsSummary,
  StatsTopDetections,
  StatsTypes,
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

  const pool = nameOf(FILTER_META.pools, query.pool);
  if (pool && s.pool !== pool) return false;
  const format = nameOf(FILTER_META.formats, query.format);
  if (format && s.format !== format) return false;
  const category = nameOf(FILTER_META.categories, query.category);
  if (category && s.category !== category) return false;
  const locale = nameOf(FILTER_META.locales, query.locale);
  if (locale && s.locale !== locale) return false;
  const source = nameOf(FILTER_META.sources, query.source);
  if (source && s.source !== source) return false;

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

function countsBy(values: Array<string | null>): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const name = value ?? 'Unknown';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return Array.from(counts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count,
  );
}

export async function getStatsSummary(): Promise<StatsSummary> {
  await delay(120);
  const now = Date.now();
  const ratios = SAMPLES.map((s) => s.detect_ratio).filter((v): v is number => v !== null);
  return {
    total_samples: SAMPLES.length,
    last_24h: SAMPLES.filter((s) => now - new Date(s.register_date.replace(' ', 'T')).getTime() <= 86_400_000).length,
    last_7d: SAMPLES.filter((s) => now - new Date(s.register_date.replace(' ', 'T')).getTime() <= 604_800_000).length,
    pools: countsBy(SAMPLES.map((s) => s.pool)),
    avg_detect_ratio: ratios.length
      ? Math.round((ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length) * 100) / 100
      : 0,
  };
}

export async function getDailyStats(days: number): Promise<StatsDaily> {
  await delay(120);
  const counts = new Map<string, number>();
  SAMPLES.forEach((s) => {
    const day = s.register_date.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  });
  const items = Array.from({ length: days }, (_, offset) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - offset));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { date: key, count: counts.get(key) ?? 0 };
  });
  return { days, items };
}

export async function getTypesStats(): Promise<StatsTypes> {
  await delay(120);
  return {
    formats: countsBy(SAMPLES.map((s) => s.format)),
    categories: countsBy(SAMPLES.map((s) => s.category)),
  };
}

export async function getLocalesStats(limit = 10): Promise<StatsLocales> {
  await delay(120);
  return { items: countsBy(SAMPLES.map((s) => s.locale)).slice(0, limit) };
}

export async function getDetectionRatioStats(): Promise<StatsDetectionRatio> {
  await delay(120);
  const counts = Array<number>(10).fill(0);
  SAMPLES.forEach((s) => {
    const ratio = s.detect_ratio ?? 0;
    counts[Math.min(Math.floor(ratio / 10), 9)] += 1;
  });
  return {
    buckets: counts.map((count, i) => ({ range: `${i * 10}-${i * 10 + 10}`, count })),
  };
}

export async function getTopDetections(
  vendorId: number,
  limit = 20,
): Promise<StatsTopDetections> {
  await delay(120);
  const vendor = FILTER_META.vendors.find((option) => option.id === vendorId)?.name;
  const names = SAMPLES.flatMap((s) =>
    s.diagnoses.filter((diagnosis) => !vendor || diagnosis.vendor === vendor).map((d) => d.diagname),
  );
  return {
    vendor_id: vendorId,
    items: countsBy(names).slice(0, limit).map((item, index) => ({ ...item, diag_id: index + 1 })),
  };
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
