/**
 * App — Root component with tab-based navigation.
 *
 * Three views: Chat (primary), Dashboard, Settings.
 * Uses hash-based routing for PWA compatibility.
 */

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, BarChart3, Settings, AlertTriangle, X, RefreshCw, Repeat, Sun, Moon } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ChatView } from './features/chat/ChatView';
import { DashboardView } from './features/dashboard/DashboardView';
import { SettingsView } from './features/settings/SettingsView';
import { RecurringView } from './features/recurring/RecurringView';
import { useSettingsStore } from './features/settings/settings.store';
import { initializeDatabase, getStorageInfo } from './core/db/client';
import { initKvStore, kvGet } from './core/platform/kv-store';
import type { StorageInfo } from './core/db/client';
import { startScheduler, setPatternAnalyzer, tick, onSuggestion, dismissSuggestion, onTimedReminder } from './core/scheduler';
import { transactionRepo } from './core/composition-root';
import { rupeesToPaise } from './core/domain/money';
import { parseSharedText } from './core/share-target';
import { useDraftStore } from './features/drafts/drafts.store';
import { upsertRuleFromSuggestion } from './core/recurring';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { nanoid } from 'nanoid';
import { format } from 'date-fns';

type Route = 'chat' | 'dashboard' | 'recurring' | 'settings';

