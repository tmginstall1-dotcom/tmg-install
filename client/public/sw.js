// v9 — NO-CACHE service worker (push-only; never serves the app from cache).
//
// WHY THIS IS NOT A CACHING WORKER ANYMORE:
// Earlier versions cached the app shell (index.html + hashed JS chunks) for
// offline use. On installed iOS PWAs this repeatedly stranded users on a STALE
// index.html that referenced chunk files a later deploy had already removed,
// producing the "Something went wrong / Please reload to get the latest
// version" crash. Apple's PWA engine updates a pinned service worker so
// unreliably that no amount of smarter caching could clear it remotely.
//
// THE FIX: stop intercepting requests entirely. With NO `fetch` handler the
// browser loads every navigation and script straight from the network. The
// server already sends `no-cache` for index.html and `immutable` for the
// content-hashed /assets bundles, so pages are always fresh and the
// stale-shell crash becomes structurally impossible. Offline browsing is
// intentionally dropped — for an ops/admin tool, always-fresh reliability
// matters far more, and the native Capacitor staff app handles its own
// offline data separately.
//
// We keep the service worker registered ONLY so Web Push notifications
// (WhatsApp message alerts in the admin) keep working — push requires an
// active worker but does NOT require a fetch handler.
//
// The worker is disabled for the native Capacitor app (TMGStaffApp user
// agent); registration is gated off in index.html for that case.

// On install: activate immediately, don't wait for old worker to release.
self.addEventListener('install', () => {
  self.skipWaiting();
});

// On activate: delete EVERY cache left behind by the old caching workers, take
// control, and reload all open windows so any page currently showing a stale
// cached shell re-fetches fresh from the network under this no-cache worker.
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Did this device have caches from an OLD caching worker? If so this is an
    // UPGRADE from a worker that may have stranded the page on a stale shell, so
    // we reload windows below. On a brand-new first install there are no caches,
    // so we skip the reload and don't disturb a first-time visitor.
    let hadOldCaches = false;
    try {
      const keys = await caches.keys();
      hadOldCaches = keys.length > 0;
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (err) {}
    try {
      await self.clients.claim();
    } catch (err) {}
    // Reload open windows so a pinned client that was serving a stale shell
    // (esp. an installed iOS PWA) recovers automatically once this worker wins.
    if (hadOldCaches) {
      try {
        const windows = await self.clients.matchAll({ type: 'window' });
        for (const client of windows) {
          try { client.navigate(client.url); } catch (err) {}
        }
      } catch (err) {}
    }
  })());
});

// NOTE: there is deliberately NO `fetch` handler. The worker does not intercept
// any request, so the browser always goes to the network (correctly cached by
// HTTP headers). This is what guarantees the app can never be served stale.

// ── Web Push — show notification when a WhatsApp message arrives ────────────
self.addEventListener('push', e => {
  if (!e.data) return;

  let payload = { title: 'TMG Admin', body: 'New message received', url: '/admin/conversations', tag: 'wa-message' };
  try { payload = { ...payload, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body:     payload.body,
      icon:     '/icon-192.png',
      badge:    '/favicon.png',
      tag:      payload.tag || 'wa-message',
      renotify: true,
      data:     { url: payload.url || '/admin/conversations' },
      actions:  [{ action: 'open', title: 'Open Chat' }],
    })
  );
});

// ── Notification tap — open the admin conversations page ───────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || '/admin/conversations';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
