// v5 — Force cache refresh; fee label updated to Mobilisation & Coordination everywhere.
// Service worker is disabled for the native Capacitor app (TMGStaffApp
// user agent). It runs only in normal browsers for PWA offline support.

const CACHE = 'tmg-v5';

const PRECACHE = [
  '/',
  '/admin',
  '/staff/login',
  '/staff',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for API calls — never serve stale data
  if (url.pathname.startsWith('/api/')) return;

  // For everything else: try network first, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Web Push — show notification when a WhatsApp message arrives ────────────
self.addEventListener('push', e => {
  if (!e.data) return;

  let payload = { title: 'TMG Admin', body: 'New message received', url: '/admin/conversations', tag: 'wa-message' };
  try { payload = { ...payload, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body:    payload.body,
      icon:    '/icon-192.png',
      badge:   '/favicon.png',
      tag:     payload.tag || 'wa-message',
      renotify: true,
      data:    { url: payload.url || '/admin/conversations' },
      actions: [{ action: 'open', title: 'Open Chat' }],
    })
  );
});

// ── Notification tap — open the admin conversations page ───────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || '/admin/conversations';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // If an admin tab is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
