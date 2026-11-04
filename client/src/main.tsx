import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { applyTheme, useAuth, useUi } from './store';
import { Layout } from './components/Layout';
import { Spinner, Toasts } from './components/ui';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import CalendarPage from './pages/Calendar';
import Focus from './pages/Focus';
import Notes from './pages/Notes';
import Goals from './pages/Goals';
import AnalyticsPage from './pages/Analytics';
import Reminders from './pages/Reminders';
import SettingsPage from './pages/Settings';

function App() {
  const { token, user, loading, loadMe } = useAuth();
  const { theme, setTheme } = useUi();

  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => applyTheme(useUi.getState().theme);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => void loadMe(), [loadMe]);
  // Sync theme from the user's saved settings on login.
  useEffect(() => {
    if (user?.settings.theme && user.settings.theme !== useUi.getState().theme) setTheme(user.settings.theme);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex h-full items-center justify-center"><Spinner /></div>;

  return (
    <>
      <Routes>
        {!token || !user ? (
          <Route path="*" element={<AuthPage />} />
        ) : (
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="focus" element={<Focus />} />
            <Route path="notes" element={<Notes />} />
            <Route path="goals" element={<Goals />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
      <Toasts />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
