/**
 * App — Root component with tab-based navigation.
 *
 * Three views: Chat (primary), Dashboard, Settings.
 * Uses hash-based routing for PWA compatibility.
 */

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, BarChart3, Settings } from 'lucide-react';
import { ChatView } from './features/chat/ChatView';
import { DashboardView } from './features/dashboard/DashboardView';
import { SettingsView } from './features/settings/SettingsView';
import { useSettingsStore } from './features/settings/settings.store';
import { initializeDatabase, getStorageInfo } from './core/db/client';
import type { StorageInfo } from './core/db/client';
import { startScheduler, tick, onSuggestion, dismissSuggestion } from './core/scheduler';
import { insertTransaction } from './core/db/client';
import { rupeesToPaise } from './core/domain/money';
import { parseSharedText } from './core/share-target';
import { useDraftStore } from './features/drafts/drafts.store';
import { upsertRuleFromSuggestion } from './core/recurring';
import { nanoid } from 'nanoid';
import { format } from 'date-fns';

type Route = 'chat' | 'dashboard' | 'settings';

function getRouteFromHash(): Route {
  const hash = window.location.hash.replace('#', '').replace('/', '');
  if (hash === 'dashboard') return 'dashboard';
  if (hash === 'settings') return 'settings';
  return 'chat';
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRouteFromHash);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { initialize: initSettings } = useSettingsStore();

  const initApp = useCallback(async () => {
    try {
      await initializeDatabase();
      initSettings();
      const info = getStorageInfo();
      if (info) setStorageInfo(info);
      setDbReady(true);
      startScheduler();
    } catch (error) {
      console.error('[App] Database initialization failed:', error);
      setDbError(
        error instanceof Error ? error.message : 'Failed to initialize database'
      );
    }
  }, [initSettings]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  // Handle incoming Web Share Target data (SMS/bank shares)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedText = params.get('text');
    if (!sharedText) return;

    const draft = parseSharedText(sharedText);
    if (draft) {
      useDraftStore.getState().add(draft);
    }
    // Clean URL params without reload
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Register periodic background sync for suggestion checks
  useEffect(() => {
    const registerSync = async () => {
      const registration = await navigator.serviceWorker.ready;
      if ('periodicSync' in registration) {
        try {
          await (registration.periodicSync as PeriodicSyncManager).register(
            'suggestion-check',
            { minInterval: 30 * 60 * 1000 } // 30 min
          );
        } catch {
          // Permission denied or not supported — main-thread scheduler covers it
        }
      }
    };
    registerSync();
  }, []);

  // Listen for SW messages (scheduler checks + notification actions)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SCHEDULER_CHECK') {
        tick();
        return;
      }
      if (event.data?.type === 'NOTIFICATION_ACTION') {
        const { action, suggestion } = event.data;
        if (action === 'dismiss' && suggestion?.id) {
          dismissSuggestion(suggestion.id);
        }
        if (action === 'log' && suggestion) {
          upsertRuleFromSuggestion(suggestion);
          const today = format(new Date(), 'yyyy-MM-dd');
          insertTransaction({
            id: nanoid(),
            amount: rupeesToPaise(suggestion.typicalAmount ?? 0),
            type: 'expense',
            category: suggestion.category ?? 'Other',
            merchant: suggestion.merchant ?? null,
            note: null,
            date: today,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isDeleted: false,
          });
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // Show notification when scheduler finds a suggestion
  useEffect(() => {
    async function showNotification(s: {
      id: string;
      text: string;
      category?: string;
      typicalAmount?: number;
      merchant?: string;
    }) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Expense Tracker', {
        body: `Looks like your usual: ${s.text} — want me to log it?`,
        icon: '/favicon.svg',
        tag: s.id,
        data: s,
        actions: [
          { action: 'log', title: 'Log it' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      } as NotificationOptions);
    }

    const unsub = onSuggestion((s) => {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') {
        Notification.requestPermission().then((p) => {
          if (p !== 'granted') return;
          showNotification(s);
        });
        return;
      }
      showNotification(s);
    });
    return unsub;
  }, []);

  // Hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRouteFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = r === 'chat' ? '/' : `/${r}`;
    setRoute(r);
  };

  if (dbError) {
    return (
      <div className="app-container">
        <div className="chat-empty" style={{ height: '100dvh' }}>
          <div className="empty-icon" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚠️</div>
          <h2>Database Error</h2>
          <p>{dbError}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            This app requires a browser that supports OPFS (Origin Private File System).
            Try using Chrome or Edge on desktop/Android.
          </p>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="app-container">
        <div className="chat-empty" style={{ height: '100dvh' }}>
          <div className="typing-indicator">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Initializing database...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {storageInfo && (storageInfo.pctUsed > 90 || !storageInfo.persisted) && (
        <div className="storage-warning-banner">
          {!storageInfo.persisted
            ? 'Storage is not persistent — data may be lost if device runs low on space.'
            : `Storage ${storageInfo.pctUsed}% full — free up space to avoid data loss.`}
        </div>
      )}

      {installPrompt && (
        <div className="install-banner">
          <span>Install this app for quick access</span>
          <div className="install-banner-actions">
            <button className="install-btn" onClick={handleInstall}>Install</button>
            <button className="install-dismiss" onClick={() => setInstallPrompt(null)}>✕</button>
          </div>
        </div>
      )}

      <div className="app-content">
        <div key={route} className="page-enter">
          {route === 'chat' && <ChatView />}
          {route === 'dashboard' && <DashboardView />}
          {route === 'settings' && <SettingsView />}
        </div>
      </div>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${route === 'chat' ? 'active' : ''}`}
          onClick={() => navigate('chat')}
        >
          <MessageCircle className="nav-icon" />
          Chat
        </button>
        <button
          className={`nav-item ${route === 'dashboard' ? 'active' : ''}`}
          onClick={() => navigate('dashboard')}
        >
          <BarChart3 className="nav-icon" />
          Dashboard
        </button>
        <button
          className={`nav-item ${route === 'settings' ? 'active' : ''}`}
          onClick={() => navigate('settings')}
        >
          <Settings className="nav-icon" />
          Settings
        </button>
      </nav>
    </div>
  );
}
