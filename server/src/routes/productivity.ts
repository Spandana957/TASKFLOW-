import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Goal, Task, TimeEntry, User } from '../models/index.js';
import { ah } from '../middleware/auth.js';
import { startOfDay, startOfWeek } from '../services/recurrence.js';

/* ---------- Time tracking ---------- */
export const time = Router();

time.get(
  '/',
  ah(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 30 * 864e5);
    const entries = await TimeEntry.find({ user: req.userId, startedAt: { $gte: from } })
      .sort({ startedAt: -1 })
      .limit(500)
      .populate('task', 'title')
      .lean();
    res.json({ entries });
  }),
);

time.post(
  '/',
  ah(async (req, res) => {
    const body = z
      .object({
        taskId: z.string().nullable().optional(),
        kind: z.enum(['pomodoro', 'stopwatch', 'manual']),
        startedAt: z.coerce.date(),
        endedAt: z.coerce.date(),
        note: z.string().max(500).optional(),
      })
      .parse(req.body);
    const minutes = Math.round(((body.endedAt.getTime() - body.startedAt.getTime()) / 60_000) * 10) / 10;
    if (minutes <= 0 || minutes > 24 * 60) return res.status(400).json({ error: 'Invalid duration' });
    let task = null;
    if (body.taskId) {
      if (!Types.ObjectId.isValid(body.taskId)) return res.status(404).json({ error: 'Task not found' });
      task = await Task.findOneAndUpdate(
        { _id: body.taskId, user: req.userId },
        { $inc: { trackedMinutes: minutes } },
        { new: true },
      );
      if (!task) return res.status(404).json({ error: 'Task not found' });
    }
    const entry = await TimeEntry.create({
      user: req.userId,
      task: task?._id ?? null,
      kind: body.kind,
      startedAt: body.startedAt,
      endedAt: body.endedAt,
      minutes,
      note: body.note ?? '',
    });
    res.status(201).json({ entry });
  }),
);

time.delete(
  '/:id',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const entry = await TimeEntry.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.task) await Task.updateOne({ _id: entry.task, user: req.userId }, { $inc: { trackedMinutes: -entry.minutes } });
    res.json({ ok: true });
  }),
);

/* ---------- Goals ---------- */
export const goals = Router();

async function goalProgress(userId: string, g: { metric: string; period: string; manualProgress: number }) {
  const from = g.period === 'daily' ? startOfDay() : startOfWeek();
  if (g.metric === 'tasks_completed')
    return Task.countDocuments({ user: userId, status: 'done', completedAt: { $gte: from } });
  if (g.metric === 'focus_minutes') {
    const [agg] = await TimeEntry.aggregate([
      { $match: { user: new Types.ObjectId(userId), startedAt: { $gte: from } } },
      { $group: { _id: null, m: { $sum: '$minutes' } } },
    ]);
    return Math.round(agg?.m ?? 0);
  }
  return g.manualProgress;
}

goals.get(
  '/',
  ah(async (req, res) => {
    const list = await Goal.find({ user: req.userId }).sort({ createdAt: -1 }).lean();
    const out = [];
    for (const g of list) {
      // Custom goals reset at the start of each new period.
      const currentStart = g.period === 'daily' ? startOfDay() : startOfWeek();
      if (g.metric === 'custom' && new Date(g.periodStart) < currentStart) {
        await Goal.updateOne({ _id: g._id }, { $set: { manualProgress: 0, periodStart: currentStart } });
        g.manualProgress = 0;
      }
      out.push({ ...g, progress: await goalProgress(req.userId!, g) });
    }
    res.json({ goals: out });
  }),
);

const goalBody = z.object({
  title: z.string().trim().min(1).max(120),
  period: z.enum(['daily', 'weekly']),
  metric: z.enum(['tasks_completed', 'focus_minutes', 'custom']),
  target: z.number().int().min(1).max(100000),
});

goals.post(
  '/',
  ah(async (req, res) => {
    const body = goalBody.parse(req.body);
    const goal = await Goal.create({
      ...body,
      user: req.userId,
      periodStart: body.period === 'daily' ? startOfDay() : startOfWeek(),
    });
    res.status(201).json({ goal });
  }),
);

