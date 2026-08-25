import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@common/pages/LoginPage';
import { SignupPage } from '@common/pages/SignupPage';
import { useAuthStore } from '@common/stores/authStore';
import { SearchPage } from './pages/SearchPage';

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
      {/* 샘플 상세는 라우트 없이 검색 화면의 오버레이 드로어로 처리 (admin 패턴) */}
      {/* 멀티 검색은 검색바에 해시 목록을 붙여넣으면 메인 화면에서 처리 (구 /multi 경로 흡수) */}
      <Route path="/multi" element={<Navigate to="/" replace />} />
      {/* 샘플 통계 화면은 제거 — 통계는 통계 앱(/statistics) 담당 (구 /stats 경로 흡수) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
