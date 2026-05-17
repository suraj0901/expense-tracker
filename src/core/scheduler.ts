/**
 * Pattern-detection scheduler — runs periodically to find spending habits.
 *
 * Queries the DB directly (no AI credits consumed). Detects repeated
 * patterns: same category + similar amount (±20%) appearing 3+ times.
 */
import { queryTransactions, getRecent, getMerchantHints } from './db/client';
import { paiseToRupees } from './domain/money';
import type { Paise } from './domain/money';

export interface Suggestion {
  id: string;
  text: string;
  category?: string;
  typicalAmount?: number; // rupees
  merchant?: string;
  createdAt: number;
}

type Listener = (s: Suggestion) => void;
let listeners: Listener[] = [];
let intervalId: ReturnType<typeof setInterval> | null = null;
let dismissedIds = new Set<string>();

const INTERVAL_MS = 30 * 60 * 1000; // 30 min

export function onSuggestion(fn: Listener): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export function dismissSuggestion(id: string): void {
  dismissedIds.add(id);
}

function emit(s: Suggestion): void {
  if (dismissedIds.has(s.id)) return;
  for (const fn of listeners) fn(s);
}

async function tick(): Promise<void> {
  try {
    const recent = await getRecent(50);
    const groups = new Map<string, { amounts: number[]; merchant: string | null }>();
    for (const t of recent) {
      if (t.type !== 'expense') continue;
      const key = t.category;
      const entry = groups.get(key) || { amounts: [], merchant: t.merchant };
      entry.amounts.push(paiseToRupees(t.amount as Paise));
      groups.set(key, entry);
    }
    for (const [category, data] of groups) {
      if (data.amounts.length < 3) continue;
      // Check for similar amounts (±20% of median)
      const sorted = [...data.amounts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const similar = sorted.filter((a) => median > 0 && Math.abs(a - median) / median < 0.2);
      if (similar.length >= 3) {
        const avg = Math.round(similar.reduce((s, a) => s + a, 0) / similar.length);
        const mid = data.merchant ? ` at ${data.merchant}` : '';
        emit({
          id: `pattern-${category}-${avg}`,
          text: `~₹${avg} ${category}${mid}`,
          category,
          typicalAmount: avg,
          merchant: data.merchant ?? undefined,
          createdAt: Date.now(),
        });
      }
    }
    // Also check merchant hints for strong patterns
    const hints = await getMerchantHints(20);
    for (const h of hints) {
      if ((h.useCount ?? 0) < 3) continue;
      emit({
        id: `hint-${h.canonicalName}`,
        text: `You've logged "${h.canonicalName}" ${h.useCount} times as ${h.category}. I'll auto-categorize future entries.`,
        createdAt: Date.now(),
      });
    }
  } catch {
    // Scheduler failures are silent — don't bother the user
  }
}

export function startScheduler(): void {
  if (intervalId) return;
  setTimeout(tick, 2 * 60 * 1000); // first run after 2 min
  intervalId = setInterval(tick, INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
}

export function stopScheduler(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}
