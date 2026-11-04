import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, type Analytics } from '../lib/api';
import { errMsg, toast } from '../store';
import { Progress, Spinner } from '../components/ui';

const PRI_COLORS: Record<string, string> = { urgent: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#10b981' };

export default function AnalyticsPage() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    setData(null);
    api<Analytics>(`/analytics?days=${days}`).then(setData).catch((e) => toast(errMsg(e), 'error'));
  }, [days]);

  const totalCompleted = data?.daily.reduce((s, d) => s + d.completed, 0) ?? 0;
  const totalFocus = data?.daily.reduce((s, d) => s + d.focusMinutes, 0) ?? 0;
  const all = data ? data.totals.todo + data.totals.in_progress + data.totals.done : 0;
  const tick = (d: string) => d.slice(5);
  const hasActivity = data && (totalCompleted > 0 || totalFocus > 0 || data.daily.some((d) => d.created > 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-page">Analytics</h1>
        <select className="input !w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Range">
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      {!data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Completed', totalCompleted],
              ['Focus time', `${Math.floor(totalFocus / 60)}h ${totalFocus % 60}m`],
              ['Pomodoros', data.pomodoros],
              ['Completion rate', all ? `${Math.round((data.totals.done / all) * 100)}%` : '–'],
            ].map(([l, v]) => (
              <div key={l} className="card"><p className="text-xs text-slate-500">{l}</p><p className="text-2xl font-bold">{v}</p></div>
            ))}
          </div>
          {!hasActivity && <p className="card text-sm text-slate-500">No activity in this range yet — complete tasks and log focus sessions to see your trends here. All charts are computed from your real data.</p>}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-3 font-semibold">Tasks created vs completed</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="created" name="Created" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h2 className="mb-3 font-semibold">Focus minutes per day</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={32} />
                    <Tooltip />
                    <Line type="monotone" dataKey="focusMinutes" name="Focus min" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h2 className="mb-3 font-semibold">Open tasks by priority</h2>
              {data.byPriority.every((p) => p.count === 0) ? <p className="py-10 text-center text-sm text-slate-500">No open tasks.</p> : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.byPriority.filter((p) => p.count > 0)} dataKey="count" nameKey="priority" innerRadius="55%" outerRadius="85%" paddingAngle={3}>
                        {data.byPriority.filter((p) => p.count > 0).map((p) => <Cell key={p.priority} fill={PRI_COLORS[p.priority]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="card space-y-4">
              <h2 className="font-semibold">This week</h2>
              <div>
                <div className="mb-1 flex justify-between text-sm"><span>Focus goal</span><span className="text-slate-500">{data.week.focusMinutes} / {data.week.focusGoal} min</span></div>
                <Progress value={data.week.focusMinutes} max={data.week.focusGoal} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm"><span>Today's tasks</span><span className="text-slate-500">{data.today.completed} / {data.today.goal}</span></div>
                <Progress value={data.today.completed} max={data.today.goal} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xl font-bold">{data.totals.todo}</p><p className="text-xs text-slate-500">To do</p></div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xl font-bold">{data.totals.in_progress}</p><p className="text-xs text-slate-500">In progress</p></div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xl font-bold">{data.totals.done}</p><p className="text-xs text-slate-500">Done</p></div>
              </div>
              <p className="text-sm text-slate-500">🔥 Current streak: <b>{data.streak}</b> day{data.streak === 1 ? '' : 's'}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