goals.patch(
  '/:id',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Goal not found' });
    const body = goalBody.partial().extend({ manualProgress: z.number().int().min(0).optional() }).parse(req.body);
    const goal = await Goal.findOneAndUpdate({ _id: req.params.id, user: req.userId }, { $set: body }, { new: true });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json({ goal });
  }),
);

goals.delete(
  '/:id',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Goal not found' });
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json({ ok: true });
  }),
);

/* ---------- Analytics (computed from real user data) ---------- */
export const analytics = Router();

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

analytics.get(
  '/',
  ah(async (req, res) => {
    const days = Math.min(90, Math.max(7, Number(req.query.days ?? 14)));
    const uid = new Types.ObjectId(req.userId);
    const since = startOfDay(new Date(Date.now() - (days - 1) * 864e5));
    const today = startOfDay();
    const tomorrow = new Date(today.getTime() + 864e5);
    const user = await User.findById(req.userId).lean();

    const [completed, created, entries, byPriority, totals, dueToday, doneToday, overdue] = await Promise.all([
      Task.find({ user: uid, status: 'done', completedAt: { $gte: since } }).select('completedAt').lean(),
      Task.find({ user: uid, createdAt: { $gte: since } }).select('createdAt').lean(),
      TimeEntry.find({ user: uid, startedAt: { $gte: since } }).select('startedAt minutes kind').lean(),
      Task.aggregate([{ $match: { user: uid, status: { $ne: 'done' } } }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Task.aggregate([{ $match: { user: uid } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.countDocuments({ user: uid, dueDate: { $gte: today, $lt: tomorrow } }),
      Task.countDocuments({ user: uid, status: 'done', completedAt: { $gte: today, $lt: tomorrow } }),
      Task.countDocuments({ user: uid, status: { $ne: 'done' }, dueDate: { $lt: today } }),
    ]);

    const series: Record<string, { date: string; completed: number; created: number; focusMinutes: number }> = {};
    for (let i = 0; i < days; i++) {
      const k = dayKey(new Date(since.getTime() + i * 864e5));
      series[k] = { date: k, completed: 0, created: 0, focusMinutes: 0 };
    }
    for (const t of completed) if (t.completedAt) series[dayKey(t.completedAt)] && series[dayKey(t.completedAt)].completed++;
    for (const t of created) {
      const k = dayKey((t as unknown as { createdAt: Date }).createdAt);
      if (series[k]) series[k].created++;
    }
    for (const e of entries) {
      const k = dayKey(e.startedAt);
      if (series[k]) series[k].focusMinutes += e.minutes;
    }
    const daily = Object.values(series).map((d) => ({ ...d, focusMinutes: Math.round(d.focusMinutes) }));

    // Streak: consecutive days (ending today or yesterday) with ≥1 completed task.
    let streak = 0;
    for (let i = daily.length - 1; i >= 0; i--) {
      if (daily[i].completed > 0) streak++;
      else if (i === daily.length - 1) continue;
      else break;
    }

    const weekStart = startOfWeek();
    const focusToday = entries.filter((e) => e.startedAt >= today).reduce((s, e) => s + e.minutes, 0);
    const focusWeek = entries.filter((e) => e.startedAt >= weekStart).reduce((s, e) => s + e.minutes, 0);
    const statusCounts = Object.fromEntries(totals.map((t) => [t._id, t.count]));

    res.json({
      daily,
      byPriority: ['urgent', 'high', 'medium', 'low'].map((p) => ({
        priority: p,
        count: byPriority.find((b) => b._id === p)?.count ?? 0,
      })),
      totals: {
        todo: statusCounts.todo ?? 0,
        in_progress: statusCounts.in_progress ?? 0,
        done: statusCounts.done ?? 0,
      },
      today: {
        due: dueToday,
        completed: doneToday,
        overdue,
        focusMinutes: Math.round(focusToday),
        goal: user?.settings?.dailyTaskGoal ?? 5,
      },
      week: { focusMinutes: Math.round(focusWeek), focusGoal: user?.settings?.weeklyFocusGoalMinutes ?? 600 },
      streak,
      pomodoros: entries.filter((e) => e.kind === 'pomodoro').length,
    });
  }),
);
