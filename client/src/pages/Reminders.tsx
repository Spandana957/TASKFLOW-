import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlarmClock, AlertTriangle, BellOff, Clock, Mail, Trash2 } from 'lucide-react';
import { api, fmtDateTime, toLocalInput, type Integrations, type Reminder } from '../lib/api';
import { errMsg, toast, useAuth, useTasks } from '../store';
import { Empty, Spinner } from '../components/ui';

const STATUS_CLS: Record<Reminder['status'], string> = {
  scheduled: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  processing: 'bg-amber-50 text-amber-700',
  sent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  partial: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800',
};
const EMAIL_LABEL: Record<Reminder['emailStatus'], string> = {
  pending: 'Email pending',
  sent: 'Email delivered to Resend',
  failed: 'Email failed',
  skipped: 'Email off',
  not_configured: 'Email not configured',
};

export default function Reminders() {
  const user = useAuth((s) => s.user);
  const tasks = useTasks((s) => s.tasks).filter((t) => t.status !== 'done');
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [integ, setInteg] = useState<Integrations | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [taskId, setTaskId] = useState('');
  const [at, setAt] = useState(toLocalInput(new Date(Date.now() + 60 * 60_000)));
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(true);

  const load = useCallback(() => api<{ reminders: Reminder[] }>('/reminders').then((r) => setReminders(r.reminders)).catch((e) => toast(errMsg(e), 'error')), []);
  useEffect(() => {
    void load();
    api<Integrations>('/auth/integrations').then(setInteg).catch(() => undefined);
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/reminders', {
        method: 'POST',
        body: { title: title.trim() || undefined, message, taskId: taskId || null, remindAt: new Date(at).toISOString(), channels: { email, push, inApp: true } },
      });
      toast('Reminder scheduled', 'success');
      setTitle('');
      setMessage('');
      void load();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const act = async (path: string, body?: unknown, method = 'POST') => {
    try {
      await api(path, { method, body });
      void load();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  const upcoming = (reminders ?? []).filter((r) => r.status === 'scheduled' || r.status === 'processing').sort((a, b) => +new Date(a.remindAt) - +new Date(b.remindAt));
  const history = (reminders ?? []).filter((r) => r.status !== 'scheduled' && r.status !== 'processing');

  return (
    <div className="space-y-4">
      <h1 className="h-page">Reminders</h1>

      {integ && !integ.email && (
        <div className="card flex gap-3 !border-amber-300 bg-amber-50 text-sm text-amber-800 dark:!border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="shrink-0" size={18} />
          <p>Email delivery is not configured on the server (<code>RESEND_API_KEY</code> / <code>EMAIL_FROM</code>). Reminders still fire in-app, and each will honestly show “Email not configured” instead of a fake success.</p>
        </div>
      )}

      <form onSubmit={create} className="card grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="r-task">For task (optional)</label>
          <select id="r-task" className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">— None —</option>
            {tasks.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-title">Title {taskId && '(defaults to task title)'}</label>
          <input id="r-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required={!taskId} maxLength={200} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="r-msg">Message</label>
          <input id="r-msg" className="input" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
        </div>
        <div>
          <label className="label" htmlFor="r-at">Remind at</label>
          <input id="r-at" type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} required />
        </div>
        <div className="flex flex-wrap items-end gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} /> Browser push</label>
          <button className="btn-primary ml-auto"><AlarmClock size={16} /> Schedule</button>
        </div>
        <p className="text-xs text-slate-500 sm:col-span-2">Emails are sent by the server to your account address <b>{user?.email}</b>.</p>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-semibold">Upcoming</h2>
          {!reminders ? <Spinner /> : upcoming.length === 0 ? <Empty icon={<AlarmClock />} title="No upcoming reminders" /> : upcoming.map((r) => (
            <div key={r._id} className="flex items-start justify-between gap-2 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-sm text-slate-500"><Clock size={12} className="mr-1 inline" />{fmtDateTime(r.remindAt)}{r.snoozeCount > 0 && ` · snoozed ×${r.snoozeCount}`}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn-outline !px-2 !py-1 text-xs" onClick={() => act(`/reminders/${r._id}/snooze`, { minutes: 10 })}>+10m</button>
                <button className="btn-ghost !p-1.5" title="Cancel" aria-label="Cancel reminder" onClick={() => act(`/reminders/${r._id}/cancel`)}><BellOff size={15} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">History & delivery status</h2>
          {!reminders ? <Spinner /> : history.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Delivered and cancelled reminders appear here.</p> : (
            <div className="max-h-[32rem] overflow-y-auto">
              {history.map((r) => (
                <div key={r._id} className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium">{r.title}</p>
                    <span className={`chip shrink-0 capitalize ${STATUS_CLS[r.status]}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-slate-500">{fmtDateTime(r.sentAt ?? r.remindAt)}</p>
                  {r.status !== 'cancelled' && (
                    <p className={`mt-1 text-xs ${r.emailStatus === 'sent' ? 'text-emerald-600' : r.emailStatus === 'failed' || r.emailStatus === 'not_configured' ? 'text-amber-600' : 'text-slate-500'}`}>
                      <Mail size={12} className="mr-1 inline" />{EMAIL_LABEL[r.emailStatus]}{r.emailError && r.emailStatus === 'failed' ? `: ${r.emailError}` : ''} · push {r.pushStatus}
                    </p>
                  )}
                  <div className="mt-2 flex gap-1">
                    {r.status !== 'cancelled' && <button className="btn-outline !px-2 !py-1 text-xs" onClick={() => act(`/reminders/${r._id}/snooze`, { minutes: 10 })}>Snooze 10m</button>}
                    <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => act(`/reminders/${r._id}`, undefined, 'DELETE')}><Trash2 size={13} /> Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
