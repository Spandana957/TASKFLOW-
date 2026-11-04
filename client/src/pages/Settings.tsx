import { useEffect, useState, type ReactNode } from 'react';
import { api, type Integrations, type Settings } from '../lib/api';
import { enableBrowserNotifications } from '../lib/notify';
import { errMsg, toast, useAuth, useUi } from '../store';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const { user, updateSettings } = useAuth();
  const { theme, setTheme } = useUi();
  const [name, setName] = useState(user?.name ?? '');
  const [integ, setInteg] = useState<Integrations | null>(null);
  const [perm, setPerm] = useState<string>('Notification' in window ? Notification.permission : 'unsupported');

  useEffect(() => {
    api<Integrations>('/auth/integrations').then(setInteg).catch(() => undefined);
  }, []);
  if (!user) return null;
  const s = user.settings;

  const save = async (patch: Partial<Settings> & { name?: string }) => {
    try {
      await updateSettings(patch);
      toast('Settings saved', 'success');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  const num = (key: keyof Settings, min: number, max: number) => (
    <input
      type="number"
      min={min}
      max={max}
      defaultValue={s[key] as number}
      className="input !w-24"
      aria-label={key}
      onBlur={(e) => {
        const v = Number(e.target.value);
        if (v >= min && v <= max && v !== s[key]) void save({ [key]: v });
      }}
    />
  );

  const enablePush = async () => {
    try {
      const r = await enableBrowserNotifications();
      setPerm('Notification' in window ? Notification.permission : 'unsupported');
      toast(
        r === 'subscribed' ? 'Browser push enabled — reminders arrive even when TaskFlow is closed'
          : r === 'permission-only' ? 'Notifications enabled while TaskFlow is open (server push not configured)'
            : r === 'denied' ? 'Permission denied in browser settings' : 'This browser does not support notifications',
        r === 'subscribed' || r === 'permission-only' ? 'success' : 'error',
      );
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="h-page">Settings</h1>

      <div className="card">
        <h2 className="mb-1 font-semibold">Profile</h2>
        <Row label="Name">
          <div className="flex gap-2"><input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" /><button className="btn-outline" onClick={() => save({ name })}>Save</button></div>
        </Row>
        <Row label="Email" hint="Reminder emails are always sent to this address."><span className="text-sm text-slate-500">{user.email}</span></Row>
      </div>

      <div className="card">
        <h2 className="mb-1 font-semibold">Appearance</h2>
        <Row label="Theme">
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button key={t} onClick={() => { setTheme(t); void save({ theme: t }); }} className={`rounded-lg px-3 py-1 text-sm capitalize ${theme === t ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500'}`}>{t}</button>
            ))}
          </div>
        </Row>
      </div>

      <div className="card">
        <h2 className="mb-1 font-semibold">Notifications</h2>
        <Row label="Email reminders" hint={integ && !integ.email ? '⚠ Server email (Resend) is not configured yet.' : 'Sent via Resend at the scheduled time.'}>
          <Toggle label="Email reminders" on={s.emailReminders} onChange={(v) => save({ emailReminders: v })} />
        </Row>
        <Row label="Browser notifications" hint={`Browser permission: ${perm}${integ ? ` · server push ${integ.push ? 'configured' : 'not configured'}` : ''}`}>
          <div className="flex items-center gap-2">
            {perm !== 'granted' && perm !== 'unsupported' && <button className="btn-outline !py-1" onClick={enablePush}>Enable</button>}
            {perm === 'granted' && integ?.push && <button className="btn-outline !py-1" onClick={enablePush}>Re-subscribe</button>}
            <Toggle label="Browser notifications" on={s.browserNotifications} onChange={(v) => save({ browserNotifications: v })} />
          </div>
        </Row>
        <Row label="Default reminder" hint="Minutes before a task's due time">{num('defaultReminderMinutes', 0, 10080)}</Row>
        {integ && <Row label="Scheduler" hint="How reminders are queued on the server"><span className="chip bg-slate-100 dark:bg-slate-800">{integ.scheduler}</span></Row>}
      </div>

      <div className="card">
        <h2 className="mb-1 font-semibold">Focus & goals</h2>
        <Row label="Pomodoro length (min)">{num('pomodoroMinutes', 1, 180)}</Row>
        <Row label="Short break (min)">{num('shortBreakMinutes', 1, 60)}</Row>
        <Row label="Long break (min)">{num('longBreakMinutes', 1, 120)}</Row>
        <Row label="Daily task goal">{num('dailyTaskGoal', 1, 100)}</Row>
        <Row label="Weekly focus goal (min)">{num('weeklyFocusGoalMinutes', 10, 10080)}</Row>
      </div>
    </div>
  );
}
