import { useThemeStore } from '@common/stores/themeStore';
import { detectionColor } from '../utils/format';

interface DetectionDonutProps {
  detectCount: number;
  totalCount: number;
  size?: number;
}

/** 진단율 게이지 — detect/total 비율 단일 아크 도넛 (색상 규칙은 detectionColor 공통) */
export function DetectionDonut({ detectCount, totalCount, size = 120 }: DetectionDonutProps) {
  const { theme } = useThemeStore();

  const radius = 40;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;
  const ratio = totalCount > 0 ? detectCount / totalCount : 0;
  const arcLength = ratio * circumference;
  const color = detectionColor(theme, detectCount, totalCount);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        viewBox="0 0 100 100"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          transform: 'rotate(-90deg)',
        }}
      >
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke={theme.colors.surfaceMuted}
          strokeWidth={strokeWidth}
        />
        {ratio > 0 && (
          <circle
            cx={50}
            cy={50}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: size * 0.17, fontWeight: 800, color, lineHeight: 1 }}>
          {detectCount}/{totalCount}
        </span>
        <span
          style={{
            fontSize: theme.fontSize.xs,
            color: theme.colors.textMuted,
            marginTop: '4px',
          }}
        >
          진단율 {totalCount > 0 ? Math.round((detectCount / totalCount) * 100) : 0}%
        </span>
      </div>
    </div>
  );
}
