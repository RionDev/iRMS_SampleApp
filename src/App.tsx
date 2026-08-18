import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppCenterMessage } from '@common/components/AppCenterMessage';
import { LoginPage } from '@common/pages/LoginPage';
import { SignupPage } from '@common/pages/SignupPage';
import { useAuthStore } from '@common/stores/authStore';
import { SearchPage } from './pages/SearchPage';
import { DetailPage } from './pages/DetailPage';
import { MultiSearchPage } from './pages/MultiSearchPage';

const StatsPage = lazy(() =>
  import('./pages/StatsPage').then((module) => ({ default: module.StatsPage })),
);

function RequireAuth({ children }: { children: React.ReactElement }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    window.location.href = '/sample/login?redirect=' + encodeURIComponent(window.location.pathname);
    return null;
  }
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage signupUrl="/sample/signup" defaultRedirect="/sample/" />} />
      <Route path="/signup" element={<SignupPage loginUrl="/sample/login" />} />
      <Route path="/" element={<RequireAuth><SearchPage /></RequireAuth>} />
      <Route path="/samples/:hash" element={<RequireAuth><DetailPage /></RequireAuth>} />
      <Route path="/multi" element={<RequireAuth><MultiSearchPage /></RequireAuth>} />
      <Route
        path="/stats"
        element={
          <RequireAuth>
            <Suspense fallback={<AppCenterMessage>통계 화면을 불러오는 중...</AppCenterMessage>}>
              <StatsPage />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
