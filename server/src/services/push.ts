import webpush from 'web-push';
import { config, pushConfigured } from '../config.js';
import { User } from '../models/index.js';

let initialised = false;
function init() {
  if (!initialised && pushConfigured()) {
    webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
    initialised = true;
  }
  return initialised;
}

/** Sends a Web Push to every subscription of a user. Removes expired subscriptions. */
export async function sendPush(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!init()) return 'skipped' as const;
  const user = await User.findById(userId);
  if (!user || user.pushSubscriptions.length === 0) return 'skipped' as const;
  let delivered = 0;
  const stale: string[] = [];
  for (const sub of user.pushSubscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint!, keys: { p256dh: sub.keys!.p256dh!, auth: sub.keys!.auth! } },
        JSON.stringify(payload),
      );
      delivered++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) stale.push(sub.endpoint!);
    }
  }
  if (stale.length) {
    await User.updateOne({ _id: userId }, { $pull: { pushSubscriptions: { endpoint: { $in: stale } } } });
  }
  return delivered > 0 ? ('sent' as const) : ('failed' as const);
}
