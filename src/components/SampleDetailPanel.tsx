import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BaseTable, type TableColumn } from '@common/components/BaseTable';
import { Button } from '@common/components/Button';
import { SearchInput } from '@common/components/SearchInput';
import { useThemeStore } from '@common/stores/themeStore';
import { downloadSample, extractErrorDetail, getSampleDetail } from '../services/sampleService';
import type { SampleDetail, SampleDiagnosis } from '../types/sample';
import { formatDate, formatSizeDetailed, saveBlob } from '../utils/format';
import { CopyButton } from './CopyButton';
import { DetectionDonut } from './DetectionDonut';
import { TagBadge } from './TagBadge';

const DOWNLOAD_ERROR_LABEL: Record<string, string> = {
  not_stored: '보관 중인 샘플이 아니어서 다운로드할 수 없습니다.',
  fetch_failed: '샘플 저장소에서 파일을 가져오지 못했습니다.',
};

function SectionTitle({ children }: { children: ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <div
      style={{
        fontSize: theme.fontSize.sm,
        fontWeight: 700,
        color: theme.colors.textMuted,
        letterSpacing: '0.04em',
        marginBottom: '10px',
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  const { theme } = useThemeStore();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '28px' }}>
      <span
        style={{
          width: '92px',
          flexShrink: 0,
          fontSize: theme.fontSize.sm,
          color: theme.colors.textMuted,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          minWidth: 0,
          fontSize: theme.fontSize.base,
          color: theme.colors.text,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
          wordBreak: 'break-all',
          whiteSpace: 'normal',
        }}
      >
        {children}
      </span>
    </div>
  );
}

function HashRow({ label, value }: { label: string; value: string | null }) {
  const { theme } = useThemeStore();
  if (!value) {
    return (
      <InfoRow label={label}>
        <span style={{ color: theme.colors.textMuted }}>-</span>
      </InfoRow>
    );
  }
  return (
    <InfoRow label={label} mono>
      {value}
      <CopyButton text={value} />
    </InfoRow>
  );
}

const TYPE_FIELD_LABELS: [keyof NonNullable<SampleDetail['type']>, string][] = [
  ['spectype', '세부 타입'],
  ['compiler', '컴파일러'],
  ['linker', '링커'],
  ['library', '라이브러리'],
  ['crypter', '크립터'],
  ['overlay', '오버레이'],
  ['resource', '리소스'],
];

interface SampleDetailPanelProps {
  hash: string;
  onClose: () => void;
}

/**
 * 샘플 상세 패널 — Drawer 내부에서 렌더되는 body-only 컴포넌트 (admin 패턴).
 * 페이지 이동 없이 열리므로 검색 결과/페이지 상태가 유지된다.
 */
