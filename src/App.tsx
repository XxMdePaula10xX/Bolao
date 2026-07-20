import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { HomePage } from '@/pages/HomePage';
import { PalpitesPage } from '@/pages/PalpitesPage';
import { EditionPage } from '@/pages/EditionPage';
import { ProfilePage } from '@/pages/ProfilePage';

export function App() {
  const { initializing, profile, subscribe } = useAuthStore();

  useEffect(() => subscribe(), [subscribe]);

  if (initializing) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  return (
    <BrowserRouter>
      {profile ? (
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/palpites" element={<PalpitesPage />} />
            <Route path="/bolao" element={<EditionPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
