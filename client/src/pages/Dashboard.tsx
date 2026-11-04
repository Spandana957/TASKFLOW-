import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Flame, Plus, Timer, ListTodo } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { api, sameDay, type Analytics, type Goal, type Task } from '../lib/api';
import { useAuth, useTasks } from '../store';
import { Empty, Modal, Progress, Spinner } from '../components/ui';
import { TaskItem } from '../components/TaskItem';
import { TaskForm } from '../components/TaskForm';

function Stat({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string | number; sub?: string; tone: string }) {
  return (
    <div className="card flex items-center gap-3">
      <div className={`rounded-xl p-2.5 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="truncate text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const user = useAuth((s) => s.user);
  const { tasks, loaded } = useTasks();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  useEffect(() => {
    api<Analytics>('/analytics?days=7').then(setStats).catch(() => undefined);
    api<{ goals: Goal[] }>('/goals').then((r) => setGoals(r.goals)).catch(() => undefined);
  }, [tasks]);

  const today = new Date();
  const { todays, overdue, upcoming } = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done');
    return {
      todays: tasks.filter((t) => t.dueDate && sameDay(new Date(t.dueDate), today)),
      overdue: open.filter((t) => t.dueDate && new Date(t.dueDate) < today && !sameDay(new Date(t.dueDate), today)),
      upcoming: open
        .filter((t) => !t.dueDate || new Date(t.dueDate) > today)
        .sort((a, b) => (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity))
        .slice(0, 6),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const doneToday = stats?.today.completed ?? 0;
  const dailyGoal = stats?.today.goal ?? user?.settings.dailyTaskGoal ?? 5;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="h-page">{greeting}, {user?.name.split(' ')[0]} 👋</h1>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={18} /> New task</button>
      </div>

      <div className="card bg-gradient-to-br from-brand-600 to-violet-600 !border-0 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/80">Today's progress</p>
            <p className="text-3xl font-bold">{doneToday} / {dailyGoal} tasks</p>
          </div>
          <p className="text-sm text-white/80">{doneToday >= dailyGoal ? '🎉 Daily goal reached!' : `${dailyGoal - doneToday} to go`}</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(100, (doneToday / dailyGoal) * 100)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<ListTodo size={20} />} label="Due today" value={stats?.today.due ?? '–'} tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10" />
        <Stat icon={<AlertTriangle size={20} />} label="Overdue" value={stats?.today.overdue ?? '–'} tone="bg-red-50 text-red-600 dark:bg-red-500/10" />
        <Stat icon={<Timer size={20} />} label="Focus today" value={stats ? `${stats.today.focusMinutes}m` : '–'} sub={stats ? `${stats.week.focusMinutes}m this week` : undefined} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" />
        <Stat icon={<Flame size={20} />} label="Streak" value={stats ? `${stats.streak}d` : '–'} sub="days with completions" tone="bg-orange-50 text-orange-600 dark:bg-orange-500/10" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Today</h2>
            <Link to="/tasks" className="text-sm text-brand-600">All tasks →</Link>
          </div>
          {!loaded ? <Spinner /> : (
            <>
              {overdue.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-500">Overdue</p>
                  {overdue.map((t) => <TaskItem key={t._id} task={t} onEdit={setEditing} compact />)}
                </div>
              )}
              {todays.length === 0 && overdue.length === 0 ? (
                <Empty icon={<CheckCircle2 />} title="Nothing due today" hint="Add a task with a due date to plan your day." action={<button className="btn-outline mt-2" onClick={() => setAdding(true)}>Add task</button>} />
              ) : todays.map((t) => <TaskItem key={t._id} task={t} onEdit={setEditing} compact />)}
              {upcoming.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Up next</p>
                  {upcoming.map((t) => <TaskItem key={t._id} task={t} onEdit={setEditing} compact />)}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-5">
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Goals</h2>
              <Link to="/goals" className="text-sm text-brand-600">Manage →</Link>
            </div>
            {goals.length === 0 ? <p className="text-sm text-slate-500">No goals yet. <Link to="/goals" className="text-brand-600">Set one</Link>.</p> : (
              <div className="space-y-3">
                {goals.slice(0, 4).map((g) => (
                  <div key={g._id}>
                    <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{g.title}</span><span className="shrink-0 text-slate-500">{g.progress}/{g.target}</span></div>
                    <Progress value={g.progress} max={g.target} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <h2 className="mb-2 font-semibold">Last 7 days</h2>
            {stats ? (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.daily}>
                    <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="completed" name="Completed" stroke="#6366f1" fill="url(#g1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <Spinner />}
          </div>
        </div>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="New task"><TaskForm onDone={() => setAdding(false)} /></Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit task">{editing && <TaskForm task={editing} onDone={() => setEditing(null)} />}</Modal>
    </div>
  );
}
