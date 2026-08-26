import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@common/components/Button';
import { useThemeStore } from '@common/stores/themeStore';
import { downloadSample, extractErrorDetail, getSampleDetail } from '../services/sampleService';
import type { SampleDetail } from '../types/sample';
import { formatDate, formatSizeDetailed, saveBlob, storageStatusLabel } from '../utils/format';
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

function InfoRow({
  label,
  children,
  mono,
  nowrap,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  /** 값을 한 줄로 유지하고 넘치면 가로 스크롤 (해시 등) */
  nowrap?: boolean;
}) {
  const { theme, isDarkMode } = useThemeStore();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: '30px',
        padding: '3px 10px',
        borderRadius: theme.radius.sm,
        backgroundColor: isDarkMode ? theme.colors.pageBackground : theme.colors.surfaceMuted,
      }}
    >
      <span
        style={{
          width: '72px',
          flexShrink: 0,
          fontSize: theme.fontSize.sm,
          fontWeight: 700,
          color: theme.colors.text,
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
          wordBreak: nowrap ? 'normal' : 'break-all',
          whiteSpace: nowrap ? 'nowrap' : 'normal',
          overflowX: nowrap ? 'auto' : undefined,
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
    <InfoRow label={label} mono nowrap>
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
  /** 전체 벤더명 (meta/filters) — 미진단 벤더까지 진단명 표에 노출하기 위함 */
  vendorNames: string[];
  onClose: () => void;
}

/**
 * 샘플 상세 패널 — Drawer 내부에서 렌더되는 body-only 컴포넌트 (admin 패턴).
 * 페이지 이동 없이 열리므로 검색 결과/페이지 상태가 유지된다.
 */
export function SampleDetailPanel({ hash, vendorNames, onClose }: SampleDetailPanelProps) {
  const { theme, isDarkMode } = useThemeStore();

  const [detail, setDetail] = useState<SampleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setDetail(null);
    setNotice(null);

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

  // 전체 벤더(meta) + 진단명 있는 벤더 합집합 — 미진단 벤더도 노출한다
  const vendorRows = useMemo(() => {
    const diagByVendor = new Map(detail?.diagnoses.map((d) => [d.vendor, d.diagname]) ?? []);
    const all = new Set<string>(vendorNames);
    diagByVendor.forEach((_, vendor) => all.add(vendor));
    return [...all]
      .sort((a, b) => a.localeCompare(b))
      .map((vendor) => ({ vendor, diagname: diagByVendor.get(vendor) ?? null }));
  }, [detail, vendorNames]);

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
            {/* 왼쪽: 도넛 + 태그/라벨 */}
            <div
              style={{
                flexShrink: 0,
                width: '180px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <DetectionDonut
                detectCount={detail.detect_count ?? 0}
                totalCount={detail.total_count ?? 0}
                size={168}
              />
              <div style={{ width: '100%' }}>
                <SectionTitle>태그 / 라벨</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* 태그 한 줄 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {detail.tags.length > 0 ? (
                      detail.tags.map((tag) => (
                        <TagBadge key={`t-${tag}`} size="md">
                          {tag}
                        </TagBadge>
                      ))
                    ) : (
                      <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
                        태그 없음
                      </span>
                    )}
                  </div>
                  {/* 라벨 한 줄 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {detail.labels.length > 0 ? (
                      detail.labels.map((label) => (
                        <TagBadge key={`l-${label}`} variant="label" size="md">
                          {label}
                        </TagBadge>
                      ))
                    ) : (
                      <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
                        라벨 없음
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* 오른쪽: 해시(전체폭) + 정보 2열 그리드 */}
            <div
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              <HashRow label="SHA256" value={detail.sha256} />
              <HashRow label="MD5" value={detail.md5} />
              <HashRow label="SSDEEP" value={detail.ssdeep} />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                }}
              >
                <InfoRow label="크기">{formatSizeDetailed(detail.file_size)}</InfoRow>
                <InfoRow label="포맷 / 분류">
                  {detail.format ?? '-'} · {detail.category ?? '-'}
                </InfoRow>
                <InfoRow label="풀">{detail.pool ?? '-'}</InfoRow>
                <InfoRow label="로케일">{detail.locale ?? '-'}</InfoRow>
                <InfoRow label="수집 소스">{detail.source ?? '-'}</InfoRow>
                <InfoRow label="등록일">{formatDate(detail.register_date)}</InfoRow>
                <InfoRow label="보관 상태">{storageStatusLabel(detail.storage_status)}</InfoRow>
              </div>
            </div>
          </div>

          {/* 파일 타입 상세 */}
          <div
            style={{
              borderTop: `1px solid ${theme.colors.border}`,
              paddingTop: '16px',
            }}
          >
            <SectionTitle>파일 타입 상세</SectionTitle>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px',
              }}
            >
              {TYPE_FIELD_LABELS.map(([field, label]) => (
                <InfoRow key={field} label={label}>
                  {detail.type?.[field] ?? (
                    <span style={{ color: theme.colors.textMuted }}>-</span>
                  )}
                </InfoRow>
              ))}
            </div>
          </div>

          {/* 벤더별 진단명 — 전체 벤더 2열 (미진단 포함) */}
          <div style={{ borderTop: `1px solid ${theme.colors.border}`, paddingTop: '16px' }}>
            <SectionTitle>
              벤더별 진단명 ({detail.diagnoses.length}/{vendorRows.length} 진단)
            </SectionTitle>
            {vendorRows.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                {vendorRows.map(({ vendor, diagname }) => (
                  <div
                    key={vendor}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      minHeight: '30px',
                      padding: '3px 10px',
                      borderRadius: theme.radius.sm,
                      backgroundColor: isDarkMode
                        ? theme.colors.pageBackground
                        : theme.colors.surfaceMuted,
                    }}
                  >
                    <span
                      style={{
                        width: '110px',
                        flexShrink: 0,
                        fontSize: theme.fontSize.sm,
                        fontWeight: 700,
                        color: theme.colors.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={vendor}
                    >
                      {vendor}
                    </span>
                    <span
                      style={{
                        minWidth: 0,
                        fontSize: theme.fontSize.base,
                        fontWeight: diagname ? 600 : 400,
                        color: diagname ? theme.colors.danger : theme.colors.textMuted,
                        wordBreak: 'break-all',
                      }}
                    >
                      {diagname ?? '미진단'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={centerStyle}>벤더 정보가 없습니다.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
