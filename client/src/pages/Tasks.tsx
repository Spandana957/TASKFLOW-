import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckSquare, Plus, Search } from 'lucide-react';
import type { Priority, Task } from '../lib/api';
import { useTasks } from '../store';
import { Empty, Modal, Spinner } from '../components/ui';
import { TaskItem } from '../components/TaskItem';
import { TaskForm } from '../components/TaskForm';

const RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export default function Tasks() {
  const { tasks, loaded } = useTasks();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const [status, setStatus] = useState<'open' | 'all' | 'done' | 'in_progress'>('open');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [tag, setTag] = useState('all');
  const [sort, setSort] = useState<'due' | 'priority' | 'created'>('due');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const allTags = useMemo(() => [...new Set(tasks.flatMap((t) => t.tags))].sort(), [tasks]);
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const list = tasks.filter(
      (t) =>
        (status === 'all' || (status === 'open' ? t.status !== 'done' : t.status === status)) &&
        (priority === 'all' || t.priority === priority) &&
        (tag === 'all' || t.tags.includes(tag)) &&
        (!s || t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s) || t.tags.some((x) => x.toLowerCase().includes(s))),
    );
    return list.sort((a, b) =>
      sort === 'priority'
        ? RANK[a.priority] - RANK[b.priority]
        : sort === 'created'
          ? +new Date(b.createdAt) - +new Date(a.createdAt)
          : (a.dueDate ? +new Date(a.dueDate) : Infinity) - (b.dueDate ? +new Date(b.dueDate) : Infinity),
    );
  }, [tasks, search, status, priority, tag, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-page">Tasks</h1>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={18} /> New task</button>
      </div>

      <div className="card space-y-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder="Search by title, description or tag"
            value={search}
            onChange={(e) => setParams(e.target.value ? { search: e.target.value } : {}, { replace: true })}
            aria-label="Search tasks"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="done">Completed</option>
            <option value="all">All</option>
          </select>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority | 'all')} aria-label="Priority">
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="input" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
            <option value="all">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="due">Sort: due date</option>
            <option value="priority">Sort: priority</option>
            <option value="created">Sort: newest</option>
          </select>
        </div>
      </div>

      <div className="card">
        {!loaded ? <Spinner /> : filtered.length === 0 ? (
          <Empty icon={<CheckSquare />} title={tasks.length ? 'No tasks match these filters' : 'No tasks yet'} hint={tasks.length ? 'Try clearing a filter.' : 'Create your first task to get started.'} />
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-500">{filtered.length} task{filtered.length === 1 ? '' : 's'}</p>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((t) => <TaskItem key={t._id} task={t} onEdit={setEditing} />)}
            </div>
          </>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="New task"><TaskForm onDone={() => setAdding(false)} /></Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit task">{editing && <TaskForm task={editing} onDone={() => setEditing(null)} />}</Modal>
    </div>
  );
}
