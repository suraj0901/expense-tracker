/**
 * SettingsView — provider picker + API key input + data management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings, Download, Upload, Trash2, RefreshCw,
  Brain, Sparkles, Zap, Cpu, HardDrive, Info,
  FileSpreadsheet, FileText, Check, ArrowDown,
} from 'lucide-react';
import { useSettingsStore } from './settings.store';
import type { ProviderType } from '../../core/providers/types';
import type { LocalAIProvider, DownloadState } from '../../core/providers/local';
import type { StoredBackup } from '../../core/domain/types';

const PROVIDER_META: Record<string, { name: string; model: string; icon: typeof Brain; placeholder: string }> = {
  anthropic: { name: 'Claude (Anthropic)', model: 'claude-sonnet-4-20250514', icon: Brain, placeholder: 'sk-ant-...' },
  gemini: { name: 'Gemini (Google)', model: 'gemini-2.0-flash', icon: Sparkles, placeholder: 'AIza...' },
  deepseek: { name: 'DeepSeek', model: 'deepseek-chat', icon: Zap, placeholder: 'sk-...' },
};

const PROVIDER_DESC: Record<string, string> = {
  anthropic: 'Great for tool calling',
  gemini: 'Fast and cost-effective',
  deepseek: 'Strong reasoning at low cost',
};

function LocalModelStatus({ provider }: { provider: LocalAIProvider }) {
  const [state, setState] = useState<DownloadState>(provider.getDownloadState());
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    return provider.onDownload(setState);
  }, [provider]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try { await provider.initialize(); } catch { /* error in state */ }
    finally { setDownloading(false); }
  }, [provider]);

  const pct = Math.round(state.progress * 100);

  const StatusIcon = state.status === 'ready' ? Check
    : state.status === 'downloading' ? ArrowDown
    : Download;

  return (
    <div className="local-model-status">
      <div className="local-model-header">
        <span className="local-model-icon">
          <StatusIcon size={14} />
        </span>
        <span className="local-model-text">
          {state.status === 'idle' && '~200 MB · Runs offline'}
          {state.status === 'ready' && 'Model ready'}
          {state.status === 'error' && state.text}
          {state.status === 'downloading' && state.text}
        </span>
      </div>

      {state.status === 'downloading' && (
        <div className="local-model-bar">
          <div className="local-model-bar-track">
            <div className="local-model-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="local-model-pct">{pct}%</span>
        </div>
      )}

      {state.status === 'error' && (
        <button className="btn btn-primary btn-xs local-model-btn" onClick={handleDownload} disabled={downloading}>
          Retry
        </button>
      )}
    </div>
  );
}

