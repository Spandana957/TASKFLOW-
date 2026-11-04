import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { PRIORITIES, RECURRENCES, Reminder, Task } from '../models/index.js';
import { ah } from '../middleware/auth.js';
import { nextOccurrence, type Recurrence } from '../services/recurrence.js';
import { unscheduleReminder } from '../services/reminders.js';

const r = Router();

const taskBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  estimatedMinutes: z.number().int().min(0).max(10000).optional(),
  recurrence: z.enum(RECURRENCES).optional(),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

r.get(
  '/',
  ah(async (req, res) => {
    const q = z
      .object({
        search: z.string().optional(),
        status: z.enum(['todo', 'in_progress', 'done', 'open']).optional(),
        priority: z.enum(PRIORITIES).optional(),
        tag: z.string().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        sort: z.enum(['dueDate', 'priority', 'createdAt']).optional(),
      })
      .parse(req.query);
    const filter: Record<string, unknown> = { user: req.userId };
    if (q.status === 'open') filter.status = { $ne: 'done' };
    else if (q.status) filter.status = q.status;
    if (q.priority) filter.priority = q.priority;
    if (q.tag) filter.tags = q.tag;
    if (q.from || q.to) filter.dueDate = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    if (q.search) {
      const rx = new RegExp(escapeRegex(q.search), 'i');
      filter.$or = [{ title: rx }, { description: rx }, { tags: rx }];
    }
    const tasks = await Task.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
    const rank = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
    if (q.sort === 'priority') tasks.sort((a, b) => rank[a.priority] - rank[b.priority]);
    if (q.sort === 'dueDate')
      tasks.sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
    res.json({ tasks });
  }),
);

r.post(
  '/',
  ah(async (req, res) => {
    const body = taskBody.parse(req.body);
    const task = await Task.create({ ...body, user: req.userId });
    res.status(201).json({ task });
  }),
);

r.get(
  '/:id',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Task not found' });
    const task = await Task.findOne({ _id: req.params.id, user: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  }),
);

r.patch(
  '/:id',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Task not found' });
    const body = taskBody.partial().parse(req.body);
    const task = await Task.findOne({ _id: req.params.id, user: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const wasDone = task.status === 'done';
    Object.assign(task, body);
    let spawned = null;
    if (!wasDone && task.status === 'done') {
      task.completedAt = new Date();
      // Recurring: create the next occurrence when completed.
      const next = nextOccurrence(task.dueDate ?? new Date(), task.recurrence as Recurrence);
      if (next) {
        spawned = await Task.create({
          user: task.user,
          title: task.title,
          description: task.description,
          priority: task.priority,
          tags: task.tags,
          estimatedMinutes: task.estimatedMinutes,
          recurrence: task.recurrence,
          recurrenceParent: task.recurrenceParent ?? task._id,
          dueDate: next,
        });
      }
    } else if (wasDone && task.status !== 'done') task.completedAt = null;
    await task.save();
    res.json({ task, spawned });
  }),
);

r.delete(
  '/:id',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Task not found' });
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const reminders = await Reminder.find({ task: task._id, user: req.userId, status: 'scheduled' });
    for (const rem of reminders) {
      rem.status = 'cancelled';
      await rem.save();
      await unscheduleReminder(String(rem._id));
    }
    res.json({ ok: true });
  }),
);

export default r;
