/**
 * ChatView — SmartHeader + SuggestionStrip + message feed + input.
 */
import { useEffect, useRef, useState, useCallback, Fragment } from 'react';
import { useChatStore } from './chat.store';
import { useSettingsStore } from '../settings/settings.store';
import { MessageBubble } from './MessageBubble';
import { SmartHeader } from './SmartHeader';
import { SuggestionStrip } from './SuggestionStrip';
import { DateSeparator, dateKey } from './DateSeparator';
import { EmptyState } from './EmptyState';
import { onSuggestion, type Suggestion } from '../../core/scheduler';
import { DraftBanner } from '../drafts/DraftBanner';
import { useDraftStore } from '../drafts/drafts.store';
import type { DraftItem } from '../drafts/types';
import { VoiceInput } from './VoiceInput';

export function ChatView() {
  const {
    messages, inputValue, isSending, error, isLoading,
    setInput, loadMessages, sendMessage, clearError,
  } = useChatStore();

  const { provider } = useSettingsStore();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    return onSuggestion((s) => setSuggestion(s));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

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

  // Group messages by date for separators
  let lastDateKey = '';

  return (
    <div className="chat-container">
      <SmartHeader refreshKey={refreshKey} />

      <SuggestionStrip
        suggestion={suggestion}
        onClear={handleSuggestionClear}
        onLogged={triggerRefresh}
      />

      <DraftBanner onLog={handleDraftLog} onDismiss={handleDraftDismiss} />

      {!isConfigured && (
        <div className="setup-banner">
          <span>🔑</span>
          <span>
            Add your API key in{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = '/settings'; }}>
              Settings
            </a>{' '}
            to start chatting
          </span>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={clearError}>✕</button>
        </div>
      )}

      <div className="chat-messages">
        {isLoading ? (
          <div className="chat-empty">
            <div className="typing-indicator">
              <div className="dot" /><div className="dot" /><div className="dot" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState onQuickLog={triggerRefresh} />
        ) : (
          <>
            {messages.map((msg) => {
              const dk = dateKey(msg.createdAt);
              const showSeparator = dk !== lastDateKey;
              lastDateKey = dk;

              return (
                <Fragment key={msg.id}>
                  {showSeparator && <DateSeparator timestamp={msg.createdAt} />}
                  <MessageBubble message={msg} />
                </Fragment>
              );
            })}

          </>
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

        <div ref={messagesEndRef} />
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
            {isSending ? '⏳' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
