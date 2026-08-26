import { useMemo } from 'react';
import { BaseTable, type TableColumn } from '@common/components/BaseTable';
import { useThemeStore } from '@common/stores/themeStore';
import type { SampleSummary } from '../types/sample';
import { detectionColor, flagEmoji, formatDate, formatSize } from '../utils/format';
import { CopyButton } from './CopyButton';
import { TagBadge } from './TagBadge';

/** 풀 표시 색 — 이름 기반 (Black/Gray 외 값은 텍스트 fallback) */
const POOL_COLORS: Record<string, string> = {
  black: '#18181b',
  gray: '#9ca3af',
};

/** 체크박스 선택 지원 (멀티 검색 배치 다운로드용) */
export interface SampleSelection {
  /** 선택 키: sha256 ?? md5 */
  selected: Set<string>;
  onToggle: (sample: SampleSummary) => void;
  onToggleAll: () => void;
  allSelected: boolean;
}

interface SampleTableProps {
  items: SampleSummary[];
  onSelect?: (sample: SampleSummary) => void;
  selection?: SampleSelection;
  /** 로케일 국명 → 알파-2 코드 (meta/filters 기반) — 국기 표시에 사용 */
  localeCodes?: Map<string, string>;
  /** 태그 뱃지 클릭 → 해당 태그로 검색 */
  onTagClick?: (tag: string) => void;
}

export function sampleKey(sample: SampleSummary): string {
  return sample.sha256 ?? sample.md5;
}

const MAX_VISIBLE_TAGS = 2;

export function SampleTable({
  items,
  onSelect,
  selection,
  localeCodes,
  onTagClick,
}: SampleTableProps) {
  const { theme } = useThemeStore();

  const columns = useMemo<TableColumn<SampleSummary>[]>(() => {
    const cols: TableColumn<SampleSummary>[] = [];

    if (selection) {
      cols.push({
        key: 'select',
        label: '',
        cellStyle: { width: '36px', padding: '0 8px' },
        render: (s) => (
          <input
            type="checkbox"
            checked={selection.selected.has(sampleKey(s))}
            onChange={() => selection.onToggle(s)}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'pointer' }}
          />
        ),
      });
    }

    cols.push(
      {
        key: 'hash',
        label: 'MD5',
        cellStyle: { textAlign: 'left', width: '280px' },
        render: (s) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span
              title={s.sha256 ? `SHA256: ${s.sha256}` : undefined}
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: theme.fontSize.sm,
                whiteSpace: 'nowrap',
              }}
            >
              {s.md5}
            </span>
            <CopyButton text={s.md5} />
          </span>
        ),
      },
      { key: 'size', label: '크기', render: (s) => formatSize(s.file_size) },
      { key: 'format', label: '포맷' },
      { key: 'category', label: '카테고리' },
      {
        key: 'spectype',
        label: '세부 타입',
        cellStyle: { textAlign: 'left' },
        render: (s) =>
          s.spectype ?? <span style={{ color: theme.colors.textMuted }}>-</span>,
      },
      {
        key: 'detections',
        label: '진단',
        render: (s) => (
          <span style={{ color: detectionColor(theme, s.detect_count, s.total_count), fontWeight: 700 }}>
            {s.detect_count ?? '-'}/{s.total_count ?? '-'}
          </span>
        ),
      },
      {
        key: 'ratio',
        label: '진단율',
        render: (s) => (
          <span style={{ color: detectionColor(theme, s.detect_count, s.total_count), fontWeight: 600 }}>
            {s.detect_ratio === null ? '-' : `${s.detect_ratio}%`}
          </span>
        ),
      },
      {
        key: 'pool',
        label: '풀',
        cellStyle: { width: '44px' },
        render: (s) => {
          if (!s.pool) return <span style={{ color: theme.colors.textMuted }}>-</span>;
          const color = POOL_COLORS[s.pool.toLowerCase()];
          if (!color) return s.pool;
          return (
            <span
              title={s.pool}
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: color,
                border: `1px solid ${theme.colors.border}`,
                verticalAlign: 'middle',
              }}
            />
          );
        },
      },
      {
        key: 'locale',
        label: '로케일',
        cellStyle: { width: '56px' },
        render: (s) => {
          if (!s.locale) return <span style={{ color: theme.colors.textMuted }}>-</span>;
          const code = localeCodes?.get(s.locale) ?? s.locale;
          const flag = flagEmoji(code);
          if (flag) {
            return (
              <span title={`${s.locale} (${code.toUpperCase()})`} style={{ fontSize: '18px' }}>
                {flag}
              </span>
            );
          }
          // 코드가 없거나 '??'(Unknown) — 툴팁으로 국명 유지
          return (
            <span title={s.locale} style={{ color: theme.colors.textMuted }}>
              {/^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : '-'}
            </span>
          );
        },
      },
      {
        key: 'tags',
        label: '태그',
        render: (s) => {
          if (s.tags.length === 0) {
            return <span style={{ color: theme.colors.textMuted }}>-</span>;
          }
          const visible = s.tags.slice(0, MAX_VISIBLE_TAGS);
          const rest = s.tags.length - visible.length;
          return (
            <span
              title={s.tags.join(', ')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              {visible.map((tag) => (
                <TagBadge
                  key={tag}
                  onClick={onTagClick ? () => onTagClick(tag) : undefined}
                  title={onTagClick ? `"${tag}" 태그로 검색` : undefined}
                >
                  {tag}
                </TagBadge>
              ))}
              {rest > 0 && (
                <span style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.xs }}>
                  +{rest}
                </span>
              )}
            </span>
          );
        },
      },
      { key: 'register_date', label: '등록일', render: (s) => formatDate(s.register_date) },
    );

    return cols;
  }, [theme, selection, localeCodes, onTagClick]);

  return (
    <>
      {selection && items.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 8px 8px',
            fontSize: theme.fontSize.sm,
            color: theme.colors.textMuted,
          }}
        >
          <input
            type="checkbox"
            checked={selection.allSelected}
            onChange={selection.onToggleAll}
            style={{ cursor: 'pointer' }}
          />
          전체 선택/해제
        </div>
      )}
      <BaseTable
        items={items}
        columns={columns}
        onRowClick={onSelect}
        rowKey={(s) => s.id}
      />
    </>
  );
}
