import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PRIORITY_META, sameDay, type Task } from '../lib/api';
import { useTasks } from '../store';
import { Modal } from '../components/ui';
import { TaskItem } from '../components/TaskItem';
import { TaskForm } from '../components/TaskForm';

type View = 'day' | 'week' | 'month';
const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export default function CalendarPage() {
  const { tasks } = useTasks();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [adding, setAdding] = useState<Date | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);

  const dated = useMemo(() => tasks.filter((t) => t.dueDate), [tasks]);
  const on = (d: Date) => dated.filter((t) => sameDay(new Date(t.dueDate!), d));

  const days = useMemo(() => {
    if (view === 'day') return [cursor];
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view, cursor]);

  const move = (dir: number) => {
    const c = new Date(cursor);
    if (view === 'day') c.setDate(c.getDate() + dir);
    else if (view === 'week') c.setDate(c.getDate() + 7 * dir);
    else c.setMonth(c.getMonth() + dir, 1);
    setCursor(c);
    if (view === 'day') setSelected(c);
  };

  const title =
    view === 'month'
      ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `Week of ${startOfWeek(cursor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
        : cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const today = new Date();
  const listDay = view === 'day' ? cursor : selected;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-page">Calendar</h1>
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-sm capitalize ${view === v ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500'}`}>{v}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button className="btn-ghost !p-2" onClick={() => move(-1)} aria-label="Previous"><ChevronLeft size={18} /></button>
          <div className="text-center">
            <p className="font-semibold">{title}</p>
            <button className="text-xs text-brand-600" onClick={() => { setCursor(new Date()); setSelected(new Date()); }}>Today</button>
          </div>
          <button className="btn-ghost !p-2" onClick={() => move(1)} aria-label="Next"><ChevronRight size={18} /></button>
        </div>

        {view !== 'day' && (
          <div className="grid grid-cols-7 gap-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="pb-1 text-center text-[11px] font-medium text-slate-400">{d}</div>)}
            {days.map((d) => {
              const items = on(d);
              const out = view === 'month' && d.getMonth() !== cursor.getMonth();
              const isSel = sameDay(d, selected);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelected(d)}
                  className={`flex min-w-0 flex-col rounded-xl border p-1 text-left transition ${view === 'week' ? 'min-h-[7rem]' : 'min-h-[3.5rem] sm:min-h-[5.5rem]'} ${isSel ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-100 hover:border-slate-300 dark:border-slate-800'} ${out ? 'opacity-40' : ''}`}
                >
                  <span className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs ${sameDay(d, today) ? 'bg-brand-600 font-bold text-white' : ''}`}>{d.getDate()}</span>
                  <div className="hidden min-w-0 space-y-0.5 sm:block">
                    {items.slice(0, view === 'week' ? 5 : 3).map((t) => (
                      <div key={t._id} className={`truncate rounded px-1 text-[11px] ${t.status === 'done' ? 'line-through opacity-50' : ''} ${PRIORITY_META[t.priority].cls}`}>{t.title}</div>
                    ))}
                    {items.length > (view === 'week' ? 5 : 3) && <div className="text-[10px] text-slate-400">+{items.length - (view === 'week' ? 5 : 3)} more</div>}
                  </div>
                  {items.length > 0 && <div className="mt-auto flex gap-0.5 sm:hidden">{items.slice(0, 3).map((t) => <span key={t._id} className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[t.priority].dot}`} />)}</div>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">{listDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>
          <button className="btn-outline !py-1.5" onClick={() => { const d = new Date(listDay); d.setHours(9, 0, 0, 0); setAdding(d); }}><Plus size={16} /> Add</button>
        </div>
        {on(listDay).length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No tasks scheduled for this day.</p> : on(listDay).sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!)).map((t) => <TaskItem key={t._id} task={t} onEdit={setEditing} />)}
      </div>

      <Modal open={!!adding} onClose={() => setAdding(null)} title="New task">{adding && <TaskForm defaultDue={adding} onDone={() => setAdding(null)} />}</Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit task">{editing && <TaskForm task={editing} onDone={() => setEditing(null)} />}</Modal>
    </div>
  );
}
