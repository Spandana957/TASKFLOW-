import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { ah, requireAuth, signToken } from '../middleware/auth.js';
import { config, emailConfigured, pushConfigured } from '../config.js';
import { schedulerMode } from '../services/reminders.js';

const r = Router();

const publicUser = (u: InstanceType<typeof User>) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  settings: u.settings,
  createdAt: (u as unknown as { createdAt: Date }).createdAt,
});

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

r.post(
  '/register',
  ah(async (req, res) => {
    const body = registerSchema.parse(req.body);
    if (await User.exists({ email: body.email })) return res.status(409).json({ error: 'Email already registered' });
    const user = await User.create({
      name: body.name,
      email: body.email,
      passwordHash: await bcrypt.hash(body.password, 11),
    });
    res.status(201).json({ token: signToken(String(user._id)), user: publicUser(user) });
  }),
);

r.post(
  '/login',
  ah(async (req, res) => {
    const body = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string() }).parse(req.body);
    const user = await User.findOne({ email: body.email });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash)))
      return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken(String(user._id)), user: publicUser(user) });
  }),
);

r.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  }),
);

const settingsSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    theme: z.enum(['light', 'dark', 'system']),
    timezone: z.string().max(64),
    emailReminders: z.boolean(),
    browserNotifications: z.boolean(),
    defaultReminderMinutes: z.number().int().min(0).max(10080),
    pomodoroMinutes: z.number().int().min(1).max(180),
    shortBreakMinutes: z.number().int().min(1).max(60),
    longBreakMinutes: z.number().int().min(1).max(120),
    dailyTaskGoal: z.number().int().min(1).max(100),
    weeklyFocusGoalMinutes: z.number().int().min(10).max(10080),
  })
  .partial();

r.patch(
  '/settings',
  requireAuth,
  ah(async (req, res) => {
    const { name, ...settings } = settingsSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (name) update.name = name;
    for (const [k, v] of Object.entries(settings)) update[`settings.${k}`] = v;
    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  }),
);

/** Lets the UI show honestly which integrations are configured. */
r.get('/integrations', requireAuth, (_req, res) => {
  res.json({
    email: emailConfigured(),
    push: pushConfigured(),
    vapidPublicKey: pushConfigured() ? config.vapidPublicKey : null,
    scheduler: schedulerMode(),
  });
});

r.post(
  '/push-subscriptions',
  requireAuth,
  ah(async (req, res) => {
    const sub = z
      .object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) })
      .parse(req.body);
    await User.updateOne({ _id: req.userId }, { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } });
    await User.updateOne({ _id: req.userId }, { $push: { pushSubscriptions: sub } });
    res.status(201).json({ ok: true });
  }),
);

r.delete(
  '/push-subscriptions',
  requireAuth,
  ah(async (req, res) => {
    const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
    await User.updateOne({ _id: req.userId }, { $pull: { pushSubscriptions: { endpoint } } });
    res.json({ ok: true });
  }),
);

export default r;
