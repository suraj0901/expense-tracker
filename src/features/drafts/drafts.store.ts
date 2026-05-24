/**
 * Draft queue — Zustand store for parsed-but-unconfirmed transactions.
 *
 * Drafts come from SMS shares and are shown for one-tap confirmation.
 * Persisted to OPFS so they survive page refreshes.
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { DraftItem } from './types';
import { DRAFT_QUEUE_KEY } from './types';
import { kvGet, kvSet } from '../../core/platform/kv-store';

function loadDrafts(): DraftItem[] {
  try {
    const raw = kvGet(DRAFT_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: DraftItem[]): void {
  kvSet(DRAFT_QUEUE_KEY, JSON.stringify(drafts));
}

interface DraftStore {
  drafts: DraftItem[];

  add: (item: DraftItem) => void;
  addFromText: (text: string, amount?: number | null, merchant?: string | null) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  reload: () => void;
}

export const useDraftStore = create<DraftStore>((set, get) => ({
  drafts: loadDrafts(),

  add: (item) => {
    const drafts = [...get().drafts, item];
    saveDrafts(drafts);
    set({ drafts });
  },

  addFromText: (text, amount = null, merchant = null) => {
    const draft: DraftItem = {
      id: nanoid(),
      text,
      amount,
      merchant,
      date: null,
      createdAt: Date.now(),
    };
    const drafts = [...get().drafts, draft];
    saveDrafts(drafts);
    set({ drafts });
  },

  remove: (id) => {
    const drafts = get().drafts.filter((d) => d.id !== id);
    saveDrafts(drafts);
    set({ drafts });
  },

  clearAll: () => {
    saveDrafts([]);
    set({ drafts: [] });
  },

  reload: () => {
    set({ drafts: loadDrafts() });
  },
}));
