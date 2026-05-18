/**
 * ModelDownloadCard — shows download progress for the local WebLLM model.
 *
 * Displayed in Settings when WebLLM is enabled. Lets the user pre-download
 * the model before using it in chat.
 */
import { useState, useEffect, useCallback } from 'react';
import type { LocalAIProvider } from '../../core/providers/local';
import type { DownloadState } from '../../core/providers/local';

interface Props {
  provider: LocalAIProvider;
}

export function ModelDownloadCard({ provider }: Props) {
  const [state, setState] = useState<DownloadState>(provider.getDownloadState());
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    return provider.onDownload(setState);
  }, [provider]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await provider.initialize();
    } catch {
      // error already reflected in state via onDownload
    } finally {
      setDownloading(false);
    }
  }, [provider]);

  const pct = Math.round(state.progress * 100);

  return (
    <div className="model-download-card">
      <div className="model-download-header">
        <span className="model-download-icon">
          {state.status === 'ready' ? '✓' : state.status === 'downloading' ? '↓' : '⬇'}
        </span>
        <div className="model-download-info">
          <div className="model-download-title">Qwen 3.5 2B</div>
          <div className="model-download-desc">
            {state.status === 'idle' && '~1 GB download · Runs fully offline'}
            {state.status === 'ready' && 'Loaded and ready · All data stays on device'}
            {state.status === 'error' && state.text}
            {state.status === 'downloading' && state.text}
          </div>
        </div>
      </div>

      {state.status === 'downloading' && (
        <div className="model-download-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="progress-text">{pct}%</span>
        </div>
      )}

      {state.status === 'idle' && (
        <button
          className="btn btn-primary model-download-btn"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? 'Starting...' : 'Download Model'}
        </button>
      )}

      {state.status === 'ready' && (
        <button
          className="btn btn-ghost model-download-btn"
          disabled
        >
          Model Ready
        </button>
      )}

      {state.status === 'error' && (
        <button
          className="btn btn-primary model-download-btn"
          onClick={handleDownload}
          disabled={downloading}
        >
          Retry Download
        </button>
      )}
    </div>
  );
}
