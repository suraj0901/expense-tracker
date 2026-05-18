/**
 * Service worker — Workbox precaching + runtime caching + periodic background sync.
 *
 * The vite-plugin-pwa injectManifest plugin injects self.__WB_MANIFEST
 * with the list of files to precache.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ─── Precaching ──────────────────────────────────────────────────────

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ─── Runtime caching ─────────────────────────────────────────────────

// Static assets — cache first
registerRoute(
  ({ request }) => request.destination === 'font'
    || request.destination === 'image'
    || request.destination === 'style',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// WASM files for SQLite — cache first, long-lived
registerRoute(
  ({ request }) => request.destination === 'worker'
    || request.url.endsWith('.wasm'),
  new CacheFirst({
    cacheName: 'wasm-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 90 * 24 * 60 * 60 }),
    ],
  }),
);

// Navigation — network first (so we don't serve stale index.html)
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  }),
);

// ─── Periodic background sync — suggestion scheduler ─────────────────

self.addEventListener('periodicsync', ((event: ExtendableEvent & { tag: string }) => {
  if (event.tag === 'suggestion-check') {
    event.waitUntil(runSuggestionCheck());
  }
}) as EventListener);

async function runSuggestionCheck(): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' });

  if (clients.length === 0) {
    // No open clients — nothing to do. The main-thread scheduler covers
    // the in-app case. Periodic sync when the app is fully closed can't
    // access OPFS, so skip. A future Phase 2 enhancement could use the
    // AI API directly from the SW with stored preferences.
    return;
  }

  // Ask the first available client to run a suggestion check.
  // The client posts back any suggestion found.
  const client = clients[0];
  client.postMessage({ type: 'SCHEDULER_CHECK' });
}

// ─── Push notifications (Phase 2+ stub) ──────────────────────────────

self.addEventListener('push', ((event: PushEvent) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Expense Tracker', {
      body: data.body || '',
      icon: '/favicon.svg',
      data: data.actions || {},
      actions: (data.actions || []).map((a: { action: string; title: string }) => ({
        action: a.action,
        title: a.title,
      })),
    }),
  );
}) as EventListener);

// ─── Notification click — focus or open chat ─────────────────────────

self.addEventListener('notificationclick', ((event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.focus) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    }),
  );
}) as EventListener);
