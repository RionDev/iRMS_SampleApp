import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@common/components/AppLayout';
import { Button } from '@common/components/Button';
import { useAppAccess } from '@common/hooks/useAuth';
import { useThemeStore } from '@common/stores/themeStore';
import { CopyButton } from '../components/CopyButton';
import { SampleTable, sampleKey } from '../components/SampleTable';
import { sampleNavItems } from '../navigation';
import { batchDownload, extractErrorDetail, multiSearch } from '../services/sampleService';
import {
  BATCH_DOWNLOAD_MAX,
  BATCH_ZIP_PASSWORD,
  MULTI_SEARCH_MAX,
  type MultiSearchResult,
  type SampleSummary,
} from '../types/sample';
import { saveBlob } from '../utils/format';
import { parseHashList } from '../utils/hash';

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

export function MultiSearchPage() {
  useAppAccess('/sample');
  const navigate = useNavigate();
  const { theme, isDarkMode } = useThemeStore();

  const [text, setText] = useState('');
  const [result, setResult] = useState<MultiSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const parsed = useMemo(() => parseHashList(text), [text]);
  const overLimit = parsed.valid.length > MULTI_SEARCH_MAX;

  const handleSearch = async () => {
    if (parsed.valid.length === 0 || overLimit || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setDownloadNotice(null);
    try {
      setResult(await multiSearch(parsed.valid));
    } catch {
      setError('멀티 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setText('');
    setResult(null);
    setError(null);
    setSelected(new Set());
    setDownloadNotice(null);
  };

  const toggle = (sample: SampleSummary) => {
    const key = sampleKey(sample);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= BATCH_DOWNLOAD_MAX) {
          setDownloadNotice(`배치 다운로드는 최대 ${BATCH_DOWNLOAD_MAX}개까지 선택할 수 있습니다.`);
          return prev;
        }
        next.add(key);
      }
      return next;
    });
  };

  const matched = result?.matched ?? [];
  const allSelected =
    matched.length > 0 &&
    matched.slice(0, BATCH_DOWNLOAD_MAX).every((s) => selected.has(sampleKey(s)));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    if (matched.length > BATCH_DOWNLOAD_MAX) {
      setDownloadNotice(
        `배치 다운로드 한도(${BATCH_DOWNLOAD_MAX}개)까지만 선택했습니다.`,
      );
    }
    setSelected(new Set(matched.slice(0, BATCH_DOWNLOAD_MAX).map(sampleKey)));
  };

  const handleBatchDownload = async () => {
    if (selected.size === 0 || downloading) return;
    setDownloading(true);
    setDownloadNotice(null);
    try {
      const blob = await batchDownload(Array.from(selected));
      saveBlob(blob, 'samples.zip');
    } catch (err) {
      const detail = await extractErrorDetail(err);
      setDownloadNotice(detail ?? '배치 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  const countStyle = (color: string): CSSProperties => ({
    color,
    fontWeight: 700,
  });

  return (
    <AppLayout
      title="멀티 검색"
      appName="샘플"
      sidebarItems={sampleNavItems}
      version={__APP_VERSION__}
      contentMaxWidth="1700px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Card>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={`SHA256/MD5 해시를 개행·쉼표·공백으로 구분해 입력 (최대 ${MULTI_SEARCH_MAX}개)`}
            spellCheck={false}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: isDarkMode ? theme.colors.pageBackground : theme.colors.surface,
              color: theme.colors.text,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: theme.fontSize.sm,
              resize: 'vertical',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '10px',
            }}
          >
            <span style={{ fontSize: theme.fontSize.base, color: theme.colors.textMuted }}>
              유효 해시{' '}
              <span style={countStyle(overLimit ? theme.colors.danger : theme.colors.primary)}>
                {parsed.valid.length.toLocaleString()}
              </span>
              {' / '}최대 {MULTI_SEARCH_MAX}
              {parsed.invalid.length > 0 && (
                <>
                  {' · '}무시된 토큰{' '}
                  <span style={countStyle(theme.colors.warning)}>{parsed.invalid.length}</span>
                </>
              )}
            </span>
            {overLimit && (
              <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.danger }}>
                해시가 {MULTI_SEARCH_MAX}개를 초과했습니다. 나눠서 검색해 주세요.
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <Button onClick={handleSearch} disabled={parsed.valid.length === 0 || overLimit || loading}>
                {loading ? '검색 중...' : '검색'}
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                초기화
              </Button>
            </div>
          </div>
          {error && (
            <div style={{ marginTop: '8px', fontSize: theme.fontSize.base, color: theme.colors.danger }}>
              {error}
            </div>
          )}
        </Card>

        {result && (
          <>
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: theme.fontSize.lg, fontWeight: 700, color: theme.colors.text }}>
                  일치{' '}
                  <span style={countStyle(theme.colors.success)}>
                    {result.matched.length.toLocaleString()}
                  </span>
                  {' · '}불일치{' '}
                  <span style={countStyle(theme.colors.danger)}>
                    {result.unmatched.length.toLocaleString()}
                  </span>
                </span>
                <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>
                  선택 {selected.size}/{BATCH_DOWNLOAD_MAX}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.warning, fontWeight: 600 }}>
                    다운로드 ZIP 비밀번호: {BATCH_ZIP_PASSWORD}
                  </span>
                  <Button onClick={handleBatchDownload} disabled={selected.size === 0 || downloading}>
                    {downloading ? '다운로드 중...' : `선택 샘플 다운로드 (ZIP)`}
                  </Button>
                </div>
              </div>
              {downloadNotice && (
                <div style={{ marginBottom: '8px', fontSize: theme.fontSize.sm, color: theme.colors.danger }}>
                  {downloadNotice}
                </div>
              )}
              {matched.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <SampleTable
                    items={matched}
                    onSelect={(s) => navigate(`/samples/${sampleKey(s)}`)}
                    selection={{ selected, onToggle: toggle, onToggleAll: toggleAll, allSelected }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    padding: '24px 0',
                    textAlign: 'center',
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  일치하는 샘플이 없습니다.
                </div>
              )}
            </Card>

            {result.unmatched.length > 0 && (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ fontSize: theme.fontSize.base, fontWeight: 700, color: theme.colors.text }}>
                    불일치 해시 ({result.unmatched.length.toLocaleString()})
                  </span>
                  <CopyButton text={result.unmatched.join('\n')} title="불일치 해시 전체 복사" />
                </div>
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    padding: '10px 12px',
                    borderRadius: theme.radius.sm,
                    backgroundColor: isDarkMode ? theme.colors.pageBackground : theme.colors.surfaceMuted,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: theme.fontSize.sm,
                    color: theme.colors.textMuted,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {result.unmatched.join('\n')}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
