/**
 * Chat store — Zustand for UI-only ephemeral state.
 *
 * The feed is built from three sources:
 *   - Transaction cards: loaded directly from transactionRepo (bypasses events)
 *   - Query-response cards: loaded from ai_query_response events
 *   - System event cards: loaded from other pending events
 */

import { create } from 'zustand';
import type { Message, AgentResponse, FeedItem, Transaction } from '../../core/domain/types';
import { processMessage } from '../../core/agent/agent';
import type { AIProvider } from '../../core/providers/types';
import { messageRepo, transactionRepo, eventRepo } from '../../core/composition-root';
import { logger } from '../../core/logger';
import { useMessageQueueStore } from './messageQueue.store';

export type FeedFilter = 'all' | 'transactions' | 'queries' | 'notifications';

interface ChatState {
  messages: Message[];
  inputValue: string;
  isSending: boolean;
  error: string | null;
  isLoading: boolean;
  latestResponse: string | null;
  feed: FeedItem[];
  feedFilter: FeedFilter;
  includedItems: Array<{ id: string; type: string; label: string }>;
  deleteUndo: { id: string; title: string } | null;
  dismissedChips: string[];
  chipRefresh: number;
  feedVersion: number;

  // Actions
  setInput: (value: string) => void;
  loadMessages: () => Promise<void>;
  loadFeed: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  sendMessage: (provider: AIProvider) => Promise<AgentResponse | null>;
  sendQueuedMessage: (content: string, provider: AIProvider) => Promise<void>;
  clearLatestResponse: () => void;
  undoDelete: (transactionId: string) => Promise<void>;
  deleteTransaction: (transactionId: string, transactionLabel: string) => Promise<void>;
  clearDeleteUndo: () => void;
  updateTransactionCategory: (transactionId: string, category: string) => Promise<void>;
  updateTransactionFromDb: (transactionId: string) => Promise<void>;
  dismissEvent: (id: string) => Promise<void>;
  actOnEvent: (id: string) => Promise<void>;
  addIncludedItem: (id: string, type: string, label: string) => void;
  removeIncludedItem: (id: string) => void;
  clearIncludedItems: () => void;
  dismissChip: (id: string) => void;
  triggerChipRefresh: () => void;
  setFeedFilter: (filter: FeedFilter) => void;
  clearError: () => void;
}

async function executeSend(
  trimmed: string,
  history: Message[],
  provider: AIProvider,
  set: (partial: Partial<ChatState>) => void,
  get: () => ChatState
): Promise<AgentResponse | null> {
  set({ isSending: true, error: null });

  const includedItems = get().includedItems;
  const userContent = includedItems.length > 0
    ? `[Attached: ${includedItems.map(i => `${i.type} "${i.label}"`).join(', ')}]\n\n${trimmed}`
    : trimmed;

  const userMsg: Message = {
    id: `temp-${Date.now()}`,
    role: 'user',
    content: userContent,
    toolCalls: null,
    createdAt: Date.now(),
  };
  set({ messages: [...history, userMsg], includedItems: [] });

  try {
    logger.info('chat:sendMessage', {
      provider: provider.id,
      messageLength: userContent.length,
      historyLength: history.length,
    });

    const response = await processMessage(userContent, history, provider);

    await get().loadMessages();

    logger.info('chat:sendMessageComplete', {
      provider: provider.id,
      toolsUsed: response.toolsUsed.map((tc) => tc.name),
      responseLength: response.text.length,
    });

    set({ isSending: false, latestResponse: response.text });
    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Something went wrong';
    logger.error('chat:sendMessageFailed', error instanceof Error ? error : new Error(errorMessage), {
      provider: provider.id,
    });
    set({ isSending: false, error: errorMessage });
    console.error('[ChatStore] Send failed:', error);
    await get().loadMessages();
    return null;
  }
}

async function buildFeed(): Promise<FeedItem[]> {
  const [recentTxns, evts] = await Promise.all([
    transactionRepo.getRecent(50),
    eventRepo.getRecent(100),
  ]);

  const items: FeedItem[] = [];

  for (const txn of recentTxns) {
    items.push({
      kind: 'transaction',
      transaction: txn,
      timestamp: txn.createdAt,
    });
  }

  for (const evt of evts) {
    if (evt.status !== 'pending') continue;
    if (evt.type === 'transaction_logged') continue;

    if (evt.type === 'ai_query_response') {
      const data = evt.data as Record<string, unknown> | null;
      items.push({
        kind: 'query-response',
        queryText: (data?.queryText as string) ?? '',
        responseText: (data?.fullResponse as string) ?? evt.body,
        event: evt,
        timestamp: evt.createdAt,
      });
    } else {
      items.push({
        kind: 'event',
        event: evt,
        timestamp: evt.createdAt,
      });
    }
  }

  items.sort((a, b) => b.timestamp - a.timestamp);
  return items;
}

