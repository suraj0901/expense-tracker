/**
 * ChatView — SmartHeader + EventFeed + input.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowUp, Loader2, AlertTriangle, Key, X, Undo2 } from 'lucide-react';
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
import { SuggestionStrip } from './SuggestionStrip';
import { EventFeed } from './EventFeed';
import { EditTransactionModal } from './EditTransactionModal';
import { merchantHintRepo } from '../../core/composition-root';
import type { FeedItem } from '../../core/domain/types';

export function ChatView() {
  const {
    inputValue, isSending, error, isLoading, feed, includedItems, deleteUndo,
    dismissedChips, chipRefresh, setInput, loadFeed, refreshFeed, sendMessage,
    clearError, sendQueuedMessage, dismissEvent, actOnEvent, deleteTransaction,
    undoDelete, clearDeleteUndo, addIncludedItem, removeIncludedItem,
    dismissChip, triggerChipRefresh,
  } = useChatStore();

  const { provider } = useSettingsStore();
  const queueStore = useMessageQueueStore();
  const [refreshKey, setRefreshKey] = useState(0);
  const [editItem, setEditItem] = useState<FeedItem | null>(null);
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

  const handleActEvent = (eventId: string, action: string) => {
    if (action === 'delete') {
      const event = feed.find(f => f.event?.id === eventId)?.event;
      const data = event?.data as Record<string, unknown> | null;
      const txnId = data?.transactionId as string;
      const label = data?.category ? `${String(data.category)} ₹${String(data.amount ? Number(data.amount) / 100 : 0)}` : 'transaction';
      if (txnId) deleteTransaction(txnId, label);
    } else if (action === 'include') {
      const event = feed.find(f => f.event?.id === eventId)?.event;
      const data = event?.data as Record<string, unknown> | null;
      const txnId = data?.transactionId as string;
      if (txnId) {
        const rawAmt = Number(data?.amount ?? 0);
        const amt = rawAmt > 0 ? `₹${(rawAmt / 100).toFixed(0)}` : '';
        const merchant = data?.merchant ? ` at ${String(data.merchant)}` : '';
        addIncludedItem(txnId, 'Transaction', `${amt}${merchant}`);
      }
    } else if (action.startsWith('confirm:')) {
      const event = feed.find(f => f.event?.id === eventId)?.event;
      const data = event?.data as Record<string, unknown> | null;
      const category = action.replace('confirm:', '');
      const merchant = data?.merchant as string;
      if (merchant && category) {
        merchantHintRepo.upsert(merchant, category);
      }
      dismissEvent(eventId);
    } else if (action === 'ask_always') {
      const event = feed.find(f => f.event?.id === eventId)?.event;
      const data = event?.data as Record<string, unknown> | null;
      const merchant = data?.merchant as string;
      const category = data?.suggestedCategory as string;
      if (merchant && category) {
        merchantHintRepo.upsert(merchant, category, 'ask_always');
      }
      dismissEvent(eventId);
    } else if (action === 'pick_category') {
      // Store the event ID for category picker context
      actOnEvent(eventId);
    } else {
      actOnEvent(eventId);
    }
  };

  const handleEditEvent = (item: FeedItem) => {
    setEditItem(item);
  };

  const handleEditSaved = () => {
    setEditItem(null);
    triggerRefresh();
  };

  const isConfigured = provider?.isConfigured() ?? false;

  return (
    <div className="chat-container">
      <SmartHeader refreshKey={refreshKey} />

      <DraftBanner onLog={handleDraftLog} onDismiss={handleDraftDismiss} />

      <OfflineBanner />

      <SuggestionStrip
        isCollapsed={inputValue.length > 0}
        dismissedIds={dismissedChips}
        onDismiss={dismissChip}
        onLogged={triggerRefresh}
        refreshTrigger={chipRefresh}
      />

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
              onActEvent={handleActEvent}
              onEditEvent={handleEditEvent}
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

      {includedItems.length > 0 && (
        <div className="included-items-bar">
          {includedItems.map((item) => (
            <span key={item.id} className="included-item-chip">
              {item.label}
              <button onClick={() => removeIncludedItem(item.id)}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {deleteUndo && (
        <div className="undo-toast">
          <span>Deleted: {deleteUndo.title}</span>
          <button onClick={() => undoDelete(deleteUndo.id)}>
            <Undo2 size={14} /> Undo
          </button>
          <button onClick={clearDeleteUndo}><X size={14} /></button>
        </div>
      )}

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

      {editItem && (
        <EditTransactionModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
}

