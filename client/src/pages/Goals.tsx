import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Minus, Plus, Target, Trash2 } from 'lucide-react';
import { api, type Goal } from '../lib/api';
import { errMsg, toast } from '../store';
import { Empty, Progress, Spinner } from '../components/ui';

const METRIC_LABEL = { tasks_completed: 'tasks completed', focus_minutes: 'focus minutes', custom: 'check-ins' } as const;

export default function Goals() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<Goal['period']>('daily');
  const [metric, setMetric] = useState<Goal['metric']>('tasks_completed');
  const [target, setTarget] = useState('5');

  const load = useCallback(() => api<{ goals: Goal[] }>('/goals').then((r) => setGoals(r.goals)).catch((e) => toast(errMsg(e), 'error')), []);
  useEffect(() => void load(), [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/goals', { method: 'POST', body: { title: title.trim(), period, metric, target: Number(target) } });
      setTitle('');
      toast('Goal created', 'success');
      void load();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };
  const bump = async (g: Goal, d: number) => {
    await api(`/goals/${g._id}`, { method: 'PATCH', body: { manualProgress: Math.max(0, g.manualProgress + d) } }).catch((e) => toast(errMsg(e), 'error'));
    void load();
  };
  const del = async (g: Goal) => {
    if (!confirm(`Delete goal "${g.title}"?`)) return;
    await api(`/goals/${g._id}`, { method: 'DELETE' });
    void load();
  };

  const section = (p: Goal['period']) => {
    const list = (goals ?? []).filter((g) => g.period === p);
    return (
      <div className="card">
        <h2 className="mb-3 font-semibold">{p === 'daily' ? 'Daily goals' : 'Weekly goals'} <span className="text-xs font-normal text-slate-400">{p === 'daily' ? 'reset each day' : 'reset each Monday'}</span></h2>
        {list.length === 0 ? <p className="py-4 text-center text-sm text-slate-500">No {p} goals yet.</p> : (
          <div className="space-y-4">
            {list.map((g) => {
              const done = g.progress >= g.target;
              return (
                <div key={g._id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{done && '✅ '}{g.title}</p>
                      <p className="text-xs text-slate-500">{g.progress} / {g.target} {METRIC_LABEL[g.metric]}{g.metric !== 'custom' && ' · tracked automatically'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {g.metric === 'custom' && (
                        <>
                          <button className="btn-outline !p-1.5" onClick={() => bump(g, -1)} aria-label="Decrease"><Minus size={14} /></button>
                          <button className="btn-outline !p-1.5" onClick={() => bump(g, 1)} aria-label="Increase"><Plus size={14} /></button>
                        </>
                      )}
                      <button className="btn-danger !p-1.5" onClick={() => del(g)} aria-label="Delete goal"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <Progress value={g.progress} max={g.target} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="h-page">Goals</h1>
      <form onSubmit={add} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="g-title">Goal</label>
          <input id="g-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ship 5 tasks" required />
        </div>
        <div>
          <label className="label" htmlFor="g-period">Period</label>
          <select id="g-period" className="input" value={period} onChange={(e) => setPeriod(e.target.value as Goal['period'])}><option value="daily">Daily</option><option value="weekly">Weekly</option></select>
        </div>
        <div>
          <label className="label" htmlFor="g-metric">Measure</label>
          <select id="g-metric" className="input" value={metric} onChange={(e) => setMetric(e.target.value as Goal['metric'])}>
            <option value="tasks_completed">Tasks completed</option>
            <option value="focus_minutes">Focus minutes</option>
            <option value="custom">Manual check-ins</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label" htmlFor="g-target">Target</label>
            <input id="g-target" type="number" min={1} className="input" value={target} onChange={(e) => setTarget(e.target.value)} required />
          </div>
          <button className="btn-primary"><Plus size={18} /></button>
        </div>
      </form>
      {!goals ? <Spinner /> : goals.length === 0 ? (
        <div className="card"><Empty icon={<Target />} title="Set your first goal" hint="Goals based on tasks or focus minutes update automatically from your activity." /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{section('daily')}{section('weekly')}</div>
      )}
    </div>
  );
}
