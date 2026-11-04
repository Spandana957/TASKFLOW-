import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, CalendarDays, CheckSquare, LayoutDashboard, LogOut, Moon, NotebookPen, Settings, Sun, Target, Timer, AlarmClock, Search, MoreHorizontal,
} from 'lucide-react';
import { api, fmtDateTime, type AppNotification } from '../lib/api';
import { showBrowserNotification } from '../lib/notify';
import { useAuth, useTasks, useUi } from '../store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/notes', label: 'Notes', icon: NotebookPen },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reminders', label: 'Reminders', icon: AlarmClock },
  { to: '/settings', label: 'Settings', icon: Settings },
];
const MOBILE = NAV.slice(0, 4);

function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const browserOn = useAuth((s) => s.user?.settings.browserNotifications);

  const load = useCallback(async () => {
    try {
      const r = await api<{ notifications: AppNotification[]; unread: number }>('/notifications');
      if (seen.current) {
        for (const n of r.notifications) if (!seen.current.has(n._id) && !n.read && browserOn) showBrowserNotification(n);
      }
      seen.current = new Set(r.notifications.map((n) => n._id));
      setItems(r.notifications);
      setUnread(r.unread);
    } catch {
      /* offline */
    }
  }, [browserOn]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    void load();
  };

  return (
    <div className="relative">
      <button className="btn-ghost relative !p-2" onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${unread} unread)`}>
        <Bell size={20} />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="font-semibold">Notifications</span>
              {unread > 0 && <button className="text-xs text-brand-600" onClick={markAll}>Mark all read</button>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 && <p className="p-4 text-center text-sm text-slate-500">No notifications yet. Reminders you schedule will appear here when they fire.</p>}
              {items.map((n) => (
                <div key={n._id} className={`rounded-xl p-2 text-sm ${n.read ? '' : 'bg-brand-50 dark:bg-brand-500/10'}`}>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-slate-500">{n.body}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useUi();
  const fetchTasks = useTasks((s) => s.fetch);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [more, setMore] = useState(false);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const isDark = document.documentElement.classList.contains('dark');
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`;

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <div>
            <p className="font-bold leading-tight">TaskFlow</p>
            <p className="text-[11px] text-slate-500">Focus on what matters</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkCls}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="truncate px-3 text-sm font-medium">{user?.name}</p>
          <p className="truncate px-3 text-xs text-slate-500">{user?.email}</p>
          <button className="btn-ghost mt-2 w-full justify-start" onClick={logout}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:px-6">
          <img src="/icon.svg" alt="TaskFlow" className="h-8 w-8 lg:hidden" />
          <form
            className="relative min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/tasks?search=${encodeURIComponent(q)}`);
            }}
          >
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input !pl-9 sm:max-w-sm" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tasks" />
          </form>
          <button
            className="btn-ghost !p-2"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' || (theme === 'system' && isDark) ? 'light' : 'dark')}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <NotificationBell />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        {MOBILE.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-brand-600' : 'text-slate-500'}`}>
            <Icon size={20} /> {label}
          </NavLink>
        ))}
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-500"><MoreHorizontal size={20} /> More</button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 gap-2">
              {NAV.slice(4).map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setMore(false)} className="flex flex-col items-center gap-1 rounded-xl p-3 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Icon size={22} /> {label}
                </NavLink>
              ))}
              <button onClick={logout} className="flex flex-col items-center gap-1 rounded-xl p-3 text-xs text-red-600 hover:bg-red-50"><LogOut size={22} /> Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
