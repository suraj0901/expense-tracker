/**
 * App — Root component with tab-based navigation.
 *
 * Three views: Chat (primary), Dashboard, Settings.
 * Uses hash-based routing for PWA compatibility.
 */

import { useState, useEffect, useCallback } from 'react';
import { ChatView } from './features/chat/ChatView';
import { DashboardView } from './features/dashboard/DashboardView';
import { SettingsView } from './features/settings/SettingsView';
import { useSettingsStore } from './features/settings/settings.store';
import { initializeDatabase } from './core/db/client';
import { startScheduler, tick } from './core/scheduler';

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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { initialize: initSettings } = useSettingsStore();

  const initApp = useCallback(async () => {
    try {
      await initializeDatabase();
      initSettings();
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

  // Listen for SW messages (e.g., scheduler checks from periodic sync)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SCHEDULER_CHECK') {
        tick();
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
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
          <div className="empty-icon">⚠️</div>
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
        {route === 'chat' && <ChatView />}
        {route === 'dashboard' && <DashboardView />}
        {route === 'settings' && <SettingsView />}
      </div>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${route === 'chat' ? 'active' : ''}`}
          onClick={() => navigate('chat')}
        >
          <span className="nav-icon">💬</span>
          Chat
        </button>
        <button
          className={`nav-item ${route === 'dashboard' ? 'active' : ''}`}
          onClick={() => navigate('dashboard')}
        >
          <span className="nav-icon">📊</span>
          Dashboard
        </button>
        <button
          className={`nav-item ${route === 'settings' ? 'active' : ''}`}
          onClick={() => navigate('settings')}
        >
          <span className="nav-icon">⚙️</span>
          Settings
        </button>
      </nav>
    </div>
  );
}
