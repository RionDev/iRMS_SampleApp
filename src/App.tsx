import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@common/pages/LoginPage';
import { SignupPage } from '@common/pages/SignupPage';
import { AppLayout } from '@common/components/AppLayout';
import { useAuthStore } from '@common/stores/authStore';
import { useThemeStore } from '@common/stores/themeStore';

function RequireAuth({ children }: { children: React.ReactElement }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    window.location.href = '/sample/login?redirect=' + encodeURIComponent(window.location.pathname);
    return null;
  }
  return children;
}

function PlaceholderPage() {
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

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage signupUrl="/sample/signup" defaultRedirect="/sample/" />} />
      <Route path="/signup" element={<SignupPage loginUrl="/sample/login" />} />
      <Route path="/" element={<RequireAuth><PlaceholderPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
