import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react';
import { api, fmtDateTime, type TimeEntry } from '../lib/api';
import { errMsg, toast, useAuth, useTasks } from '../store';

type Phase = 'focus' | 'short' | 'long';
const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.connect(ctx.destination);
    o.frequency.value = 880;
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* audio unavailable */
  }
}

export default function Focus() {
  const settings = useAuth((s) => s.user?.settings);
  const { tasks, fetch: refetchTasks } = useTasks();
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const [taskId, setTaskId] = useState('');
  const [mode, setMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro');
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  const loadEntries = useCallback(() => api<{ entries: TimeEntry[] }>('/time').then((r) => setEntries(r.entries)).catch(() => undefined), []);
  useEffect(() => void loadEntries(), [loadEntries]);

  const log = useCallback(
    async (kind: 'pomodoro' | 'stopwatch' | 'manual', startedAt: Date, endedAt: Date) => {
      if (endedAt.getTime() - startedAt.getTime() < 30_000) return toast('Sessions under 30s are not logged');
      try {
        await api('/time', { method: 'POST', body: { kind, startedAt, endedAt, taskId: taskId || null } });
        toast('Focus session logged', 'success');
        void loadEntries();
        if (taskId) void refetchTasks();
      } catch (e) {
        toast(errMsg(e), 'error');
      }
    },
    [taskId, loadEntries, refetchTasks],
  );

  /* ---------- Pomodoro ---------- */
  const durations: Record<Phase, number> = {
    focus: (settings?.pomodoroMinutes ?? 25) * 60,
    short: (settings?.shortBreakMinutes ?? 5) * 60,
    long: (settings?.longBreakMinutes ?? 15) * 60,
  };
  const [phase, setPhase] = useState<Phase>('focus');
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(durations.focus);
  const [completed, setCompleted] = useState(0);
  const startedRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!endAt) setRemaining(durations[phase]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, settings?.pomodoroMinutes, settings?.shortBreakMinutes, settings?.longBreakMinutes]);

  useEffect(() => {
    if (!endAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setEndAt(null);
        beep();
        if (phase === 'focus') {
          if (startedRef.current) void log('pomodoro', startedRef.current, new Date());
          const n = completed + 1;
          setCompleted(n);
          setPhase(n % 4 === 0 ? 'long' : 'short');
          if ('Notification' in window && Notification.permission === 'granted') new Notification('Focus session complete 🎉', { body: 'Time for a break.' });
        } else {
          setPhase('focus');
          if ('Notification' in window && Notification.permission === 'granted') new Notification('Break over', { body: 'Ready to focus?' });
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [endAt, phase, completed, log]);

  useEffect(() => {
    document.title = endAt ? `${fmt(remaining)} · ${phase === 'focus' ? 'Focus' : 'Break'} — TaskFlow` : 'TaskFlow — Plan Your Day';
    return () => { document.title = 'TaskFlow — Plan Your Day'; };
  }, [remaining, endAt, phase]);

  const startPomo = () => {
    if (phase === 'focus' && remaining === durations.focus) startedRef.current = new Date();
    if (!startedRef.current) startedRef.current = new Date();
    setEndAt(Date.now() + remaining * 1000);
  };
  const pausePomo = () => setEndAt(null);
  const resetPomo = () => {
    setEndAt(null);
    startedRef.current = null;
    setRemaining(durations[phase]);
  };

  /* ---------- Stopwatch ---------- */
  const [swStart, setSwStart] = useState<Date | null>(null);
  const [swElapsed, setSwElapsed] = useState(0);
  useEffect(() => {
    if (!swStart) return;
    const id = setInterval(() => setSwElapsed((Date.now() - swStart.getTime()) / 1000), 250);
    return () => clearInterval(id);
  }, [swStart]);
  const stopSw = () => {
    if (swStart) void log('stopwatch', swStart, new Date());
    setSwStart(null);
    setSwElapsed(0);
  };

  /* ---------- Manual entry ---------- */
  const [manual, setManual] = useState('');
  const addManual = () => {
    const mins = Number(manual);
    if (!mins || mins <= 0) return;
    const end = new Date();
    void log('manual', new Date(end.getTime() - mins * 60_000), end);
    setManual('');
  };

  const delEntry = async (id: string) => {
    await api(`/time/${id}`, { method: 'DELETE' }).catch((e) => toast(errMsg(e), 'error'));
    void loadEntries();
    void refetchTasks();
  };

  const total = durations[phase];
  const pct = 1 - remaining / total;
  const R = 110;
  const C = 2 * Math.PI * R;
  const todayMins = entries.filter((e) => new Date(e.startedAt).toDateString() === new Date().toDateString()).reduce((s, e) => s + e.minutes, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-page">Focus</h1>
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['pomodoro', 'stopwatch'] as const).map((m) => (
            <button key={m} disabled={!!endAt || !!swStart} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1.5 text-sm capitalize ${mode === m ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500'}`}>{m}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card flex flex-col items-center gap-4 lg:col-span-3">
          <div className="w-full">
            <label className="label" htmlFor="focus-task">Working on</label>
            <select id="focus-task" className="input" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">No specific task</option>
              {openTasks.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
            </select>
          </div>

          {mode === 'pomodoro' ? (
            <>
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm dark:bg-slate-800">
                {(['focus', 'short', 'long'] as Phase[]).map((p) => (
                  <button key={p} disabled={!!endAt} onClick={() => { setPhase(p); startedRef.current = null; }} className={`rounded-lg px-3 py-1 ${phase === p ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500'}`}>
                    {p === 'focus' ? 'Focus' : p === 'short' ? 'Short break' : 'Long break'}
                  </button>
                ))}
              </div>
              <div className="relative aspect-square w-full max-w-[260px]">
                <svg viewBox="0 0 260 260" className="h-full w-full -rotate-90">
                  <circle cx="130" cy="130" r={R} className="fill-none stroke-slate-100 dark:stroke-slate-800" strokeWidth="14" />
                  <circle cx="130" cy="130" r={R} className={`fill-none transition-all ${phase === 'focus' ? 'stroke-brand-500' : 'stroke-emerald-500'}`} strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-5xl font-bold tabular-nums">{fmt(remaining)}</span>
                  <span className="text-sm text-slate-500">{phase === 'focus' ? 'Focus' : 'Break'} · {completed} done</span>
                </div>
              </div>
              <div className="flex gap-2">
                {endAt ? <button className="btn-primary" onClick={pausePomo}><Pause size={18} /> Pause</button> : <button className="btn-primary" onClick={startPomo}><Play size={18} /> Start</button>}
                <button className="btn-outline" onClick={resetPomo}><RotateCcw size={18} /> Reset</button>
              </div>
            </>
          ) : (
            <>
              <span className="py-12 font-mono text-6xl font-bold tabular-nums">{fmt(swElapsed)}</span>
              <div className="flex gap-2">
                {swStart ? <button className="btn-primary" onClick={stopSw}><Square size={18} /> Stop & log</button> : <button className="btn-primary" onClick={() => setSwStart(new Date())}><Play size={18} /> Start</button>}
              </div>
            </>
          )}
          <div className="flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="text-sm text-slate-500">Log time manually:</span>
            <input type="number" min={1} className="input !w-24" placeholder="min" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Minutes" />
            <button className="btn-outline" onClick={addManual}>Add</button>
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Time log</h2>
            <span className="text-sm text-slate-500">Today: {Math.round(todayMins)}m</span>
          </div>
          {entries.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No sessions yet. Start a timer to track your time.</p> : (
            <div className="max-h-[28rem] space-y-1 overflow-y-auto">
              {entries.map((e) => (
                <div key={e._id} className="group flex items-center justify-between gap-2 rounded-xl p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.task?.title ?? 'General focus'}</p>
                    <p className="text-xs text-slate-500">{fmtDateTime(e.startedAt)} · {e.kind}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-mono">{Math.round(e.minutes)}m</span>
                    <button className="btn-danger !p-1" onClick={() => delEntry(e._id)} aria-label="Delete entry"><Trash2 size={14} /></button>
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
