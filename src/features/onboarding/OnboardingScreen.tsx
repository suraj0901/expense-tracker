import { useState, useEffect } from 'react';
import { Bell, HardDrive, MessageSquare, Shield, ArrowRight, Check, X, AlertTriangle } from 'lucide-react';
import { useOnboardingStore } from './onboarding.store';
import './OnboardingScreen.css';

interface PermissionCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  granted: boolean;
  actionLabel: string;
  deniedLabel: string;
}

export function OnboardingScreen({ storageType, onComplete }: { storageType?: string; persisted?: boolean; onComplete: () => void }) {
  const { notificationsGranted, smsUnderstood, setNotificationsGranted, setSmsUnderstood, setStorageAvailable } = useOnboardingStore();
  const [notificationsDenied, setNotificationsDenied] = useState(false);

  const storageOk = storageType === 'opfs';

  useEffect(() => {
    if (storageOk) setStorageAvailable(true);
  }, [storageOk, setStorageAvailable]);

  const handleNotificationRequest = async () => {
    if (!('Notification' in window)) {
      setNotificationsDenied(true);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsGranted(true);
        setNotificationsDenied(false);
      } else {
        setNotificationsDenied(true);
        setNotificationsGranted(false);
      }
    } catch {
      setNotificationsDenied(true);
    }
  };

  const handleSmsAcknowledge = () => {
    setSmsUnderstood(true);
  };

  const handleComplete = () => {
    useOnboardingStore.getState().complete();
    onComplete();
  };

  const allGranted = notificationsGranted && storageOk && smsUnderstood;
  const storageDenied = storageType !== undefined && storageType !== 'opfs';

  const cards: PermissionCard[] = [
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Get reminders about recurring expenses, budget alerts, and monthly insights — right when you need them.',
      icon: <Bell size={28} />,
      granted: notificationsGranted,
      actionLabel: notificationsDenied ? 'Denied' : 'Enable Notifications',
      deniedLabel: 'Notifications blocked — enable in browser settings to proceed',
    },
    {
      id: 'storage',
      title: 'Secure Storage',
      description: 'All your data stays on your device. We use OPFS (Origin Private File System) — no data ever leaves your browser.',
      icon: <HardDrive size={28} />,
      granted: storageOk,
      actionLabel: storageDenied
        ? 'OPFS unavailable'
        : storageOk
          ? 'Available'
          : 'Checking...',
      deniedLabel: 'OPFS unavailable. Your browser or server config needs COOP/COEP headers for persistent storage. Use node server.js locally.',
    },
    {
      id: 'sms',
      title: 'SMS Auto-Log',
      description: "Share bank/SMS alerts from your messaging app to auto-log transactions. Tap 'Share' on any bank message → choose Expense Tracker.",
      icon: <MessageSquare size={28} />,
      granted: smsUnderstood,
      actionLabel: smsUnderstood ? 'Understood' : 'See how it works',
      deniedLabel: '',
    },
  ];

  return (
    <div className="onboarding-screen">
      <div className="onboarding-header">
        <div className="onboarding-logo">
          <Shield size={32} />
        </div>
        <h1 className="onboarding-title">Welcome to Expense Tracker</h1>
        <p className="onboarding-subtitle">
          Your AI-powered expense tracker that keeps all data on your device.
          Let's set up a few things first.
        </p>
      </div>

      <div className="onboarding-cards">
        {cards.map((card) => (
          <div key={card.id} className={`onboarding-card ${card.granted ? 'onboarding-card--granted' : ''}`}>
            <div className="onboarding-card-icon">{card.icon}</div>
            <div className="onboarding-card-content">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              {card.granted ? (
                <span className="onboarding-card-status granted">
                  <Check size={14} /> {card.id === 'sms' ? 'Understood' : 'Granted'}
                </span>
              ) : (
                <>
                  <button
                    className={`onboarding-card-action ${card.id === 'notifications' && notificationsDenied ? 'denied' : ''}`}
                    onClick={
                      card.id === 'notifications' ? handleNotificationRequest :
                      card.id === 'sms' ? handleSmsAcknowledge :
                      undefined
                    }
                    disabled={card.id === 'storage' || (card.id === 'notifications' && notificationsDenied)}
                  >
                    {notificationsDenied && card.id === 'notifications' ? (
                      <><AlertTriangle size={14} /> {card.actionLabel}</>
                    ) : (
                      card.actionLabel
                    )}
                  </button>
                  {card.deniedLabel && (card.id === 'notifications' && notificationsDenied || card.id === 'storage' && storageDenied) && (
                    <span className="onboarding-card-status denied">
                      <X size={14} /> {card.deniedLabel}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="onboarding-privacy-note">
        <Shield size={14} />
        <span>All SMS processing happens on-device. No data is ever sent to any server.</span>
      </div>

      <button
        className={`onboarding-cta ${allGranted ? '' : 'disabled'}`}
        disabled={!allGranted}
        onClick={handleComplete}
      >
        {allGranted ? (
          <>Get Started <ArrowRight size={18} /></>
        ) : (
          <>Complete all steps to continue</>
        )}
      </button>
    </div>
  );
}
