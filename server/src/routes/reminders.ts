import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Notification, Reminder, Task } from '../models/index.js';
import { ah } from '../middleware/auth.js';
import { scheduleReminder, unscheduleReminder } from '../services/reminders.js';

const r = Router();

const createBody = z.object({
  taskId: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(200).optional(),
  message: z.string().max(1000).optional(),
  remindAt: z.coerce.date(),
  channels: z.object({ email: z.boolean(), push: z.boolean(), inApp: z.boolean() }).partial().optional(),
});

r.get(
  '/',
  ah(async (req, res) => {
    const reminders = await Reminder.find({ user: req.userId }).sort({ remindAt: -1 }).limit(300).lean();
    res.json({ reminders });
  }),
);

r.post(
  '/',
  ah(async (req, res) => {
    const body = createBody.parse(req.body);
    if (body.remindAt.getTime() < Date.now() - 60_000)
      return res.status(400).json({ error: 'Reminder time must be in the future' });
    let title = body.title;
    let taskId: Types.ObjectId | null = null;
    if (body.taskId) {
      if (!Types.ObjectId.isValid(body.taskId)) return res.status(404).json({ error: 'Task not found' });
      const task = await Task.findOne({ _id: body.taskId, user: req.userId });
      if (!task) return res.status(404).json({ error: 'Task not found' });
      taskId = task._id;
      title = title ?? task.title;
    }
    if (!title) return res.status(400).json({ error: 'Title is required' });
    // Duplicate prevention: one active reminder per task/title at the same minute.
    const minute = Math.floor(body.remindAt.getTime() / 60_000);
    const dedupeKey = `${taskId ?? title.toLowerCase()}@${minute}`;
    const existing = await Reminder.findOne({ user: req.userId, dedupeKey });
    if (existing && existing.status === 'scheduled')
      return res.status(409).json({ error: 'A reminder already exists for that time', reminder: existing });
    if (existing) await existing.deleteOne(); // allow re-creating a cancelled/sent slot
    const reminder = await Reminder.create({
      user: req.userId,
      task: taskId,
      title,
      message: body.message ?? '',
      remindAt: body.remindAt,
      channels: { email: true, push: true, inApp: true, ...body.channels },
      dedupeKey,
    });
    await scheduleReminder(String(reminder._id), reminder.remindAt);
    res.status(201).json({ reminder });
  }),
);

r.post(
  '/:id/cancel',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Reminder not found' });
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, user: req.userId, status: 'scheduled' },
      { $set: { status: 'cancelled' } },
      { new: true },
    );
    if (!reminder) return res.status(404).json({ error: 'No scheduled reminder found' });
    await unscheduleReminder(String(reminder._id));
    res.json({ reminder });
  }),
);

r.post(
  '/:id/snooze',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Reminder not found' });
    const { minutes } = z.object({ minutes: z.number().int().min(1).max(1440) }).parse(req.body);
    const reminder = await Reminder.findOne({ _id: req.params.id, user: req.userId });
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    if (reminder.status === 'processing') return res.status(409).json({ error: 'Reminder is being delivered' });
    reminder.remindAt = new Date(Date.now() + minutes * 60_000);
    reminder.status = 'scheduled';
    reminder.snoozeCount += 1;
    reminder.emailStatus = 'pending';
    reminder.pushStatus = 'pending';
    reminder.emailError = null;
    reminder.sentAt = null;
    reminder.dedupeKey = `${reminder.dedupeKey.split('#')[0]}#snooze${reminder.snoozeCount}`;
    await reminder.save();
    await scheduleReminder(String(reminder._id), reminder.remindAt);
    res.json({ reminder });
  }),
);

r.delete(
  '/:id',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Reminder not found' });
    const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!reminder) return res.status(404).json({ error: 'Reminder not found' });
    await unscheduleReminder(String(reminder._id));
    res.json({ ok: true });
  }),
);

/* ---------- notification history ---------- */
export const notifications = Router();

notifications.get(
  '/',
  ah(async (req, res) => {
    const items = await Notification.find({ user: req.userId }).sort({ createdAt: -1 }).limit(100).lean();
    const unread = await Notification.countDocuments({ user: req.userId, read: false });
    res.json({ notifications: items, unread });
  }),
);

notifications.post(
  '/read-all',
  ah(async (req, res) => {
    await Notification.updateMany({ user: req.userId, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  }),
);

notifications.post(
  '/:id/read',
  ah(async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    await Notification.updateOne({ _id: req.params.id, user: req.userId }, { $set: { read: true } });
    res.json({ ok: true });
  }),
);

export default r;
