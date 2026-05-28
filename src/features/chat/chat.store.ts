/**
 * Chat store — Zustand for UI-only ephemeral state.
 *
 * Input buffer, sending flag, error state.
 * Not for data persistence — that's the DB.
 */

import { create } from 'zustand';
import type { Message, AgentResponse, FeedItem } from '../../core/domain/types';
import { processMessage } from '../../core/agent/agent';
import type { AIProvider } from '../../core/providers/types';
import { messageRepo, transactionRepo, eventRepo } from '../../core/composition-root';
import { logger } from '../../core/logger';
import { useMessageQueueStore } from './messageQueue.store';

interface ChatState {
  messages: Message[];
  inputValue: string;
  isSending: boolean;
  error: string | null;
  isLoading: boolean;
  latestResponse: string | null;
  feed: FeedItem[];
  includedItems: Array<{ id: string; type: string; label: string }>;
  deleteUndo: { id: string; title: string } | null;
  dismissedChips: string[];
  chipRefresh: number;

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
    // Reload messages to remove optimistic user message
    await get().loadMessages();
    return null;
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
  includedItems: [],
  deleteUndo: null,
  dismissedChips: [],
  chipRefresh: 0,

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
      const [msgs, evts] = await Promise.all([
        messageRepo.getAll(),
        eventRepo.getRecent(100),
      ]);
      const items: FeedItem[] = [
        ...msgs.filter(m => m.role === 'user').map(m => ({ kind: 'message' as const, message: m, timestamp: m.createdAt })),
        ...evts.filter(e => e.status === 'pending').map(e => ({ kind: 'event' as const, event: e, timestamp: e.createdAt })),
      ].sort((a, b) => a.timestamp - b.timestamp);
      set({ feed: items, isLoading: false });
      logger.debug('chat:loadFeed', { userMessages: msgs.filter(m => m.role === 'user').length, events: evts.length, feed: items.length });
    } catch (error) {
      set({ error: 'Failed to load feed', isLoading: false });
      logger.error('chat:loadFeedFailed', error instanceof Error ? error : new Error(String(error)));
    }
  },

  refreshFeed: async () => {
    try {
      const [msgs, evts] = await Promise.all([
        messageRepo.getAll(),
        eventRepo.getRecent(100),
      ]);
      const items: FeedItem[] = [
        ...msgs.filter(m => m.role === 'user').map(m => ({ kind: 'message' as const, message: m, timestamp: m.createdAt })),
        ...evts.filter(e => e.status === 'pending').map(e => ({ kind: 'event' as const, event: e, timestamp: e.createdAt })),
      ].sort((a, b) => a.timestamp - b.timestamp);
      set({ feed: items });
    } catch {
      // Best-effort refresh
    }
  },

  sendMessage: async (provider) => {
    const { inputValue, messages } = get();
    const trimmed = inputValue.trim();
    if (!trimmed || get().isSending) return null;

    const queueStore = useMessageQueueStore.getState();

    // If offline, enqueue the message and show it in UI
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
      set({ deleteUndo: null });
      await get().refreshFeed();
    } catch (error) {
      console.error('[ChatStore] Undo failed:', error);
    }
  },

  deleteTransaction: async (transactionId, transactionLabel) => {
    try {
      await transactionRepo.softDelete(transactionId);
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
    // Reload messages to reflect the change from DB
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

  clearError: () => set({ error: null }),
}));
