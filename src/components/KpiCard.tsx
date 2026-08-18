import type { ReactNode } from 'react';
import { useThemeStore } from '@common/stores/themeStore';

export function KpiCard({
  label,
  value,
  sub,
  accentColor,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accentColor?: string;
}) {
  const { theme } = useThemeStore();
  return (
    <div
      style={{
        flex: 1,
        minWidth: '160px',
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        boxShadow: theme.shadow.card,
        padding: '16px 20px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted, fontWeight: 600 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '26px',
          fontWeight: 800,
          lineHeight: 1.1,
          color: accentColor ?? theme.colors.text,
        }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: theme.fontSize.sm, color: theme.colors.textMuted }}>{sub}</span>}
    </div>
  );
}
