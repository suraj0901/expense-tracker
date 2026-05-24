/**
 * ChatView — SmartHeader + SuggestionStrip + transactions list + input.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowUp, Loader2, AlertTriangle, Key, X } from 'lucide-react';
import { useChatStore } from './chat.store';
import { useSettingsStore } from '../settings/settings.store';
import { SmartHeader } from './SmartHeader';
import { SuggestionStrip } from './SuggestionStrip';
import { EmptyState } from './EmptyState';
import { RecentTransactions } from './RecentTransactions';
import { OfflineBanner } from './OfflineBanner';
import { useMessageQueueStore } from './messageQueue.store';
import { onSuggestion, type Suggestion } from '../../core/scheduler';
import { DraftBanner } from '../drafts/DraftBanner';
import { useDraftStore } from '../drafts/drafts.store';
import type { DraftItem } from '../drafts/types';
import { VoiceInput } from './VoiceInput';
import { transactionRepo } from '../../core/composition-root';

export function ChatView() {
  const {
    inputValue, isSending, error, isLoading, latestResponse,
    setInput, loadMessages, sendMessage, clearError, clearLatestResponse, sendQueuedMessage,
  } = useChatStore();

  const { provider } = useSettingsStore();
  const queueStore = useMessageQueueStore();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasTransactions, setHasTransactions] = useState<boolean | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drainLockRef = useRef(false);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    return onSuggestion((s) => setSuggestion(s));
  }, []);

  useEffect(() => {
    transactionRepo.getRecent(1).then((txns) => setHasTransactions(txns.length > 0)).catch(() => setHasTransactions(false));
  }, [refreshKey]);

  // Auto-drain queued messages when back online
  useEffect(() => {
    const { isOnline, isDraining, queue } = queueStore;
    if (!isOnline || isDraining || queue.length === 0 || !provider || drainLockRef.current) return;

    const drain = async () => {
      drainLockRef.current = true;
      queueStore.setDraining(true);
      let remaining = queueStore.queue;
      while (remaining.length > 0) {
        const next = remaining[0].content;
        await sendQueuedMessage(next, provider);
        remaining = queueStore.queue;
      }
      queueStore.setDraining(false);
      drainLockRef.current = false;
      triggerRefresh();
    };

    drain();
  }, [queueStore.isOnline, queueStore.queue.length, provider, sendQueuedMessage, triggerRefresh]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    loadMessages();
  }, [loadMessages]);

  const handleSend = async () => {
    if (!provider) return;
    await sendMessage(provider);
    triggerRefresh();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDraftLog = async (draft: DraftItem) => {
    if (!provider) return;
    const message = draft.amount
      ? `${draft.text}\n[Auto-parsed: ₹${draft.amount}${draft.merchant ? ` at ${draft.merchant}` : ''}]`
      : draft.text;
    setInput(message);
    useDraftStore.getState().remove(draft.id);
    await sendMessage(provider);
    triggerRefresh();
  };

  const handleDraftDismiss = (id: string) => {
    useDraftStore.getState().remove(id);
  };

  const handleSuggestionClear = useCallback(() => setSuggestion(null), []);

  const isConfigured = provider?.isConfigured() ?? false;

  return (
    <div className="chat-container">
      <SmartHeader refreshKey={refreshKey} />

      <SuggestionStrip
        suggestion={suggestion}
        onClear={handleSuggestionClear}
        onLogged={triggerRefresh}
      />

      <DraftBanner onLog={handleDraftLog} onDismiss={handleDraftDismiss} />

      <OfflineBanner />

      {!isConfigured && (
        <div className="setup-banner">
          <Key size={18} />
          <span>
            Add your API key in{' '}
            <a href="#/settings">Settings</a>
            {' '}to start chatting
          </span>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={clearError}><X size={16} /></button>
        </div>
      )}

      <div className="chat-content" ref={contentRef}>
        {isLoading || hasTransactions === null ? (
          <div className="chat-empty">
            <div className="typing-indicator">
              <div className="dot" /><div className="dot" /><div className="dot" />
            </div>
          </div>
        ) : hasTransactions || latestResponse ? (
          <>
            <RecentTransactions key={refreshKey} />

            {latestResponse && (
              <div className="ai-response-card">
                <div className="ai-response-header">
                  <span className="ai-response-label">AI Response</span>
                  <button className="ai-response-dismiss" onClick={clearLatestResponse}>
                    <X size={14} />
                  </button>
                </div>
                <div className="ai-response-body">
                  {latestResponse}
                </div>
              </div>
            )}

            {isSending && (
              <div className="message assistant">
                <div className="message-body">
                  <div className="message-bubble">
                    <div className="typing-indicator">
                      <div className="dot" /><div className="dot" /><div className="dot" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState onQuickLog={triggerRefresh} />
        )}
      </div>

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={isConfigured ? 'Type an expense or ask a question...' : 'Configure API key first...'}
            value={inputValue}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!isConfigured || isSending}
          />
          <VoiceInput onTranscript={setInput} disabled={!isConfigured || isSending} />
          <button
            className={`send-button ${isSending ? 'sending' : ''}`}
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending || !isConfigured}
          >
            {isSending ? <Loader2 className="send-icon" style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowUp className="send-icon" />}
          </button>
        </div>
      </div>
    </div>
  );
}

