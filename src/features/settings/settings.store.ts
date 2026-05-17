/**
 * Settings store — provider configuration.
 */

import { create } from 'zustand';
import type { AIProvider } from '../../core/providers/types';
import {
  type ProviderType,
  type ProviderSettings,
  loadSettings,
  saveSettings,
} from '../../core/providers/types';
import { createProvider } from '../../core/providers/factory';

interface SettingsState {
  settings: ProviderSettings;
  provider: AIProvider | null;

  // Actions
  initialize: () => void;
  setActiveProvider: (type: ProviderType) => void;
  setApiKey: (type: ProviderType, key: string) => void;
  clearApiKey: (type: ProviderType) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    activeProvider: 'anthropic',
    anthropicApiKey: null,
    geminiApiKey: null,
    deepseekApiKey: null,
  },
  provider: null,

  initialize: () => {
    const settings = loadSettings();
    const keyMap: Record<ProviderType, string | null> = {
      anthropic: settings.anthropicApiKey,
      gemini: settings.geminiApiKey,
      deepseek: settings.deepseekApiKey,
    };
    const apiKey = keyMap[settings.activeProvider];

    const provider = apiKey
      ? createProvider(settings.activeProvider, apiKey)
      : null;

    set({ settings, provider });
  },

  setActiveProvider: (type) => {
    const { settings } = get();
    const newSettings = { ...settings, activeProvider: type };
    saveSettings(newSettings);

    const keyMap: Record<ProviderType, string | null> = {
      anthropic: newSettings.anthropicApiKey,
      gemini: newSettings.geminiApiKey,
      deepseek: newSettings.deepseekApiKey,
    };
    const apiKey = keyMap[type];
    const provider = apiKey ? createProvider(type, apiKey) : null;

    set({ settings: newSettings, provider });
  },

  setApiKey: (type, key) => {
    const { settings } = get();
    const keyFields: Record<ProviderType, string> = {
      anthropic: 'anthropicApiKey',
      gemini: 'geminiApiKey',
      deepseek: 'deepseekApiKey',
    };
    const newSettings = {
      ...settings,
      [keyFields[type]]: key,
    };
    saveSettings(newSettings);

    if (type === settings.activeProvider) {
      const provider = createProvider(type, key);
      set({ settings: newSettings, provider });
    } else {
      set({ settings: newSettings });
    }
  },

  clearApiKey: (type) => {
    const { settings } = get();
    const keyFields: Record<ProviderType, string> = {
      anthropic: 'anthropicApiKey',
      gemini: 'geminiApiKey',
      deepseek: 'deepseekApiKey',
    };
    const newSettings = {
      ...settings,
      [keyFields[type]]: null,
    };
    saveSettings(newSettings);

    if (type === settings.activeProvider) {
      set({ settings: newSettings, provider: null });
    } else {
      set({ settings: newSettings });
    }
  },
}));
