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
  setWebLLMEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    activeProvider: 'anthropic',
    anthropicApiKey: null,
    geminiApiKey: null,
    deepseekApiKey: null,
    webllmEnabled: false,
  },
  provider: null,

  initialize: () => {
    const settings = loadSettings();
    const provider = createActiveProvider(settings);
    set({ settings, provider });
  },

  setActiveProvider: (type) => {
    const { settings } = get();
    const newSettings = { ...settings, activeProvider: type };
    saveSettings(newSettings);
    const provider = createActiveProvider(newSettings);
    set({ settings: newSettings, provider });
  },

  setApiKey: (type, key) => {
    const { settings } = get();
    const keyFields: Record<string, string> = {
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
      const provider = createActiveProvider(newSettings);
      set({ settings: newSettings, provider });
    } else {
      set({ settings: newSettings });
    }
  },

  clearApiKey: (type) => {
    const { settings } = get();
    const keyFields: Record<string, string> = {
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

  setWebLLMEnabled: (enabled) => {
    const { settings } = get();
    const newSettings = { ...settings, webllmEnabled: enabled };
    saveSettings(newSettings);

    if (settings.activeProvider === 'webllm') {
      const provider = enabled ? createProvider('webllm', null) : null;
      set({ settings: newSettings, provider });
    } else {
      set({ settings: newSettings });
    }
  },
}));

function createActiveProvider(settings: ProviderSettings): AIProvider | null {
  if (settings.activeProvider === 'webllm') {
    return settings.webllmEnabled ? createProvider('webllm', null) : null;
  }
  const keyMap: Record<string, string | null> = {
    anthropic: settings.anthropicApiKey,
    gemini: settings.geminiApiKey,
    deepseek: settings.deepseekApiKey,
  };
  const apiKey = keyMap[settings.activeProvider];
  return apiKey ? createProvider(settings.activeProvider, apiKey) : null;
}
