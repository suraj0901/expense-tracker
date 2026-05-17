/**
 * ChatView — the primary view. Message list + input box.
 */

import { useEffect, useRef } from 'react';
import { useChatStore } from './chat.store';
import { useSettingsStore } from '../settings/settings.store';
import { MessageBubble } from './MessageBubble';

const SUGGESTIONS = [
  '☕ "chai 15 at tapri"',
  '🚗 "auto 25, bus 20"',
  '📊 "how much did I spend on food this month?"',
  '📝 "show me my May report"',
];

export function ChatView() {
  const {
    messages,
    inputValue,
    isSending,
    error,
    isLoading,
    setInput,
    loadMessages,
    sendMessage,
    clearError,
  } = useChatStore();

  const { provider } = useSettingsStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async () => {
    if (!provider) return;
    await sendMessage(provider);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    // Extract the text between quotes
    const match = suggestion.match(/"([^"]+)"/);
    if (match) {
      setInput(match[1]);
      inputRef.current?.focus();
    }
  };

  const isConfigured = provider?.isConfigured() ?? false;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>💰 Expense Tracker</h1>
        <p>Tell me what you spent — I'll handle the rest</p>
      </div>

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
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-icon">💬</div>
            <h2>Start tracking expenses</h2>
            <p>Just tell me what you spent in natural language. Try one of these:</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </>
        )}

        {isSending && (
          <div className="message assistant">
            <div className="message-bubble">
              <div className="typing-indicator">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
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
