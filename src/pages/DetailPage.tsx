import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppCenterMessage } from '@common/components/AppCenterMessage';
import { AppLayout } from '@common/components/AppLayout';
import { BaseTable, type TableColumn } from '@common/components/BaseTable';
import { Button } from '@common/components/Button';
import { SearchInput } from '@common/components/SearchInput';
import { useAppAccess } from '@common/hooks/useAuth';
import { useThemeStore } from '@common/stores/themeStore';
import { CopyButton } from '../components/CopyButton';
import { DetectionDonut } from '../components/DetectionDonut';
import { TagBadge } from '../components/TagBadge';
import { sampleNavItems } from '../navigation';
import { downloadSample, extractErrorDetail, getSampleDetail } from '../services/sampleService';
import type { SampleDetail, SampleDiagnosis } from '../types/sample';
import { formatDate, formatSizeDetailed, saveBlob } from '../utils/format';
import { isHash } from '../utils/hash';

const DOWNLOAD_ERROR_LABEL: Record<string, string> = {
  not_stored: '보관 중인 샘플이 아니어서 다운로드할 수 없습니다.',
  fetch_failed: '샘플 저장소에서 파일을 가져오지 못했습니다.',
};

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const { theme } = useThemeStore();
  return (
    <div
      style={{
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        boxShadow: theme.shadow.card,
        padding: '20px 24px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

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

export function DetailPage() {
  useAppAccess('/sample');
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
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

    if (!hash || !isHash(hash)) {
      setLoading(false);
      setNotFound(true);
      return undefined;
    }

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

  return (
    <AppLayout
      title="샘플 상세"
      appName="샘플"
      sidebarItems={sampleNavItems}
      version={__APP_VERSION__}
      contentMaxWidth="1700px"
    >
      {loading && <AppCenterMessage>로딩 중...</AppCenterMessage>}
      {!loading && notFound && (
        <AppCenterMessage>
          샘플을 찾을 수 없습니다.
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Button variant="secondary" onClick={() => navigate('/')}>
              검색으로 돌아가기
            </Button>
          </div>
        </AppCenterMessage>
      )}
      {!loading && detail && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch' }}>
            <Card style={{ flex: 2, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                <DetectionDonut
                  detectCount={detail.detect_count ?? 0}
                  totalCount={detail.total_count ?? 0}
                  size={132}
                />
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
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
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    alignItems: 'stretch',
                    flexShrink: 0,
                  }}
                >
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
                  <Button variant="secondary" onClick={() => navigate(-1)}>
                    뒤로
                  </Button>
                  {notice && (
                    <span
                      style={{
                        maxWidth: '180px',
                        fontSize: theme.fontSize.sm,
                        color: theme.colors.danger,
                        whiteSpace: 'normal',
                      }}
                    >
                      {notice}
                    </span>
                  )}
                </div>
              </div>
            </Card>
            <Card style={{ flex: 1, minWidth: '300px' }}>
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
              <div style={{ marginTop: '16px' }}>
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
            </Card>
          </div>
          <Card>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <SectionTitle>
                벤더별 진단명 ({detail.diagnoses.length}개 벤더 진단)
              </SectionTitle>
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
              <div
                style={{
                  padding: '24px 0',
                  textAlign: 'center',
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSize.base,
                }}
              >
                {detail.diagnoses.length === 0
                  ? '진단한 벤더가 없습니다.'
                  : '필터와 일치하는 진단이 없습니다.'}
              </div>
            )}
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
