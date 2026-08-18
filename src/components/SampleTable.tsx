import { useMemo } from 'react';
import { BaseTable, type TableColumn } from '@common/components/BaseTable';
import { useThemeStore } from '@common/stores/themeStore';
import type { SampleSummary } from '../types/sample';
import { detectionColor, formatDate, formatSize } from '../utils/format';
import { CopyButton } from './CopyButton';
import { TagBadge } from './TagBadge';

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
}

export function sampleKey(sample: SampleSummary): string {
  return sample.sha256 ?? sample.md5;
}

const MAX_VISIBLE_TAGS = 2;

export function SampleTable({ items, onSelect, selection }: SampleTableProps) {
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
        label: 'SHA256',
        cellStyle: { textAlign: 'left' },
        render: (s) => {
          const hash = sampleKey(s);
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span
                title={hash}
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: theme.fontSize.sm,
                }}
              >
                {s.sha256 ? `${s.sha256.slice(0, 16)}…` : `(md5) ${s.md5.slice(0, 16)}…`}
              </span>
              <CopyButton text={hash} />
            </span>
          );
        },
      },
      { key: 'size', label: '크기', render: (s) => formatSize(s.file_size) },
      { key: 'format', label: '포맷' },
      { key: 'category', label: '카테고리' },
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
      { key: 'pool', label: '풀' },
      { key: 'locale', label: '로케일' },
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
                <TagBadge key={tag}>{tag}</TagBadge>
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
  }, [theme, selection]);

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
