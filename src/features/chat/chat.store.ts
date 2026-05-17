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
import * as db from '../../core/db/client';

interface ChatState {
  messages: Message[];
  inputValue: string;
  isSending: boolean;
  error: string | null;
  isLoading: boolean;

  // Actions
  setInput: (value: string) => void;
  loadMessages: () => Promise<void>;
  sendMessage: (provider: AIProvider) => Promise<AgentResponse | null>;
  undoDelete: (transactionId: string) => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  inputValue: '',
  isSending: false,
  error: null,
  isLoading: true,

  setInput: (value) => set({ inputValue: value }),

  loadMessages: async () => {
    try {
      const msgs = await db.getAllMessages();
      const parsed: Message[] = msgs.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : null,
        createdAt: m.createdAt,
      }));
      set({ messages: parsed, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to load messages', isLoading: false });
      console.error('[ChatStore] Failed to load messages:', error);
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
      const response = await processMessage(trimmed, messages, provider);

      // Reload messages from DB to get persisted IDs
      await get().loadMessages();

      set({ isSending: false });
      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Something went wrong';
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
      await db.undoDelete(transactionId);
    } catch (error) {
      console.error('[ChatStore] Undo failed:', error);
    }
  },

  clearError: () => set({ error: null }),
}));