export function SettingsView() {
  const { settings, provider, setActiveProvider, setApiKey, clearApiKey, setWebLLMEnabled } =
    useSettingsStore();

  const [anthropicKeyInput, setAnthropicKeyInput] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [deepseekKeyInput, setDeepseekKeyInput] = useState('');
  const [backups, setBackups] = useState<StoredBackup[]>([]);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  const localProvider = provider && provider.id === 'webllm' ? (provider as LocalAIProvider) : null;
  const pendingDownload = useRef(false);

  useEffect(() => {
    if (localProvider && !pendingDownload.current) {
      pendingDownload.current = true;
      localProvider.initialize().finally(() => { pendingDownload.current = false; });
    }
  }, [localProvider]);

  const refreshBackups = useCallback(() => {
    import('../../core/db/client').then((m) => setBackups(m.getStoredBackups()));
  }, []);

  useEffect(() => { refreshBackups(); }, [refreshBackups]);

  const handleSaveKey = (type: ProviderType) => {
    const keyMap: Record<ProviderType, string> = {
      anthropic: anthropicKeyInput,
      gemini: geminiKeyInput,
      deepseek: deepseekKeyInput,
      webllm: '',
    };
    const clearMap: Record<ProviderType, () => void> = {
      anthropic: () => setAnthropicKeyInput(''),
      gemini: () => setGeminiKeyInput(''),
      deepseek: () => setDeepseekKeyInput(''),
      webllm: () => {},
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

  const getKeyInput = (type: 'anthropic' | 'gemini' | 'deepseek') => {
    if (type === 'anthropic') return [anthropicKeyInput, setAnthropicKeyInput] as const;
    if (type === 'gemini') return [geminiKeyInput, setGeminiKeyInput] as const;
    return [deepseekKeyInput, setDeepseekKeyInput] as const;
  };

  const cloudProviders: ProviderType[] = ['anthropic', 'gemini', 'deepseek'];

  return (
    <div className="settings-container fade-in">
      <div className="settings-header">
        <Settings className="settings-header-icon" />
        <h1>Settings</h1>
      </div>

      {/* ── AI Provider ── */}
      <div className="settings-section">
        <h2>
          <Cpu size={14} />
          AI Provider
        </h2>

        {cloudProviders.map((type) => {
          const meta = PROVIDER_META[type];
          const keyField = `${type}ApiKey` as const;
          const hasKey = !!settings[keyField];
          const isSelected = settings.activeProvider === type;
          const Icon = meta.icon;
          const [inputVal, setInputVal] = getKeyInput(type as 'anthropic' | 'gemini' | 'deepseek');

          return (
            <div
              key={type}
              className={`provider-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setActiveProvider(type)}
            >
              <div className="radio" />
              <span className={`provider-icon ${isSelected ? 'active' : ''}`}>
                <Icon size={18} />
              </span>
              <div className="provider-info">
                <div className="provider-name">{meta.name}</div>
                <div className="provider-desc">
                  {meta.model} · {PROVIDER_DESC[type]}
                </div>
                {isSelected && (
                  <div className="provider-key-row" onClick={(e) => e.stopPropagation()}>
                    {hasKey ? (
                      <>
                        <input
                          type="password"
                          value="••••••••••••••••••••"
                          readOnly
                          className="provider-key-input"
                        />
                        <button className="btn btn-danger btn-xs" onClick={() => handleClearKey(type)}>
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          type="password"
                          placeholder={meta.placeholder}
                          value={inputVal}
                          onChange={(e) => setInputVal(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveKey(type)}
                          className="provider-key-input"
                        />
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => handleSaveKey(type)}
                          disabled={!inputVal.trim()}
                        >
                          Save
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <span className={`provider-status ${hasKey ? 'configured' : 'missing'}`}>
                {hasKey ? 'Ready' : 'No key'}
              </span>
            </div>
          );
        })}

        <div
          className={`provider-card local ${settings.activeProvider === 'webllm' ? 'selected' : ''}`}
          onClick={() => settings.webllmEnabled && setActiveProvider('webllm')}
        >
          <div className="radio" />
          <span className={`provider-icon ${settings.activeProvider === 'webllm' ? 'active' : ''}`}>
            <Cpu size={18} />
          </span>
          <div className="provider-info">
            <div className="provider-name">SmolLM2 360M (Local)</div>
            <div className="provider-desc">
              Runs entirely on device · No API key · No network
            </div>
            {settings.webllmEnabled && localProvider && (
              <div className="provider-key-row" onClick={(e) => e.stopPropagation()}>
                <LocalModelStatus provider={localProvider} />
              </div>
            )}
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

      {/* ── Export Data ── */}
      <div className="settings-section">
        <h2>
          <FileSpreadsheet size={14} />
          Export Data
        </h2>
        <div className="settings-card">
          <div className="export-option">
            <div className="export-option-info">
              <FileSpreadsheet size={18} />
              <div>
                <div className="export-option-title">CSV Export</div>
                <div className="export-option-desc">
                  Download all transactions as a CSV spreadsheet. Open in Excel, Google Sheets, or any spreadsheet app.
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-xs" onClick={() => {
              import('../../core/db/client').then((m) => m.exportCSV());
            }}>
              Export
            </button>
          </div>

          <div className="section-divider" />

          <div className="export-option">
            <div className="export-option-info">
              <FileText size={18} />
              <div>
                <div className="export-option-title">PDF Export</div>
                <div className="export-option-desc">
                  Generate a formatted PDF report of your transactions with category breakdowns.
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-xs" onClick={() => {
              import('../../core/db/client').then((m) => m.exportPDF());
            }}>
              Export
            </button>
          </div>

          <p className="data-subsection-note">
            All exports happen on-device. No data is ever sent anywhere.
          </p>
        </div>
      </div>

      {/* ── Backup & Restore ── */}
      <div className="settings-section">
        <h2>
          <HardDrive size={14} />
          Backup &amp; Restore
        </h2>
        <div className="settings-card">
          <p className="data-subsection-desc" style={{ marginBottom: '8px' }}>
            Create a full backup of your database including all transactions, chats, categories,
            and settings. Auto-backups run daily and the last 7 are kept in local storage.
          </p>

          <div className="export-buttons">
            <button className="btn btn-primary" onClick={() => {
              import('../../core/db/client').then((m) => m.exportDatabase());
            }}>
              <Download size={14} style={{ marginRight: '4px' }} />
              Backup Now
            </button>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={14} style={{ marginRight: '4px' }} />
              Restore from File
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const { importDatabase } = await import('../../core/db/client');
                  const result = await importDatabase(file);
                  setRestoreMsg(result.success ? 'Restore complete. Reloading...' : `Restore failed: ${result.error}`);
                  if (result.success) {
                    setTimeout(() => window.location.reload(), 1500);
                  }
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {restoreMsg && (
            <div className={`restore-message ${restoreMsg.includes('failed') ? 'restore-error' : 'restore-success'}`}>
              {restoreMsg}
            </div>
          )}

          {backups.length > 0 && (
            <>
              <h3 className="backup-list-heading">
                Previous Backups ({backups.length}/7)
              </h3>
              <div className="backup-list">
                {backups.map((b) => (
                  <div key={b.date} className="backup-item">
                    <span className="backup-date">{b.date}</span>
                    <span className="backup-size">{(b.sizeBytes / 1024).toFixed(1)} KB</span>
                    <button
                      className="btn btn-small"
                      onClick={async () => {
                        const { restoreFromLocalBackup, processPendingRestore } = await import('../../core/db/client');
                        const ok = restoreFromLocalBackup(b.date);
                        if (ok) {
                          await processPendingRestore();
                          setRestoreMsg('Restore complete. Reloading...');
                          setTimeout(() => window.location.reload(), 1500);
                        } else {
                          setRestoreMsg('Restore failed: invalid backup data.');
                        }
                      }}
                    >
                      <RefreshCw size={12} /> Restore
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => {
                        import('../../core/db/client').then((m) => {
                          m.deleteLocalBackup(b.date);
                          refreshBackups();
                        });
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── About ── */}
      <div className="settings-section">
        <h2>
          <Info size={14} />
          About
        </h2>
        <div className="about-card">
          <div className="about-text">
            <p>AI Expense Tracker — Agent-Centric MVP</p>
            <p>Your data stays on this device. API keys are stored on the local file system.</p>
            <p>AI calls go directly from your browser to the provider's API.</p>
          </div>
          <span className="version-badge">v1.0.0 · May 2026</span>
        </div>
      </div>
    </div>
  );
}
