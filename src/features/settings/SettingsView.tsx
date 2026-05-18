/**
 * SettingsView — provider picker + API key input.
 */

import { useState } from 'react';
import { useSettingsStore } from './settings.store';
import type { ProviderType } from '../../core/providers/types';
import { LocalAIProvider } from '../../core/providers/local';
import { ModelDownloadCard } from './ModelDownloadCard';

export function SettingsView() {
  const { settings, provider, setActiveProvider, setApiKey, clearApiKey, setWebLLMEnabled } =
    useSettingsStore();

  const [anthropicKeyInput, setAnthropicKeyInput] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [deepseekKeyInput, setDeepseekKeyInput] = useState('');

  const handleSaveKey = (type: ProviderType) => {
    const keyMap: Record<ProviderType, string> = {
      anthropic: anthropicKeyInput,
      gemini: geminiKeyInput,
      deepseek: deepseekKeyInput,
    };
    const clearMap: Record<ProviderType, () => void> = {
      anthropic: () => setAnthropicKeyInput(''),
      gemini: () => setGeminiKeyInput(''),
      deepseek: () => setDeepseekKeyInput(''),
    };
    const key = keyMap[type];
    if (key.trim()) {
      setApiKey(type, key.trim());
      clearMap[type]();
    }
  };

  const handleClearKey = (type: ProviderType) => {
    clearApiKey(type);
  };

  return (
    <div className="settings-container fade-in">
      <h1>⚙️ Settings</h1>

      <div className="settings-section">
        <h2>AI Provider</h2>

        <div
          className={`provider-card ${settings.activeProvider === 'anthropic' ? 'selected' : ''}`}
          onClick={() => setActiveProvider('anthropic')}
        >
          <div className="radio" />
          <div className="provider-info">
            <div className="provider-name">Claude (Anthropic)</div>
            <div className="provider-desc">
              claude-sonnet-4-20250514 · Great for tool calling
            </div>
          </div>
          <span
            className={`provider-status ${settings.anthropicApiKey ? 'configured' : 'missing'}`}
          >
            {settings.anthropicApiKey ? '✓ Ready' : 'No key'}
          </span>
        </div>

        <div
          className={`provider-card ${settings.activeProvider === 'gemini' ? 'selected' : ''}`}
          onClick={() => setActiveProvider('gemini')}
        >
          <div className="radio" />
          <div className="provider-info">
            <div className="provider-name">Gemini (Google)</div>
            <div className="provider-desc">
              gemini-2.0-flash · Fast and cost-effective
            </div>
          </div>
          <span
            className={`provider-status ${settings.geminiApiKey ? 'configured' : 'missing'}`}
          >
            {settings.geminiApiKey ? '✓ Ready' : 'No key'}
          </span>
        </div>

        <div
          className={`provider-card ${settings.activeProvider === 'deepseek' ? 'selected' : ''}`}
          onClick={() => setActiveProvider('deepseek')}
        >
          <div className="radio" />
          <div className="provider-info">
            <div className="provider-name">DeepSeek</div>
            <div className="provider-desc">
              deepseek-chat · Strong reasoning at low cost
            </div>
          </div>
          <span
            className={`provider-status ${settings.deepseekApiKey ? 'configured' : 'missing'}`}
          >
            {settings.deepseekApiKey ? '✓ Ready' : 'No key'}
          </span>
        </div>

        <div
          className={`provider-card local ${settings.activeProvider === 'webllm' ? 'selected' : ''}`}
          onClick={() => settings.webllmEnabled && setActiveProvider('webllm')}
        >
          <div className="radio" />
          <div className="provider-info">
            <div className="provider-name">Qwen 3.5 2B (Local)</div>
            <div className="provider-desc">
              Runs entirely on device · No API key · No network
            </div>
          </div>
          <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={settings.webllmEnabled}
              onChange={(e) => setWebLLMEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {settings.activeProvider === 'webllm' && settings.webllmEnabled && provider && (
        <div className="settings-section">
          <h2>Model Status</h2>
          <ModelDownloadCard provider={provider as LocalAIProvider} />
        </div>
      )}

      <div className="settings-section">
        <h2>API Keys</h2>

        <div className="api-key-input">
          <label>Anthropic API Key</label>
          {settings.anthropicApiKey ? (
            <div className="input-row">
              <input
                type="password"
                value="••••••••••••••••••••"
                readOnly
              />
              <button className="btn btn-danger" onClick={() => handleClearKey('anthropic')}>
                Remove
              </button>
            </div>
          ) : (
            <div className="input-row">
              <input
                type="password"
                placeholder="sk-ant-..."
                value={anthropicKeyInput}
                onChange={(e) => setAnthropicKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey('anthropic')}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleSaveKey('anthropic')}
                disabled={!anthropicKeyInput.trim()}
              >
                Save
              </button>
            </div>
          )}
        </div>

        <div className="api-key-input">
          <label>Gemini API Key</label>
          {settings.geminiApiKey ? (
            <div className="input-row">
              <input
                type="password"
                value="••••••••••••••••••••"
                readOnly
              />
              <button className="btn btn-danger" onClick={() => handleClearKey('gemini')}>
                Remove
              </button>
            </div>
          ) : (
            <div className="input-row">
              <input
                type="password"
                placeholder="AIza..."
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey('gemini')}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleSaveKey('gemini')}
                disabled={!geminiKeyInput.trim()}
              >
                Save
              </button>
            </div>
          )}
        </div>

        <div className="api-key-input">
          <label>DeepSeek API Key</label>
          {settings.deepseekApiKey ? (
            <div className="input-row">
              <input
                type="password"
                value="••••••••••••••••••••"
                readOnly
              />
              <button className="btn btn-danger" onClick={() => handleClearKey('deepseek')}>
                Remove
              </button>
            </div>
          ) : (
            <div className="input-row">
              <input
                type="password"
                placeholder="sk-..."
                value={deepseekKeyInput}
                onChange={(e) => setDeepseekKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey('deepseek')}
              />
              <button
                className="btn btn-primary"
                onClick={() => handleSaveKey('deepseek')}
                disabled={!deepseekKeyInput.trim()}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h2>About</h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
          <p>AI Expense Tracker — Agent-Centric MVP</p>
          <p>Your data stays on this device. API keys are stored in localStorage.</p>
          <p>AI calls go directly from your browser to the provider's API.</p>
          <p style={{ marginTop: '8px', opacity: 0.6 }}>v1.0.0 · May 2026</p>
        </div>
      </div>
    </div>
  );
}
