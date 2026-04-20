import { AppLayout } from '@common/components/AppLayout';
import { useThemeStore } from '@common/stores/themeStore';

export function App() {
  const { theme } = useThemeStore();

  return (
    <AppLayout appName="샘플" sidebarItems={[]} version={__APP_VERSION__}>
      <div
        style={{
          height: '100%',
          minHeight: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: theme.fontSize.xl,
          color: theme.colors.textMuted,
        }}
      >
        아직 서비스 하지 않습니다.
      </div>
    </AppLayout>
  );
}