async function dismissTransactionEvents(transactionId: string): Promise<void> {
  try {
    const events = await eventRepo.getAll();
    for (const evt of events) {
      if (evt.type !== 'transaction_logged' || evt.status !== 'pending') continue;
      const data = evt.data as Record<string, unknown> | null;
      if ((data?.transactionId as string) === transactionId) {
        await eventRepo.updateStatus(evt.id, 'dismissed');
      }
    }
  } catch {
    // Best-effort
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  inputValue: '',
  isSending: false,
  error: null,
  isLoading: true,
  latestResponse: null,
  feed: [],
  feedFilter: 'all',
  includedItems: [],
  deleteUndo: null,
  dismissedChips: [],
  chipRefresh: 0,
  feedVersion: 0,

  setInput: (value) => set({ inputValue: value }),

  clearLatestResponse: () => set({ latestResponse: null }),

  loadMessages: async () => {
    try {
      const msgs = await messageRepo.getAll();
      set({ messages: msgs, isLoading: false });
      logger.debug('chat:loadMessages', { count: msgs.length });
    } catch (error) {
      set({ error: 'Failed to load messages', isLoading: false });
      logger.error('chat:loadMessagesFailed', error instanceof Error ? error : new Error(String(error)));
    }
  },

  loadFeed: async () => {
    try {
      const items = await buildFeed();
      set({ feed: items, isLoading: false });
      logger.debug('chat:loadFeed', { feed: items.length });
    } catch (error) {
      set({ error: 'Failed to load feed', isLoading: false });
      logger.error('chat:loadFeedFailed', error instanceof Error ? error : new Error(String(error)));
    }
  },

  refreshFeed: async () => {
    try {
      const items = await buildFeed();
      set({ feed: items, feedVersion: get().feedVersion + 1 });
    } catch {
      // Best-effort refresh
    }
  },

  sendMessage: async (provider) => {
    const { inputValue, messages } = get();
    const trimmed = inputValue.trim();
    if (!trimmed || get().isSending) return null;

    const queueStore = useMessageQueueStore.getState();

    if (!queueStore.isOnline) {
      set({ inputValue: '' });
      const userMsg: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: trimmed,
        toolCalls: null,
        createdAt: Date.now(),
      };
      set({ messages: [...messages, userMsg] });
      queueStore.enqueue(trimmed);
      return null;
    }

    set({ inputValue: '' });
    return executeSend(trimmed, messages, provider, set, get);
  },

  sendQueuedMessage: async (content, provider) => {
    const { messages } = get();
    const queueStore = useMessageQueueStore.getState();

    await executeSend(content, messages, provider, set, get);
    queueStore.dequeue();
  },

  undoDelete: async (transactionId) => {
    try {
      await transactionRepo.undoDelete(transactionId);
      const pendingEvents = await eventRepo.getAll();
      for (const evt of pendingEvents) {
        if (evt.type !== 'transaction_logged') continue;
        const data = evt.data as Record<string, unknown> | null;
        if ((data?.transactionId as string) === transactionId && evt.status === 'dismissed') {
          await eventRepo.updateStatus(evt.id, 'pending');
        }
      }
      set({ deleteUndo: null });
      await get().refreshFeed();
    } catch (error) {
      console.error('[ChatStore] Undo failed:', error);
    }
  },

  deleteTransaction: async (transactionId, transactionLabel) => {
    try {
      await transactionRepo.softDelete(transactionId);
      await dismissTransactionEvents(transactionId);
      set({
        deleteUndo: { id: transactionId, title: transactionLabel },
      });
      setTimeout(() => {
        const current = get().deleteUndo;
        if (current?.id === transactionId) {
          set({ deleteUndo: null });
        }
      }, 5000);
      await get().refreshFeed();
    } catch (error) {
      console.error('[ChatStore] Delete failed:', error);
    }
  },

  clearDeleteUndo: () => set({ deleteUndo: null }),

  updateTransactionCategory: async (transactionId, category) => {
    try {
      await transactionRepo.update(transactionId, { category, updatedAt: Date.now() });
    } catch (error) {
      console.error('[ChatStore] Category update failed:', error);
    }
  },

  updateTransactionFromDb: async (_transactionId) => {
    await get().loadMessages();
  },

  dismissEvent: async (id: string) => {
    try {
      await eventRepo.updateStatus(id, 'dismissed');
      await get().refreshFeed();
    } catch {
      console.error('[ChatStore] Event dismiss failed');
    }
  },

  actOnEvent: async (id: string) => {
    try {
      await eventRepo.updateStatus(id, 'acted');
      await get().refreshFeed();
    } catch {
      console.error('[ChatStore] Event act failed');
    }
  },

  addIncludedItem: (id, type, label) => {
    const items = get().includedItems;
    if (items.length >= 5) return;
    if (items.some(i => i.id === id)) return;
    set({ includedItems: [...items, { id, type, label }] });
  },

  removeIncludedItem: (id) => {
    set({ includedItems: get().includedItems.filter(i => i.id !== id) });
  },

  clearIncludedItems: () => set({ includedItems: [] }),

  dismissChip: (id) => {
    const current = get().dismissedChips;
    set({ dismissedChips: [...current, id] });
  },

  triggerChipRefresh: () => {
    set({ chipRefresh: get().chipRefresh + 1 });
  },

  setFeedFilter: (filter) => set({ feedFilter: filter }),

  clearError: () => set({ error: null }),
}));
