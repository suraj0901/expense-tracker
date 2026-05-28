import { create } from 'zustand';
import {
  getAutoLogRules, toggleAutoLogRule, removeAutoLogRule,
  type AutoLogRule,
} from '../../core/recurring';

interface RecurringState {
  activeRules: AutoLogRule[];
  isLoading: boolean;

  loadData: () => Promise<void>;
  disableRule: (id: string) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
}

export const useRecurringStore = create<RecurringState>((set, get) => ({
  activeRules: [],
  isLoading: true,

  loadData: async () => {
    try {
      const rules = getAutoLogRules();
      set({ activeRules: rules, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  disableRule: async (id) => {
    toggleAutoLogRule(id);
    await get().loadData();
  },

  removeRule: async (id) => {
    removeAutoLogRule(id);
    await get().loadData();
  },
}));
