import { useState, type FormEvent } from 'react';
import { api, toLocalInput, type Priority, type Recurrence, type Task } from '../lib/api';
import { errMsg, toast, useAuth, useTasks } from '../store';

export function TaskForm({ task, defaultDue, onDone }: { task?: Task; defaultDue?: Date; onDone: () => void }) {
  const { create, update } = useTasks();
  const user = useAuth((s) => s.user);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [due, setDue] = useState(task?.dueDate ? toLocalInput(new Date(task.dueDate)) : defaultDue ? toLocalInput(defaultDue) : '');
  const [recurrence, setRecurrence] = useState<Recurrence>(task?.recurrence ?? 'none');
  const [estimate, setEstimate] = useState(String(task?.estimatedMinutes ?? ''));
  const [tags, setTags] = useState(task?.tags.join(', ') ?? '');
  const [remind, setRemind] = useState(false);
  const [remindMins, setRemindMins] = useState(String(user?.settings.defaultReminderMinutes ?? 15));
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const body = {
      title: title.trim(),
      description,
      priority,
      dueDate: due ? new Date(due).toISOString() : null,
      recurrence,
      estimatedMinutes: Number(estimate) || 0,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      const saved = task ? (await update(task._id, body), task) : await create(body);
      if (remind && due) {
        const at = new Date(new Date(due).getTime() - Number(remindMins) * 60_000);
        if (at.getTime() > Date.now()) {
          await api('/reminders', { method: 'POST', body: { taskId: saved._id, remindAt: at.toISOString() } });
          toast(`Reminder set for ${at.toLocaleString()}`, 'success');
        } else toast('Reminder time is in the past — not scheduled', 'error');
      }
      toast(task ? 'Task updated' : 'Task created', 'success');
      onDone();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label" htmlFor="tf-title">Title</label>
        <input id="tf-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor="tf-desc">Description</label>
        <textarea id="tf-desc" className="input min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="tf-pri">Priority</label>
          <select id="tf-pri" className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tf-rec">Repeats</label>
          <select id="tf-rec" className="input" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="none">Never</option>
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="tf-due">Due</label>
          <input id="tf-due" type="datetime-local" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="tf-est">Estimate (min)</label>
          <input id="tf-est" type="number" min={0} className="input" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="tf-tags">Tags (comma separated)</label>
        <input id="tf-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="work, health" />
      </div>
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} disabled={!due} />
          Email & notify me
          <input type="number" min={0} className="input !w-20 !py-1" value={remindMins} onChange={(e) => setRemindMins(e.target.value)} disabled={!remind} />
          min before due
        </label>
        {!due && <p className="mt-1 text-xs text-slate-500">Set a due time to add a reminder.</p>}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button>
      </div>
    </form>
  );
}
