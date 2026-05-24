/**
 * Message queue store — manages offline message queue and online/offline detection.
 * Persists queue to OPFS so messages survive page refresh.
 */

import { create } from 'zustand';
import { logger } from '../../core/logger';
import { kvGet, kvSet } from '../../core/platform/kv-store';

interface QueuedMessage {
  id: string;
  content: string;
  createdAt: number;
}

const STORAGE_KEY = 'expense-tracker-message-queue';

function loadQueue(): QueuedMessage[] {
  try {
    const raw = kvGet(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMessage[]): void {
  try {
    kvSet(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    logger.error('messageQueue:saveFailed', e instanceof Error ? e : new Error(String(e)));
  }
}

interface MessageQueueState {
  isOnline: boolean;
  isDraining: boolean;
  queue: QueuedMessage[];

  enqueue: (message: string) => void;
  dequeue: () => void;
  clearQueue: () => void;
  setOnline: (online: boolean) => void;
  setDraining: (draining: boolean) => void;
}

export const useMessageQueueStore = create<MessageQueueState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isDraining: false,
  queue: loadQueue(),

  enqueue: (message) => {
    const item: QueuedMessage = {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      content: message,
      createdAt: Date.now(),
    };
    const newQueue = [...get().queue, item];
    set({ queue: newQueue });
    saveQueue(newQueue);
    logger.info('messageQueue:enqueue', { queueSize: newQueue.length });
  },

  dequeue: () => {
    const { queue } = get();
    if (queue.length === 0) return;
    const newQueue = queue.slice(1);
    set({ queue: newQueue });
    saveQueue(newQueue);
  },

  clearQueue: () => {
    set({ queue: [] });
    saveQueue([]);
  },

  setOnline: (online) => set({ isOnline: online }),
  setDraining: (draining) => set({ isDraining: draining }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useMessageQueueStore.getState().setOnline(true);
    logger.info('messageQueue:onlineDetected');
  });
  window.addEventListener('offline', () => {
    useMessageQueueStore.getState().setOnline(false);
    logger.info('messageQueue:offlineDetected');
  });
}
