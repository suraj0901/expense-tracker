/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// PWA install prompt event (non-standard, supported in Chromium)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Periodic Background Sync (supported in installed PWAs on Chromium)
interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>;
  getTags(): Promise<string[]>;
  unregister(tag: string): Promise<void>;
}

interface ServiceWorkerRegistration {
  readonly periodicSync: PeriodicSyncManager;
}
