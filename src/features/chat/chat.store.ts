/**
 * Chat store — Zustand for UI-only ephemeral state.
 *
 * Input buffer, sending flag, error state.
 * Not for data persistence — that's the DB.
 */

import { create } from 'zustand';
import type { Message, AgentResponse } from '../../core/domain/types';
import { processMessage } from '../../core/agent/agent';
import type { AIProvider } from '../../core/providers/types';
import { messageRepo, transactionRepo } from '../../core/composition-root';
import { logger } from '../../core/logger';

interface ChatState {
  messages: Message[];
  inputValue: string;
  isSending: boolean;
  error: string | null;
  isLoading: boolean;
  latestResponse: string | null;

  // Actions
  setInput: (value: string) => void;
  loadMessages: () => Promise<void>;
  sendMessage: (provider: AIProvider) => Promise<AgentResponse | null>;
  clearLatestResponse: () => void;
  undoDelete: (transactionId: string) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  updateTransactionCategory: (transactionId: string, category: string) => Promise<void>;
  updateTransactionFromDb: (transactionId: string) => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  inputValue: '',
  isSending: false,
  error: null,
  isLoading: true,
  latestResponse: null,

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

  sendMessage: async (provider) => {
    const { inputValue, messages } = get();
    const trimmed = inputValue.trim();
    if (!trimmed || get().isSending) return null;

    set({ isSending: true, error: null, inputValue: '' });

    // Optimistically add user message to UI
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      toolCalls: null,
      createdAt: Date.now(),
    };
    set({ messages: [...messages, userMsg] });

    try {
      logger.info('chat:sendMessage', {
        provider: provider.id,
        messageLength: trimmed.length,
        historyLength: messages.length,
      });

      const response = await processMessage(trimmed, messages, provider);

      // Reload messages from DB to get persisted IDs
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
      set({
        isSending: false,
        error: errorMessage,
      });
      console.error('[ChatStore] Send failed:', error);
      // Reload messages to remove optimistic user message
      await get().loadMessages();
      return null;
    }
  },

  undoDelete: async (transactionId) => {
    try {
      await transactionRepo.undoDelete(transactionId);
    } catch (error) {
      console.error('[ChatStore] Undo failed:', error);
    }
  },

  deleteTransaction: async (transactionId) => {
    try {
      await transactionRepo.softDelete(transactionId);
    } catch (error) {
      console.error('[ChatStore] Delete failed:', error);
    }
  },

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

  clearError: () => set({ error: null }),
}));
