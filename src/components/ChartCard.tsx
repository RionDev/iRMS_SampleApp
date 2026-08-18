import type { CSSProperties, ReactNode } from 'react';
import { useThemeStore } from '@common/stores/themeStore';

export function ChartCard({
  title,
  controls,
  children,
  style,
}: {
  title: string;
  controls?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { theme } = useThemeStore();
  return (
    <div
      style={{
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        boxShadow: theme.shadow.card,
        padding: '16px 20px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: theme.fontSize.base, fontWeight: 700, color: theme.colors.text }}>
          {title}
        </span>
        {controls}
      </div>
      {children}
    </div>
  );
}

export function ChartState({ height, children }: { height: number; children: ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <div
      style={{
        height: `${height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.colors.textMuted,
        fontSize: theme.fontSize.base,
      }}
    >
      {children}
    </div>
  );
}
