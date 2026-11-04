import { create } from 'zustand';
import { api, configureApi, type Settings, type Task, type User } from '../lib/api';

const TOKEN_KEY = 'taskflow.token';
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<void>;
  updateSettings: (patch: Partial<Settings> & { name?: string }) => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  token: read(TOKEN_KEY),
  user: null,
  loading: Boolean(read(TOKEN_KEY)),
  async login(email, password) {
    const r = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } });
    write(TOKEN_KEY, r.token);
    set({ token: r.token, user: r.user });
  },
  async register(name, email, password) {
    const r = await api<{ token: string; user: User }>('/auth/register', { method: 'POST', body: { name, email, password } });
    write(TOKEN_KEY, r.token);
    set({ token: r.token, user: r.user });
  },
  logout() {
    write(TOKEN_KEY, null);
    set({ token: null, user: null, loading: false });
    useTasks.setState({ tasks: [], loaded: false });
  },
  async loadMe() {
    if (!get().token) return set({ loading: false });
    try {
      const r = await api<{ user: User }>('/auth/me');
      set({ user: r.user, loading: false });
    } catch {
      get().logout();
    }
  },
  async updateSettings(patch) {
    const r = await api<{ user: User }>('/auth/settings', { method: 'PATCH', body: patch });
    set({ user: r.user });
  },
}));

configureApi(
  () => useAuth.getState().token,
  () => useAuth.getState().logout(),
);

/* ---------- Tasks (shared across dashboard, tasks, calendar, focus) ---------- */
interface TaskState {
  tasks: Task[];
  loaded: boolean;
  fetch: () => Promise<void>;
  create: (t: Partial<Task>) => Promise<Task>;
  update: (id: string, t: Partial<Task>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTasks = create<TaskState>((set, get) => ({
  tasks: [],
  loaded: false,
  async fetch() {
    const r = await api<{ tasks: Task[] }>('/tasks');
    set({ tasks: r.tasks, loaded: true });
  },
  async create(t) {
    const r = await api<{ task: Task }>('/tasks', { method: 'POST', body: t });
    set({ tasks: [r.task, ...get().tasks] });
    return r.task;
  },
  async update(id, t) {
    const r = await api<{ task: Task; spawned: Task | null }>(`/tasks/${id}`, { method: 'PATCH', body: t });
    const tasks = get().tasks.map((x) => (x._id === id ? r.task : x));
    set({ tasks: r.spawned ? [r.spawned, ...tasks] : tasks });
    if (r.spawned) toast(`Next "${r.spawned.title}" scheduled`, 'success');
  },
  async remove(id) {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    set({ tasks: get().tasks.filter((x) => x._id !== id) });
  },
}));

/* ---------- UI: theme + toasts ---------- */
type Theme = 'light' | 'dark' | 'system';
interface Toast { id: number; text: string; kind: 'info' | 'success' | 'error' }
interface UiState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toasts: Toast[];
}

export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export const useUi = create<UiState>((set) => ({
  theme: (read('taskflow.theme') as Theme) ?? 'system',
  setTheme(theme) {
    write('taskflow.theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  toasts: [],
}));

let toastId = 0;
export function toast(text: string, kind: Toast['kind'] = 'info') {
  const id = ++toastId;
  useUi.setState((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
