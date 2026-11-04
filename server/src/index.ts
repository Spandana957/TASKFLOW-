import mongoose from 'mongoose';
import { config, emailConfigured } from './config.js';
import { createApp } from './app.js';
import { startScheduler, stopScheduler } from './services/reminders.js';

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('[db] connected');
  if (!emailConfigured()) console.warn('[email] RESEND_API_KEY/EMAIL_FROM not set — email reminders will be recorded as not_configured');
  await startScheduler();
  const server = createApp().listen(config.port, () => console.log(`[api] http://localhost:${config.port}`));
  const shutdown = async () => {
    server.close();
    await stopScheduler();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
