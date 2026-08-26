import type { ReactNode } from 'react';
import { useThemeStore } from '@common/stores/themeStore';

interface TagBadgeProps {
  children: ReactNode;
  /** tag = 파랑 계열, label = 보라(accent) 계열 */
  variant?: 'tag' | 'label';
  /** 지정 시 클릭 가능 뱃지 (예: 해당 태그로 검색) */
  onClick?: () => void;
  title?: string;
}

/** 태그/라벨 표시용 pill 뱃지 */
export function TagBadge({ children, variant = 'tag', onClick, title }: TagBadgeProps) {
  const { theme, isDarkMode } = useThemeStore();

  // theme.md 의 미토큰 색상 (primary-soft / accent)
  const palette =
    variant === 'tag'
      ? {
          bg: isDarkMode ? '#172554' : '#eff6ff',
          border: isDarkMode ? '#1e40af' : '#bfdbfe',
          text: isDarkMode ? '#93c5fd' : theme.colors.primary,
        }
      : {
          bg: isDarkMode ? 'rgba(79, 70, 229, 0.22)' : 'rgba(79, 70, 229, 0.10)',
          border: isDarkMode ? 'rgba(79, 70, 229, 0.55)' : 'rgba(79, 70, 229, 0.35)',
          text: isDarkMode ? '#a5b4fc' : '#4f46e5',
        };

  return (
    <span
      title={title}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation(); // 행 클릭(상세 열기)과 분리
              onClick();
            }
          : undefined
      }
      style={{
        display: 'inline-block',
        padding: '1px 8px',
        borderRadius: '999px',
        fontSize: theme.fontSize.xs,
        fontWeight: 600,
        lineHeight: '16px',
        backgroundColor: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {children}
    </span>
  );
}
