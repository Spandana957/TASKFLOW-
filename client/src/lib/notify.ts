import { api, type AppNotification, type Integrations } from './api';

/** Shows a native browser notification for new in-app notifications (when permitted). */
export function showBrowserNotification(n: AppNotification) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(`⏰ ${n.title}`, { body: n.body, icon: '/icon.svg', tag: n._id });
  } catch {
    /* some mobile browsers only allow notifications via service worker */
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushResult = 'subscribed' | 'permission-only' | 'denied' | 'unsupported';

/**
 * Requests notification permission and, if the server has VAPID keys configured,
 * registers a Web Push subscription so reminders arrive even when the tab is closed.
 */
export async function enableBrowserNotifications(): Promise<PushResult> {
  if (!('Notification' in window)) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'permission-only';
  const integ = await api<Integrations>('/auth/integrations');
  if (!integ.vapidPublicKey) return 'permission-only';
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(integ.vapidPublicKey) }));
  await api('/auth/push-subscriptions', { method: 'POST', body: sub.toJSON() });
  return 'subscribed';
}
