import mongoose, { Schema, Types, type InferSchemaType } from 'mongoose';

/* ---------- User ---------- */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    settings: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      timezone: { type: String, default: 'UTC' },
      emailReminders: { type: Boolean, default: true },
      browserNotifications: { type: Boolean, default: true },
      defaultReminderMinutes: { type: Number, default: 15 },
      pomodoroMinutes: { type: Number, default: 25 },
      shortBreakMinutes: { type: Number, default: 5 },
      longBreakMinutes: { type: Number, default: 15 },
      dailyTaskGoal: { type: Number, default: 5 },
      weeklyFocusGoalMinutes: { type: Number, default: 600 },
    },
    pushSubscriptions: [{ endpoint: String, keys: { p256dh: String, auth: String } }],
  },
  { timestamps: true },
);
export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = mongoose.model('User', userSchema);

/* ---------- Task ---------- */
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const RECURRENCES = ['none', 'daily', 'weekdays', 'weekly', 'monthly'] as const;

const taskSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
    tags: [{ type: String, trim: true }],
    dueDate: { type: Date, default: null },
    estimatedMinutes: { type: Number, default: 0 },
    trackedMinutes: { type: Number, default: 0 },
    recurrence: { type: String, enum: RECURRENCES, default: 'none' },
    recurrenceParent: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
taskSchema.index({ user: 1, dueDate: 1 });
taskSchema.index({ title: 'text', description: 'text', tags: 'text' });
export const Task = mongoose.model('Task', taskSchema);

/* ---------- Note ---------- */
const noteSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Untitled', trim: true, maxlength: 200 },
    contentHtml: { type: String, default: '', maxlength: 200_000 },
    color: { type: String, default: 'default' },
    pinned: { type: Boolean, default: false },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true },
);
export const Note = mongoose.model('Note', noteSchema);

/* ---------- Reminder ---------- */
const reminderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    remindAt: { type: Date, required: true, index: true },
    channels: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
    status: {
      type: String,
      enum: ['scheduled', 'processing', 'sent', 'partial', 'failed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    // Unique key prevents duplicate reminders for the same task + time.
    dedupeKey: { type: String, required: true },
    snoozeCount: { type: Number, default: 0 },
    emailStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'skipped', 'not_configured'],
      default: 'pending',
    },
    emailId: { type: String, default: null },
    emailError: { type: String, default: null },
    pushStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    sentAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);
reminderSchema.index({ user: 1, dedupeKey: 1 }, { unique: true });
export const Reminder = mongoose.model('Reminder', reminderSchema);

/* ---------- Notification (in-app history) ---------- */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reminder: { type: Schema.Types.ObjectId, ref: 'Reminder', default: null },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    type: { type: String, enum: ['reminder', 'system'], default: 'reminder' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Notification = mongoose.model('Notification', notificationSchema);

/* ---------- Time entries (focus sessions / tracking) ---------- */
const timeEntrySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    kind: { type: String, enum: ['pomodoro', 'stopwatch', 'manual'], default: 'stopwatch' },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    minutes: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);
timeEntrySchema.index({ user: 1, startedAt: -1 });
export const TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);

/* ---------- Goals ---------- */
const goalSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    period: { type: String, enum: ['daily', 'weekly'], required: true },
    metric: { type: String, enum: ['tasks_completed', 'focus_minutes', 'custom'], default: 'custom' },
    target: { type: Number, required: true, min: 1 },
    manualProgress: { type: Number, default: 0 },
    periodStart: { type: Date, required: true },
  },
  { timestamps: true },
);
export const Goal = mongoose.model('Goal', goalSchema);
