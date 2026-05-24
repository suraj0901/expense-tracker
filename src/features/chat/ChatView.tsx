/**
 * ChatView — SmartHeader + EventFeed + input.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowUp, Loader2, AlertTriangle, Key, X } from 'lucide-react';
import { useChatStore } from './chat.store';
import { useSettingsStore } from '../settings/settings.store';
import { SmartHeader } from './SmartHeader';
import { EmptyState } from './EmptyState';
import { OfflineBanner } from './OfflineBanner';
import { useMessageQueueStore } from './messageQueue.store';
import { DraftBanner } from '../drafts/DraftBanner';
import { useDraftStore } from '../drafts/drafts.store';
import type { DraftItem } from '../drafts/types';
import { VoiceInput } from './VoiceInput';
import { EventFeed } from './EventFeed';

export function ChatView() {
  const {
    inputValue, isSending, error, isLoading, feed,
    setInput, loadFeed, refreshFeed, sendMessage, clearError, sendQueuedMessage,
    dismissEvent, actOnEvent,
  } = useChatStore();

  const { provider } = useSettingsStore();
  const queueStore = useMessageQueueStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drainLockRef = useRef(false);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      loadFeed();
    }
  }, [loadFeed]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    refreshFeed();
  }, [refreshFeed]);

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

  const isConfigured = provider?.isConfigured() ?? false;

  return (
    <div className="chat-container">
      <SmartHeader refreshKey={refreshKey} />

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
        {isLoading || (feed.length === 0 && isLoading) ? null : feed.length > 0 ? (
          <>
            <EventFeed
              feed={feed}
              isLoading={false}
              onDismissEvent={dismissEvent}
              onActEvent={actOnEvent}
              contentRef={contentRef}
            />

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

