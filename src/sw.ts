/**
 * Service worker — Workbox precaching + runtime caching + periodic background sync.
 *
 * The vite-plugin-pwa injectManifest plugin injects self.__WB_MANIFEST
 * with the list of files to precache.
 */

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ─── Precaching ──────────────────────────────────────────────────────

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Purge stale wasm-cache on activate — cached worker/WASM responses
// from before COOP/COEP headers were configured will block worker creation.
self.addEventListener('activate', ((event: ExtendableEvent) => {
  event.waitUntil(
    caches.delete('wasm-cache').then(() => {
      // Deleting static-assets cache too since old CSS/JS may conflict
      return caches.delete('static-assets');
    }),
  );
}) as EventListener);


// ─── Update flow (prompt-based) ─────────────────────────────────────
// When the user clicks "Update" in the React banner, the app posts a
// SKIP_WAITING message. We respond by activating the waiting SW.
self.addEventListener('message', ((event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}) as EventListener);

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

// ─── Notification click — handle Log it / Dismiss actions ───────────

self.addEventListener('notificationclick', ((event: NotificationEvent) => {
  event.notification.close();
  const data = event.notification.data;
  const action = event.action;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Forward the action to any open client
      for (const client of clientList) {
        client.postMessage({
          type: 'NOTIFICATION_ACTION',
          action: action || 'open',
          suggestion: data,
        });
      }

      // Focus or open a window
      for (const client of clientList) {
        if (client.focus) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    }),
  );
}) as EventListener);
