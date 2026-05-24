import { create } from 'zustand';
import { kvGet, kvSet } from '../../core/platform/kv-store';

export type OnboardingPhase = 'checking' | 'onboarding' | 'complete';

interface OnboardingState {
  phase: OnboardingPhase;
  notificationsGranted: boolean;
  storageAvailable: boolean;
  smsUnderstood: boolean;

  checkOnboarding: () => void;
  setNotificationsGranted: (v: boolean) => void;
  setStorageAvailable: (v: boolean) => void;
  setSmsUnderstood: (v: boolean) => void;
  complete: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  phase: 'checking',
  notificationsGranted: false,
  storageAvailable: false,
  smsUnderstood: false,

  checkOnboarding: () => {
    const completed = kvGet('onboarding:completed') === 'true';
    if (completed) {
      set({ phase: 'complete' });
      return;
    }
    set({
      phase: 'onboarding',
      notificationsGranted: typeof Notification !== 'undefined' && Notification.permission === 'granted',
    });
  },

  setNotificationsGranted: (v) => set({ notificationsGranted: v }),
  setStorageAvailable: (v) => set({ storageAvailable: v }),
  setSmsUnderstood: (v) => set({ smsUnderstood: v }),

  complete: () => {
    kvSet('onboarding:completed', 'true');
    set({ phase: 'complete' });
  },
}));
