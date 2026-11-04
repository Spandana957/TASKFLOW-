import { Calendar, Clock, Pencil, Repeat, Trash2 } from 'lucide-react';
import { fmtDateTime, type Task } from '../lib/api';
import { errMsg, toast, useTasks } from '../store';
import { PriorityBadge } from './ui';

export function TaskItem({ task, onEdit, compact }: { task: Task; onEdit?: (t: Task) => void; compact?: boolean }) {
  const { update, remove } = useTasks();
  const done = task.status === 'done';
  const overdue = !done && task.dueDate && new Date(task.dueDate) < new Date();

  const toggle = () => update(task._id, { status: done ? 'todo' : 'done' }).catch((e) => toast(errMsg(e), 'error'));
  const del = async () => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await remove(task._id);
      toast('Task deleted');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-800/40">
      <button
        onClick={toggle}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${done ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:border-brand-500 dark:border-slate-600'}`}
      >
        {done && <svg viewBox="0 0 16 16" className="h-3 w-3"><path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" /></svg>}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`break-words font-medium ${done ? 'text-slate-400 line-through' : ''}`}>{task.title}</p>
        {!compact && task.description && <p className="mt-0.5 line-clamp-2 break-words text-sm text-slate-500">{task.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <PriorityBadge p={task.priority} />
          {task.dueDate && (
            <span className={`chip ${overdue ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <Calendar size={12} /> {fmtDateTime(task.dueDate)}
            </span>
          )}
          {task.recurrence !== 'none' && <span className="chip bg-slate-100 dark:bg-slate-800"><Repeat size={12} /> {task.recurrence}</span>}
          {(task.trackedMinutes > 0 || task.estimatedMinutes > 0) && (
            <span className="chip bg-slate-100 dark:bg-slate-800">
              <Clock size={12} /> {Math.round(task.trackedMinutes)}{task.estimatedMinutes ? `/${task.estimatedMinutes}` : ''}m
            </span>
          )}
          {!compact && task.tags.map((t) => <span key={t} className="chip bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">#{t}</span>)}
        </div>
      </div>
      {onEdit && (
        <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button className="btn-ghost !p-1.5" onClick={() => onEdit(task)} aria-label="Edit task"><Pencil size={15} /></button>
          <button className="btn-danger !p-1.5" onClick={del} aria-label="Delete task"><Trash2 size={15} /></button>
        </div>
      )}
    </div>
  );
}
