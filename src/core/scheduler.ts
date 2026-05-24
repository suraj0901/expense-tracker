/**
 * Pattern-detection scheduler — runs periodically to find spending habits.
 *
 * Queries the DB directly (no AI credits consumed). Detects repeated
 * patterns: same category + similar amount (±20%) appearing 3+ times.
 */
import { paiseToRupees } from './domain/money';
import type { Paise } from './domain/money';
import { processAutoLogRules } from './recurring';
import { transactionRepo, merchantHintRepo } from './composition-root';
import { autoBackup } from './db/client';

export interface Suggestion {
  id: string;
  text: string;
  category?: string;
  typicalAmount?: number; // rupees
  merchant?: string;
  createdAt: number;
}

type Listener = (s: Suggestion) => void;

class Scheduler {
  private listeners: Listener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private backupIntervalId: ReturnType<typeof setInterval> | null = null;
  private dismissedIds = new Set<string>();

  private readonly INTERVAL_MS = 30 * 60 * 1000;
  private readonly BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

  onSuggestion(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  dismissSuggestion(id: string): void {
    this.dismissedIds.add(id);
  }

  private emit(s: Suggestion): void {
    if (this.dismissedIds.has(s.id)) return;
    for (const fn of this.listeners) fn(s);
  }

  async tick(): Promise<void> {
    try {
      await processAutoLogRules();

      const recent = await transactionRepo.getRecent(50);
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
        const sorted = [...data.amounts].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const similar = sorted.filter((a) => median > 0 && Math.abs(a - median) / median < 0.2);
        if (similar.length >= 3) {
          const avg = Math.round(similar.reduce((s, a) => s + a, 0) / similar.length);
          const mid = data.merchant ? ` at ${data.merchant}` : '';
          this.emit({
            id: `pattern-${category}-${avg}`,
            text: `~₹${avg} ${category}${mid}`,
            category,
            typicalAmount: avg,
            merchant: data.merchant ?? undefined,
            createdAt: Date.now(),
          });
        }
      }
      const hints = await merchantHintRepo.getTop(20);
      for (const h of hints) {
        if ((h.useCount ?? 0) < 3) continue;
        this.emit({
          id: `hint-${h.canonicalName}`,
          text: `You've logged "${h.canonicalName}" ${h.useCount} times as ${h.category}. I'll auto-categorize future entries.`,
          createdAt: Date.now(),
        });
      }
    } catch {
      // Scheduler failures are silent — don't bother the user
    }
  }

  start(): void {
    if (this.intervalId) return;
    setTimeout(() => this.tick(), 2 * 60 * 1000);
    this.intervalId = setInterval(() => this.tick(), this.INTERVAL_MS);
    setTimeout(() => autoBackup(), 5 * 60 * 1000);
    this.backupIntervalId = setInterval(() => autoBackup(), this.BACKUP_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.tick();
    });
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    if (this.backupIntervalId) { clearInterval(this.backupIntervalId); this.backupIntervalId = null; }
  }
}

let _instance: Scheduler | null = null;
function getInstance(): Scheduler {
  if (!_instance) _instance = new Scheduler();
  return _instance;
}

export function onSuggestion(fn: Listener): () => void {
  return getInstance().onSuggestion(fn);
}

export function dismissSuggestion(id: string): void {
  getInstance().dismissSuggestion(id);
}

export async function tick(): Promise<void> {
  return getInstance().tick();
}

export function startScheduler(): void {
  getInstance().start();
}

export function stopScheduler(): void {
  getInstance().stop();
}