function getRouteFromHash(): Route {
  const hash = window.location.hash.replace('#', '').replace('/', '');
  if (hash === 'dashboard') return 'dashboard';
  if (hash === 'recurring') return 'recurring';
  if (hash === 'settings') return 'settings';
  return 'chat';
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRouteFromHash);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(true); // default true to flash nothing while checking
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem('expense-tracker-theme');
    return stored === 'light' ? 'light' : 'dark';
  });
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const { initialize: initSettings } = useSettingsStore();

  const initApp = useCallback(async () => {
    try {
      await initKvStore();
      const completed = kvGet('onboarding:completed') === 'true';
      setOnboardingComplete(completed);
      await initializeDatabase();
      initSettings();
      const info = getStorageInfo();
      if (info) setStorageInfo(info);
      setDbReady(true);
      if (completed) startScheduler();
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

  // Wire AI pattern detection into scheduler when provider is available
  useEffect(() => {
    const { provider } = useSettingsStore.getState();
    if (!provider?.isConfigured()) return;

    import('./core/agent/proactive-agent').then(({ analyzePatterns }) => {
      setPatternAnalyzer((candidates, txns) => analyzePatterns(candidates, txns, provider));
    });
  }, [initSettings]);

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
        const { action, suggestion, reminder } = event.data;
        if (action === 'dismiss') {
          if (reminder?.id) {
            import('./core/pattern-reminders').then(({ dismissReminder }) => dismissReminder(reminder.id));
          }
          if (suggestion?.id) dismissSuggestion(suggestion.id);
        }
        if (action === 'log' && (suggestion || reminder)) {
          const s = suggestion || reminder;
          const today = format(new Date(), 'yyyy-MM-dd');
          if (reminder?.id) {
            import('./core/pattern-reminders').then(({ markReminderMatched }) => markReminderMatched(reminder.id));
          }
          transactionRepo.insert({
            id: nanoid(),
            amount: rupeesToPaise(s.typicalAmount ?? 0),
            type: 'expense',
            category: s.category ?? 'Other',
            merchant: s.merchant ?? null,
            note: null,
            description: s.description ?? null,
            date: today,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isDeleted: false,
          });
        }
        if (action === 'create-rule' && suggestion) {
          upsertRuleFromSuggestion(suggestion);
          const today = format(new Date(), 'yyyy-MM-dd');
          transactionRepo.insert({
            id: nanoid(),
            amount: rupeesToPaise(suggestion.typicalAmount ?? 0),
            type: 'expense',
            category: suggestion.category ?? 'Other',
            merchant: suggestion.merchant ?? null,
            note: null,
            description: suggestion.description ?? null,
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

  // Show rule-creation notification when scheduler finds an untimed pattern
  useEffect(() => {
    async function showRuleSuggestion(s: {
      id: string;
      text: string;
      category?: string;
      typicalAmount?: number;
      merchant?: string;
      description?: string | null;
      notificationBody: string;
    }) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Expense Tracker', {
        body: s.notificationBody,
        icon: '/favicon.svg',
        tag: s.id,
        data: { ...s, notificationType: 'rule-creation' },
        actions: [
          { action: 'create-rule', title: 'Create rule' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      } as NotificationOptions);
    }

    const unsub = onSuggestion((s) => {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') {
        Notification.requestPermission().then((p) => {
          if (p !== 'granted') return;
          showRuleSuggestion(s);
        });
        return;
      }
      showRuleSuggestion(s);
    });
    return unsub;
  }, []);

  // Show timed-log notification when scheduler fires a pending reminder
  useEffect(() => {
    async function showTimedReminder(r: {
      id: string;
      category: string;
      typicalAmount: number;
      merchant: string | null;
      description: string | null;
      notificationBody: string;
    }) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Expense Tracker', {
        body: r.notificationBody,
        icon: '/favicon.svg',
        tag: r.id,
        data: { ...r, notificationType: 'timed-log', suggestion: r, reminder: r },
        actions: [
          { action: 'log', title: 'Log it' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      } as NotificationOptions);
    }

    const unsub = onTimedReminder((r) => {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') {
        Notification.requestPermission().then((p) => {
          if (p !== 'granted') return;
          showTimedReminder(r);
        });
        return;
      }
      showTimedReminder(r);
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

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('expense-tracker-theme', next);
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (dbError) {
    return (
      <div className="app-container">
        <div className="chat-empty" style={{ height: '100dvh' }}>
          <AlertTriangle size={40} style={{ marginBottom: '8px', color: 'var(--color-warning)' }} />
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

  if (!onboardingComplete) {
    return (
      <OnboardingScreen
        storageType={storageInfo?.storageType}
        persisted={storageInfo?.persisted}
        onComplete={() => {
          setOnboardingComplete(true);
          startScheduler();
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {storageInfo && storageInfo.storageType === 'memory' && (
        <div className="storage-warning-banner storage-warning-critical">
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            Database is running in memory — all data will be lost on refresh.
            Your deployment server must set Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers.
            See the deployment guide or use <code>node server.js</code> to run locally.
          </span>
        </div>
      )}
      {storageInfo && storageInfo.storageType === 'opfs' && (storageInfo.pctUsed > 90 || !storageInfo.persisted) && (
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
            <button className="install-dismiss" onClick={() => setInstallPrompt(null)}><X size={16} /></button>
          </div>
        </div>
      )}

      {needRefresh && (
        <div className="install-banner" style={{ background: 'var(--color-accent)', color: '#fff' }}>
          <RefreshCw size={16} />
          <span>New version available</span>
          <div className="install-banner-actions">
            <button
              className="install-btn"
              style={{ background: '#fff', color: 'var(--color-accent)' }}
              onClick={() => updateServiceWorker(true)}
            >
              Update
            </button>
            <button className="install-dismiss" onClick={() => setNeedRefresh(false)}>
              <X size={16} style={{ color: '#fff' }} />
            </button>
          </div>
        </div>
      )}

      <div className="app-header">
        <span className="app-header-title">ExpenseTracker</span>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="app-content">
        <div key={route} className="page-enter">
          {route === 'chat' && <ChatView />}
          {route === 'dashboard' && <DashboardView />}
          {route === 'recurring' && <RecurringView />}
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
          className={`nav-item ${route === 'recurring' ? 'active' : ''}`}
          onClick={() => navigate('recurring')}
        >
          <Repeat className="nav-icon" />
          Recurring
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
