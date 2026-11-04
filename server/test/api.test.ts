import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { deliverReminder } from '../src/services/reminders.js';
import { Reminder } from '../src/models/index.js';

let mongo: MongoMemoryServer;
const app = createApp();

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

async function register(email: string) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Test', email, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

describe('TaskFlow API', () => {
  it('rejects unauthenticated access', async () => {
    expect((await request(app).get('/api/tasks')).status).toBe(401);
  });

  it('isolates tasks per user and spawns recurring tasks', async () => {
    const a = await register('a@example.com');
    const b = await register('b@example.com');
    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${a}`)
      .send({ title: 'Standup', priority: 'urgent', recurrence: 'daily', dueDate: '2026-01-01T09:00:00Z' });
    expect(created.status).toBe(201);
    const id = created.body.task._id;
    expect((await request(app).get(`/api/tasks/${id}`).set('Authorization', `Bearer ${b}`)).status).toBe(404);
    const done = await request(app).patch(`/api/tasks/${id}`).set('Authorization', `Bearer ${a}`).send({ status: 'done' });
    expect(done.body.spawned.dueDate).toBe('2026-01-02T09:00:00.000Z');
    const list = await request(app).get('/api/tasks?search=stand').set('Authorization', `Bearer ${a}`);
    expect(list.body.tasks).toHaveLength(2);
  });

  it('prevents duplicate reminders and never fakes email delivery', async () => {
    const t = await register('c@example.com');
    const when = new Date(Date.now() + 3600_000).toISOString();
    const r1 = await request(app).post('/api/reminders').set('Authorization', `Bearer ${t}`).send({ title: 'Call', remindAt: when });
    expect(r1.status).toBe(201);
    const r2 = await request(app).post('/api/reminders').set('Authorization', `Bearer ${t}`).send({ title: 'Call', remindAt: when });
    expect(r2.status).toBe(409);
    await Reminder.updateOne({ _id: r1.body.reminder._id }, { remindAt: new Date() });
    const delivered = await deliverReminder(r1.body.reminder._id);
    expect(delivered?.emailStatus).toBe('not_configured');
    expect(delivered?.status).toBe('partial');
    expect(await deliverReminder(r1.body.reminder._id)).toBeNull(); // no double delivery
    const n = await request(app).get('/api/notifications').set('Authorization', `Bearer ${t}`);
    expect(n.body.unread).toBe(1);
  });
});
