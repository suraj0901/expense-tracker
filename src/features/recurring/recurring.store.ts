import { create } from 'zustand';
import {
  getAutoLogRules, toggleAutoLogRule, removeAutoLogRule, enableAutoLogRule,
  getDismissedRules, dismissRule, restoreRule,
  type AutoLogRule, type DismissedRule,
  getPendingSuggestions,
} from '../../core/recurring';

interface RecurringState {
  pendingSuggestions: (AutoLogRule)[];
  activeRules: AutoLogRule[];
  dismissedHistory: DismissedRule[];
  isLoading: boolean;

  loadData: () => Promise<void>;
  enableRule: (id: string) => Promise<void>;
  disableRule: (id: string) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  restoreRule: (id: string) => Promise<void>;
}

export const useRecurringStore = create<RecurringState>((set, get) => ({
  pendingSuggestions: [],
  activeRules: [],
  dismissedHistory: [],
  isLoading: true,

  loadData: async () => {
    try {
      const [pending, active, dismissed] = await Promise.all([
        Promise.resolve(getPendingSuggestions()),
        Promise.resolve(getAutoLogRules()),
        getDismissedRules(),
      ]);
      set({ pendingSuggestions: pending, activeRules: active, dismissedHistory: dismissed, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  enableRule: async (id) => {
    enableAutoLogRule(id);
    await get().loadData();
  },

  disableRule: async (id) => {
    toggleAutoLogRule(id);
    await get().loadData();
  },

  removeRule: async (id) => {
    removeAutoLogRule(id);
    await get().loadData();
  },

  dismissSuggestion: async (id) => {
    const rule = get().pendingSuggestions.find(r => r.id === id);
    if (rule) {
      dismissRule(rule);
    }
    await get().loadData();
  },

  restoreRule: async (id) => {
    restoreRule(id);
    await get().loadData();
  },
}));
