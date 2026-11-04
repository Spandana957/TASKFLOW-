// TaskFlow service worker — receives Web Push reminders.
self.addEventListener('push', (event) => {
  let data = { title: 'TaskFlow', body: 'You have a reminder', url: '/' };
  try { data = { ...data, ...event.data.json() }; } catch (e) { /* plain payload */ }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data: { url: data.url }, icon: '/icon.svg' }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus(); }
      return clients.openWindow(url);
    }),
  );
});
