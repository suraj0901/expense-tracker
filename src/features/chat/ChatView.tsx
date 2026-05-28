/**
 * ChatView — SmartHeader + EventFeed + input.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ArrowUp, Loader2, AlertTriangle, Key, X, Undo2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import { useChatStore, type FeedFilter } from './chat.store';
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
import { CategoryPicker } from './CategoryPicker';
import { transactionRepo, merchantHintRepo, summaryRepo } from '../../core/composition-root';
import { rupeesToPaise } from '../../core/domain/money';
import { upsertRuleFromSuggestion } from '../../core/recurring';
import type { FeedItem, BudgetStatusItem } from '../../core/domain/types';

export function ChatView() {
  const {
    inputValue, isSending, error, isLoading, feed, includedItems, deleteUndo,
    dismissedChips, chipRefresh, feedVersion, feedFilter, setFeedFilter, setInput, loadFeed, refreshFeed, sendMessage,
    clearError, sendQueuedMessage, dismissEvent, actOnEvent, deleteTransaction,
    undoDelete, clearDeleteUndo, addIncludedItem, removeIncludedItem,
    dismissChip, triggerChipRefresh,
  } = useChatStore();

  const { provider } = useSettingsStore();
  const queueStore = useMessageQueueStore();
  const [editItem, setEditItem] = useState<FeedItem | null>(null);
  const [pickCategoryEventId, setPickCategoryEventId] = useState<string | null>(null);
  const [budgetStatusCache, setBudgetStatusCache] = useState<Map<string, BudgetStatusItem>>(new Map());
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
    refreshFeed();
  }, [refreshFeed]);

  // Load budget status for transaction cards
  useEffect(() => {
    summaryRepo.getBudgetStatus().then((status) => {
      const map = new Map<string, BudgetStatusItem>();
      for (const item of status.items) {
        map.set(item.category, item);
      }
      setBudgetStatusCache(map);
    }).catch(() => {});
  }, [feedVersion]);

  const handleCategoryPick = useCallback(async (category: string) => {
    if (!pickCategoryEventId) return;
    const evt = feed.find(f => f.event?.id === pickCategoryEventId)?.event;
    const data = evt?.data as Record<string, unknown> | null;
    const merchant = data?.merchant as string;
    if (merchant && category) {
      merchantHintRepo.upsert(merchant, category);
    }
    dismissEvent(pickCategoryEventId);
    setPickCategoryEventId(null);
  }, [pickCategoryEventId, feed, dismissEvent]);

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

  const handleActEvent = useCallback(async (eventId: string, action: string) => {
    if (action.startsWith('confirm:')) {
      const evt = feed.find(f => f.event?.id === eventId)?.event;
      const data = evt?.data as Record<string, unknown> | null;
      const category = action.replace('confirm:', '');
      const merchant = data?.merchant as string;
      if (merchant && category) {
        merchantHintRepo.upsert(merchant, category);
      }
      dismissEvent(eventId);
    } else if (action === 'ask_always') {
      const evt = feed.find(f => f.event?.id === eventId)?.event;
      const data = evt?.data as Record<string, unknown> | null;
      const merchant = data?.merchant as string;
      const category = data?.suggestedCategory as string;
      if (merchant && category) {
        merchantHintRepo.upsert(merchant, category, 'ask_always');
      }
      dismissEvent(eventId);
    } else if (action === 'never_ask') {
      const evt = feed.find(f => f.event?.id === eventId)?.event;
      const data = evt?.data as Record<string, unknown> | null;
      const merchant = data?.merchant as string;
      if (merchant) {
        merchantHintRepo.update(merchant.toLowerCase().trim(), { confirmStrategy: 'dismissed' });
      }
      dismissEvent(eventId);
    } else if (action === 'log') {
      const evt = feed.find(f => f.event?.id === eventId)?.event;
      const data = evt?.data as Record<string, unknown> | null;
      if (data?.category && data?.typicalAmount !== undefined) {
        const today = format(new Date(), 'yyyy-MM-dd');
        await transactionRepo.insert({
          id: nanoid(),
          amount: rupeesToPaise((data.typicalAmount as number) ?? 0),
          type: 'expense',
          category: data.category as string,
          merchant: (data.merchant as string) ?? null,
          note: null,
          date: today,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDeleted: false,
        });
        upsertRuleFromSuggestion({
          id: eventId,
          text: '',
          category: data.category as string,
          typicalAmount: data.typicalAmount as number,
          merchant: (data.merchant as string) ?? undefined,
          createdAt: Date.now(),
        });
      }
      dismissEvent(eventId);
      triggerRefresh();
    } else if (action === 'create_rule') {
      const evt = feed.find(f => f.event?.id === eventId)?.event;
      const data = evt?.data as Record<string, unknown> | null;
      if (data?.category && data?.typicalAmount !== undefined) {
        upsertRuleFromSuggestion({
          id: eventId,
          text: '',
          category: data.category as string,
          typicalAmount: data.typicalAmount as number,
          merchant: (data.merchant as string) ?? undefined,
          createdAt: Date.now(),
        });
      }
      dismissEvent(eventId);
      triggerRefresh();
    } else if (action === 'view_goals') {
      window.location.hash = '/recurring';
      dismissEvent(eventId);
    } else if (action === 'read_more') {
      window.location.hash = '/dashboard';
      dismissEvent(eventId);
    } else if (action === 'pick_category') {
      setPickCategoryEventId(eventId);
    } else {
      actOnEvent(eventId);
    }
  }, [feed, dismissEvent, actOnEvent, triggerRefresh, setPickCategoryEventId]);

  const handleEditEvent = (item: FeedItem) => {
    setEditItem(item);
  };

  const handleEditSaved = () => {
    setEditItem(null);
    triggerRefresh();
  };

  const isConfigured = provider?.isConfigured() ?? false;

  const filteredFeed = useMemo(() => {
    if (feedFilter === 'all') return feed;
    if (feedFilter === 'transactions') return feed.filter((f) => f.kind === 'transaction');
    return feed.filter((f) => f.kind === 'query-response' || f.kind === 'event');
  }, [feed, feedFilter]);

  const TAB_OPTIONS: { key: FeedFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'queries', label: 'Queries' },
  ];

  return (
    <div className="chat-container">
      <SmartHeader refreshKey={feedVersion} />

      <div className="feed-tabs">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            className={`feed-tab ${feedFilter === tab.key ? 'feed-tab--active' : ''}`}
            onClick={() => setFeedFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
        {isSending && (
          <div className="thinking-placeholder">
            <div className="thinking-shimmer-bar" />
            <span className="thinking-label">Thinking…</span>
          </div>
        )}

        {isLoading || (filteredFeed.length === 0 && isLoading) ? null : filteredFeed.length > 0 ? (
          <EventFeed
            feed={filteredFeed}
            isLoading={false}
            budgetStatus={budgetStatusCache}
            onDismissEvent={dismissEvent}
            onActEvent={handleActEvent}
            onEditEvent={handleEditEvent}
            onDeleteTransaction={deleteTransaction}
            onUndoDelete={undoDelete}
            contentRef={contentRef}
          />
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
        <SuggestionStrip
          isCollapsed={inputValue.length > 0}
          dismissedIds={dismissedChips}
          onDismiss={dismissChip}
          onLogged={triggerRefresh}
          refreshTrigger={chipRefresh}
        />
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

      <CategoryPicker
        open={pickCategoryEventId !== null}
        selected={null}
        onSelect={handleCategoryPick}
        onClose={() => setPickCategoryEventId(null)}
      />
    </div>
  );
}

