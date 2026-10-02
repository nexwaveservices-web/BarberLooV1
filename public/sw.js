// BarberLoo Background Notification Service Worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from the main application thread (including background tabs)
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SHOW_BROWSER_NOTIFICATION') {
    const { title, body, tag, requireInteraction, payload } = data;
    event.waitUntil(
      self.registration.showNotification(title || 'BarberLoo Alert', {
        body: body || '',
        tag: tag || `barberloo-${Date.now()}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        requireInteraction: Boolean(requireInteraction),
        data: payload || { url: '/' },
      })
    );
  }
});

// Handle Web Push events if sent from push service
self.addEventListener('push', (event) => {
  let payload = {
    title: 'BarberLoo Update',
    body: 'You have a new queue or appointment alert.',
    tag: `barberloo-push-${Date.now()}`,
    requireInteraction: false,
    url: '/',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      requireInteraction: Boolean(payload.requireInteraction),
      data: { url: payload.url || '/' },
    })
  );
});

// Focus or open the BarberLoo app when the user clicks a browser notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: event.notification.data || {},
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