export function SampleDetailPanel({ hash, onClose }: SampleDetailPanelProps) {
  const { theme } = useThemeStore();

  const [detail, setDetail] = useState<SampleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [diagFilter, setDiagFilter] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setDetail(null);
    setNotice(null);
    setDiagFilter('');

    getSampleDetail(hash)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setNotFound(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hash]);

  const filteredDiagnoses = useMemo(() => {
    if (!detail) return [];
    const needle = diagFilter.trim().toLowerCase();
    const rows = needle
      ? detail.diagnoses.filter(
          (d) =>
            d.vendor.toLowerCase().includes(needle) ||
            d.diagname.toLowerCase().includes(needle),
        )
      : detail.diagnoses;
    return [...rows].sort((a, b) => a.vendor.localeCompare(b.vendor));
  }, [detail, diagFilter]);

  const diagColumns = useMemo<TableColumn<SampleDiagnosis>[]>(
    () => [
      { key: 'vendor', label: '벤더', cellStyle: { width: '180px' } },
      {
        key: 'diagname',
        label: '진단명',
        cellStyle: { textAlign: 'left' },
        render: (d) => (
          <span style={{ color: theme.colors.danger, fontWeight: 600 }}>{d.diagname}</span>
        ),
      },
    ],
    [theme],
  );

  const handleDownload = async () => {
    if (!detail || !detail.downloadable || downloading) return;
    setDownloading(true);
    setNotice(null);
    try {
      const blob = await downloadSample(detail.sha256 ?? detail.md5);
      saveBlob(blob, `${detail.sha256 ?? detail.md5}.bin`);
    } catch (error) {
      const detailMsg = await extractErrorDetail(error);
      setNotice(
        (detailMsg && DOWNLOAD_ERROR_LABEL[detailMsg]) ?? '다운로드에 실패했습니다.',
      );
    } finally {
      setDownloading(false);
    }
  };

  const centerStyle = {
    padding: '48px 0',
    textAlign: 'center' as const,
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.base,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 24px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: theme.fontSize.lg, fontWeight: 700, color: theme.colors.text }}>
          샘플 상세
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {notice && (
            <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.danger }}>
              {notice}
            </span>
          )}
          {detail && (
            <Button
              onClick={handleDownload}
              disabled={!detail.downloadable || downloading}
              title={
                detail.downloadable
                  ? '샘플 파일 다운로드'
                  : '보관 중인 샘플이 아니어서 다운로드할 수 없습니다.'
              }
            >
              {downloading ? '다운로드 중...' : '다운로드'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>

      {loading && <div style={centerStyle}>로딩 중...</div>}
      {!loading && notFound && <div style={centerStyle}>샘플을 찾을 수 없습니다.</div>}

      {!loading && detail && (
        <>
          {/* 진단 요약 + 핵심 정보 */}
          <div style={{ display: 'flex', gap: '24px' }}>
            <DetectionDonut
              detectCount={detail.detect_count ?? 0}
              totalCount={detail.total_count ?? 0}
              size={132}
            />
            <div
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
              <HashRow label="SHA256" value={detail.sha256} />
              <HashRow label="MD5" value={detail.md5} />
              <HashRow label="SSDEEP" value={detail.ssdeep} />
              <InfoRow label="크기">{formatSizeDetailed(detail.file_size)}</InfoRow>
              <InfoRow label="포맷 / 분류">
                {detail.format ?? '-'} · {detail.category ?? '-'}
              </InfoRow>
              <InfoRow label="풀 / 로케일">
                {detail.pool ?? '-'} · {detail.locale ?? '-'}
              </InfoRow>
              <InfoRow label="수집 소스">{detail.source ?? '-'}</InfoRow>
              <InfoRow label="등록일">{formatDate(detail.register_date)}</InfoRow>
              <InfoRow label="보관 상태">{detail.storage_status ?? '-'}</InfoRow>
            </div>
          </div>

          {/* 파일 타입 상세 + 태그/라벨 */}
          <div
            style={{
              borderTop: `1px solid ${theme.colors.border}`,
              paddingTop: '16px',
              display: 'flex',
              gap: '32px',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <SectionTitle>파일 타입 상세</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {TYPE_FIELD_LABELS.map(([field, label]) => (
                  <InfoRow key={field} label={label}>
                    {detail.type?.[field] ?? (
                      <span style={{ color: theme.colors.textMuted }}>-</span>
                    )}
                  </InfoRow>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SectionTitle>태그 / 라벨</SectionTitle>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {detail.tags.map((tag) => (
                  <TagBadge key={`t-${tag}`}>{tag}</TagBadge>
                ))}
                {detail.labels.map((label) => (
                  <TagBadge key={`l-${label}`} variant="label">
                    {label}
                  </TagBadge>
                ))}
                {detail.tags.length === 0 && detail.labels.length === 0 && (
                  <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
                    태그/라벨 없음
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 벤더별 진단명 */}
          <div style={{ borderTop: `1px solid ${theme.colors.border}`, paddingTop: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <SectionTitle>벤더별 진단명 ({detail.diagnoses.length}개 벤더 진단)</SectionTitle>
              <SearchInput
                value={diagFilter}
                onChange={(e) => setDiagFilter(e.target.value)}
                placeholder="벤더/진단명 필터"
                style={{ width: '220px' }}
              />
            </div>
            {filteredDiagnoses.length > 0 ? (
              <BaseTable
                items={filteredDiagnoses}
                columns={diagColumns}
                rowKey={(d) => `${d.vendor}-${d.diagname}`}
              />
            ) : (
              <div style={centerStyle}>
                {detail.diagnoses.length === 0
                  ? '진단한 벤더가 없습니다.'
                  : '필터와 일치하는 진단이 없습니다.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
