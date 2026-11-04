import mongoose from 'mongoose';
import { config, emailConfigured } from './config.js';
import { createApp } from './app.js';
import { startScheduler, stopScheduler } from './services/reminders.js';

async function connectDb() {
  if (!config.mongoUri) {
    console.error('[db] MONGODB_URI is not set — API will return 503 until it is configured');
    return;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10_000 });
      console.log('[db] connected');
      await startScheduler();
      return;
    } catch (e) {
      console.error(`[db] connection attempt ${attempt} failed:`, (e as Error).message);
      await new Promise((r) => setTimeout(r, Math.min(30_000, attempt * 5_000)));
    }
  }
}

const server = createApp().listen(config.port, () => console.log(`[api] listening on ${config.port}`));
if (!emailConfigured()) console.warn('[email] RESEND_API_KEY/EMAIL_FROM not set — reminder emails will be recorded as not_configured');
void connectDb();

const shutdown = async () => {
  server.close();
  await stopScheduler();
  await mongoose.disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
