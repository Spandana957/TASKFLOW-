const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  emailReminders: boolean;
  browserNotifications: boolean;
  defaultReminderMinutes: number;
  pomodoroMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  dailyTaskGoal: number;
  weeklyFocusGoalMinutes: number;
}
export interface User { id: string; name: string; email: string; settings: Settings }
export interface Task {
  _id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  tags: string[];
  dueDate: string | null;
  estimatedMinutes: number;
  trackedMinutes: number;
  recurrence: Recurrence;
  completedAt: string | null;
  createdAt: string;
}
export interface Note {
  _id: string;
  title: string;
  contentHtml: string;
  color: string;
  pinned: boolean;
  tags: string[];
  updatedAt: string;
}
export interface Reminder {
  _id: string;
  task: string | null;
  title: string;
  message: string;
  remindAt: string;
  status: 'scheduled' | 'processing' | 'sent' | 'partial' | 'failed' | 'cancelled';
  emailStatus: 'pending' | 'sent' | 'failed' | 'skipped' | 'not_configured';
  emailError: string | null;
  pushStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  snoozeCount: number;
  sentAt: string | null;
  channels: { email: boolean; push: boolean; inApp: boolean };
}
export interface AppNotification { _id: string; title: string; body: string; read: boolean; createdAt: string }
export interface TimeEntry {
  _id: string;
  task: { _id: string; title: string } | null;
  kind: 'pomodoro' | 'stopwatch' | 'manual';
  startedAt: string;
  endedAt: string;
  minutes: number;
  note: string;
}
export interface Goal {
  _id: string;
  title: string;
  period: 'daily' | 'weekly';
  metric: 'tasks_completed' | 'focus_minutes' | 'custom';
  target: number;
  manualProgress: number;
  progress: number;
}
export interface Analytics {
  daily: { date: string; completed: number; created: number; focusMinutes: number }[];
  byPriority: { priority: Priority; count: number }[];
  totals: { todo: number; in_progress: number; done: number };
  today: { due: number; completed: number; overdue: number; focusMinutes: number; goal: number };
  week: { focusMinutes: number; focusGoal: number };
  streak: number;
  pomodoros: number;
}
export interface Integrations { email: boolean; push: boolean; vapidPublicKey: string | null; scheduler: string }

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let tokenGetter: () => string | null = () => null;
let onUnauthorized: () => void = () => undefined;
export function configureApi(getToken: () => string | null, unauthorized: () => void) {
  tokenGetter = getToken;
  onUnauthorized = unauthorized;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenGetter();
  const res = await fetch(`${BASE}/api${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const PRIORITY_META: Record<Priority, { label: string; cls: string; dot: string }> = {
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', dot: 'bg-red-500' },
  high: { label: 'High', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', dot: 'bg-orange-500' },
  medium: { label: 'Medium', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500' },
  low: { label: 'Low', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
/** `datetime-local` input value from a Date in local time. */
export const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
