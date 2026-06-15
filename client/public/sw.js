// v7 — Smarter caching: cache-first for hashed bundles, network-first for pages.
// Service worker is disabled for the native Capacitor app (TMGStaffApp
// user agent). It runs only in normal browsers for PWA offline support.
//
// Bumping the cache version forces this worker to activate (skipWaiting +
// clients.claim) and drop every previous cache, so a returning visitor stops
// serving a stale app shell that points at chunk filenames a new deploy
// removed.

const CACHE_STATIC  = 'tmg-static-v7';   // hashed JS/CSS/font bundles — cache-first
const CACHE_DYNAMIC = 'tmg-dynamic-v7';  // pages & images — network-first

const PRECACHE_PAGES = [
  '/',
  '/estimate',
];

// On install: warm the page cache and immediately activate
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_DYNAMIC)
      .then(c => c.addAll(PRECACHE_PAGES))
      .then(() => self.skipWaiting())
  );
});

// On activate: drop all old caches
self.addEventListener('activate', e => {
  const KEEP = [CACHE_STATIC, CACHE_DYNAMIC];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // 1. Never intercept API calls — always fresh from server
  if (url.pathname.startsWith('/api/')) return;

  // 2. Non-GET requests pass straight through
  if (request.method !== 'GET') return;

  // 3. Hashed asset bundles (/assets/*.js, /assets/*.css, /fonts/*.woff2)
  //    These filenames contain a content hash — safe to cache forever (cache-first)
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(
      caches.open(CACHE_STATIC).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      })
    );
    return;
  }

  // 4. Work gallery images (/work/*.jpg) — cache-first, 7-day TTL
  if (url.pathname.startsWith('/work/')) {
    e.respondWith(
      caches.open(CACHE_DYNAMIC).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      })
    );
    return;
  }

  // 5. Everything else (HTML pages, icons, manifest) — network-first, cache fallback
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

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
