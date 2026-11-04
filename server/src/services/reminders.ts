import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config.js';
import { Notification, Reminder, User } from '../models/index.js';
import { sendReminderEmail } from './email.js';
import { sendPush } from './push.js';

/**
 * Server-side reminder scheduling.
 * - With REDIS_URL: BullMQ delayed jobs (jobId = reminder id → no duplicate jobs).
 * - Without Redis: a MongoDB poller runs every 30s.
 * In both modes `deliverReminder` claims the reminder atomically
 * (scheduled → processing) so a reminder can never be delivered twice.
 */

const QUEUE = 'taskflow-reminders';
let queue: Queue | null = null;
let worker: Worker | null = null;
let poller: NodeJS.Timeout | null = null;

export function schedulerMode() {
  return queue ? 'bullmq' : poller ? 'mongo-poller' : 'stopped';
}

export async function deliverReminder(reminderId: string) {
  const reminder = await Reminder.findOneAndUpdate(
    { _id: reminderId, status: 'scheduled', remindAt: { $lte: new Date(Date.now() + 5_000) } },
    { $set: { status: 'processing' }, $inc: { attempts: 1 } },
    { new: true },
  );
  if (!reminder) return null; // cancelled, snoozed, rescheduled, or already delivered
  const user = await User.findById(reminder.user);
  if (!user) {
    reminder.status = 'failed';
    await reminder.save();
    return reminder;
  }

  // In-app notification history
  if (reminder.channels?.inApp !== false) {
    await Notification.create({
      user: user._id,
      reminder: reminder._id,
      title: reminder.title,
      body: reminder.message || 'Reminder due now',
    });
  }

  // Email — recipient is always the authenticated user's registered email.
  if (reminder.channels?.email !== false && user.settings?.emailReminders !== false) {
    const result = await sendReminderEmail({
      to: user.email,
      name: user.name,
      title: reminder.title,
      message: reminder.message ?? '',
      when: reminder.remindAt,
      idempotencyKey: `reminder-${reminder._id}-${reminder.snoozeCount}`,
    });
    reminder.emailStatus = result.status;
    if (result.status === 'sent') reminder.emailId = result.id;
    if (result.status === 'failed') reminder.emailError = result.error;
    if (result.status === 'not_configured')
      reminder.emailError = 'RESEND_API_KEY / EMAIL_FROM not configured on the server';
  } else {
    reminder.emailStatus = 'skipped';
  }

  // Browser push
  if (reminder.channels?.push !== false && user.settings?.browserNotifications !== false) {
    reminder.pushStatus = await sendPush(String(user._id), {
      title: `⏰ ${reminder.title}`,
      body: reminder.message || 'Reminder due now',
      url: '/#/reminders',
    });
  } else reminder.pushStatus = 'skipped';

  const emailWanted = reminder.emailStatus !== 'skipped';
  const emailOk = reminder.emailStatus === 'sent';
  reminder.status = !emailWanted || emailOk ? 'sent' : reminder.channels?.inApp !== false ? 'partial' : 'failed';
  reminder.sentAt = new Date();
  await reminder.save();
  return reminder;
}

export async function scheduleReminder(reminderId: string, remindAt: Date) {
  if (!queue) return; // poller picks it up
  const jobId = `r-${reminderId}`;
  const existing = await queue.getJob(jobId);
  if (existing) await existing.remove().catch(() => undefined);
  await queue.add(
    'deliver',
    { reminderId },
    { jobId, delay: Math.max(0, remindAt.getTime() - Date.now()), removeOnComplete: true, removeOnFail: 100 },
  );
}

export async function unscheduleReminder(reminderId: string) {
  if (!queue) return;
  const job = await queue.getJob(`r-${reminderId}`);
  if (job) await job.remove().catch(() => undefined);
}

async function pollDue() {
  const due = await Reminder.find({ status: 'scheduled', remindAt: { $lte: new Date() } })
    .select('_id')
    .limit(100);
  for (const r of due) await deliverReminder(String(r._id)).catch((e) => console.error('[reminders]', e));
}

export async function startScheduler() {
  if (config.redisUrl) {
    try {
      const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
      await connection.ping();
      queue = new Queue(QUEUE, { connection });
      worker = new Worker(QUEUE, async (job) => deliverReminder(job.data.reminderId), { connection });
      worker.on('failed', (job, err) => console.error('[reminders] job failed', job?.id, err.message));
      // Re-enqueue anything scheduled (e.g. after Redis flush) — jobId dedupes.
      const pending = await Reminder.find({ status: 'scheduled' }).select('_id remindAt');
      for (const r of pending) await scheduleReminder(String(r._id), r.remindAt);
      console.log('[reminders] BullMQ scheduler running');
      return;
    } catch (e) {
      console.warn('[reminders] Redis unavailable, falling back to MongoDB poller:', (e as Error).message);
      queue = null;
    }
  }
  poller = setInterval(() => void pollDue(), 30_000);
  void pollDue();
  console.log('[reminders] MongoDB poller running (30s interval)');
}

export async function stopScheduler() {
  if (poller) clearInterval(poller);
  poller = null;
  await worker?.close();
  await queue?.close();
}
