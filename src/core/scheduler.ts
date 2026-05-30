/**
 * Pattern-detection scheduler — runs periodically to find spending habits.
 *
 * Two notification types for recurring patterns:
 *   1. Timed-log reminders — fire at the pattern's day/time (e.g., "Breakfast? 8:30am Wed")
 *   2. Rule-creation suggestions — for consistent patterns, ask "create a rule?"
 *
 * Pre-generates AI notification content at detection time. Never calls AI
 * at notification time. Uses static fallbacks when AI is unavailable.
 */
import { paiseToRupees } from './domain/money';
import type { Paise } from './domain/money';
import { processAutoLogRules } from './recurring';
import { transactionRepo, merchantHintRepo, eventRepo, goalRepo, insightRepo } from './composition-root';
import { autoBackup } from './db/client';
import { nanoid } from 'nanoid';
import { checkGoalMilestones } from './app/event-generators';
import type { PatternCandidate, PatternFinding } from './agent/proactive-agent';
import type { Transaction } from './domain/types';
import {
  computePatternTiming,
  upsertReminder,
  markReminderNotified,
  getPendingReminders,
  checkReminderExpiry,
  setRecentTransactionCache,
  staticNotificationBody,
  dayName,
} from './pattern-reminders';
import { kvGet, kvSet } from './platform/kv-store';

type PatternAnalyzer = (candidates: PatternCandidate[], txns: Transaction[]) => Promise<PatternFinding[]>;

let patternAnalyzer: PatternAnalyzer | null = null;

export function setPatternAnalyzer(fn: PatternAnalyzer | null): void {
  patternAnalyzer = fn;
}

export interface Suggestion {
  id: string;
  text: string;
  category?: string;
  typicalAmount?: number; // rupees
  merchant?: string;
  description?: string | null;
  notificationBody: string;
  notificationType: 'timed-log' | 'rule-creation';
  createdAt: number;
}

export interface TimedReminder {
  id: string;
  category: string;
  typicalAmount: number;
  merchant: string | null;
  description: string | null;
  notificationBody: string;
  createdAt: number;
}

type Listener = (s: Suggestion) => void;
type TimedReminderListener = (r: TimedReminder) => void;

const DISMISSED_STORAGE_KEY = 'expense-tracker:dismissed-suggestions';
const NOTIFIED_HINTS_KEY = 'expense-tracker:notified-hints';

class Scheduler {
  private listeners: Listener[] = [];
  private timedReminderListeners: TimedReminderListener[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private backupIntervalId: ReturnType<typeof setInterval> | null = null;
  private dismissedIds = new Set<string>();
  private lastTickTime = 0;
  private notifiedHints: { date: string; ids: Set<string> } = { date: '', ids: new Set() };
  private recentEventKeys = new Set<string>();

  private readonly INTERVAL_MS = 30 * 60 * 1000;
  private readonly BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  private readonly TICK_COOLDOWN_MS = 10 * 60 * 1000;
  private readonly MAX_EMITS_PER_TICK = 3;
  private readonly MAX_PENDING_REMINDERS = 2;

  onSuggestion(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  onTimedReminder(fn: TimedReminderListener): () => void {
    this.timedReminderListeners.push(fn);
    return () => { this.timedReminderListeners = this.timedReminderListeners.filter((l) => l !== fn); };
  }

  dismissSuggestion(id: string): void {
    this.dismissedIds.add(id);
    this.persistDismissed();
  }

  private loadDismissed(): void {
    try {
      const raw = kvGet(DISMISSED_STORAGE_KEY);
      if (raw) this.dismissedIds = new Set(JSON.parse(raw));
    } catch {}
  }

  private persistDismissed(): void {
    kvSet(DISMISSED_STORAGE_KEY, JSON.stringify([...this.dismissedIds]));
  }

  private loadNotifiedHints(): void {
    try {
      const raw = kvGet(NOTIFIED_HINTS_KEY);
      if (raw) {
        const { date, ids } = JSON.parse(raw);
        const today = new Date().toDateString();
        this.notifiedHints = { date, ids: date === today ? new Set<string>(ids) : new Set() };
      }
    } catch {}
  }

  private persistNotifiedHints(): void {
    kvSet(NOTIFIED_HINTS_KEY, JSON.stringify({
      date: this.notifiedHints.date,
      ids: [...this.notifiedHints.ids],
    }));
  }

  private isHintNotifiedToday(id: string): boolean {
    const today = new Date().toDateString();
    if (this.notifiedHints.date !== today) {
      this.notifiedHints = { date: today, ids: new Set() };
      return false;
    }
    return this.notifiedHints.ids.has(id);
  }

  private markHintNotified(id: string): void {
    const today = new Date().toDateString();
    if (this.notifiedHints.date !== today) {
      this.notifiedHints = { date: today, ids: new Set() };
    }
    this.notifiedHints.ids.add(id);
    this.persistNotifiedHints();
  }

  private emitCount = 0;

  private emit(s: Suggestion): void {
    if (this.emitCount >= this.MAX_EMITS_PER_TICK) return;
    if (this.dismissedIds.has(s.id)) return;
    this.emitCount++;
    for (const fn of this.listeners) fn(s);
  }

  private emitTimedReminder(r: TimedReminder): void {
    for (const fn of this.timedReminderListeners) fn(r);
  }

  async tick(): Promise<void> {
    this.lastTickTime = Date.now();
    this.emitCount = 0;
    this.recentEventKeys = new Set();
    try {
      await processAutoLogRules();

      // Run goal checks
      checkGoalMilestones(goalRepo, eventRepo);

      // Month-end insight check
      const now = new Date();
      if (now.getDate() <= 3) {
        const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const existing = await insightRepo.get(prevMonth, prevYear);
        if (!existing) {
          const monthName = new Date(prevYear, prevMonth - 1).toLocaleString('en-US', { month: 'long' });
          eventRepo.insert({
            id: nanoid(),
            type: 'monthly_insight',
            title: `${monthName} ${prevYear} insights`,
            body: `Your spending summary for ${monthName} is ready. Tap to view your insights.`,
            data: { month: prevMonth, year: prevYear },
            createdAt: Date.now(),
          }).catch(() => {});
        }
      }

      // Pattern detection
      const recent = await transactionRepo.getRecent(50);
      const candidates: PatternCandidate[] = [];
      const groups = new Map<string, { amounts: number[]; merchant: string | null; description: string | null }>();
      for (const t of recent) {
        if (t.type !== 'expense') continue;
        const key = t.category;
        const entry = groups.get(key) || { amounts: [], merchant: t.merchant, description: null };
        entry.amounts.push(paiseToRupees(t.amount as Paise));
        if (t.description) entry.description = t.description;
        groups.set(key, entry);
      }

      // Cache transactions for timing computation
      setRecentTransactionCache(
        recent.filter((t) => t.type === 'expense').map((t) => ({
          date: t.date,
          category: t.category,
          amount: paiseToRupees(t.amount as Paise),
          merchant: t.merchant,
          description: t.description,
        }))
      );

      for (const [category, data] of groups) {
        if (data.amounts.length < 3) continue;
        const sorted = [...data.amounts].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const similar = sorted.filter((a) => median > 0 && Math.abs(a - median) / median < 0.2);
        if (similar.length >= 3) {
          candidates.push({ category, amounts: similar, merchant: data.merchant, description: data.description });
        }
      }

      if (patternAnalyzer && candidates.length > 0) {
        try {
          const findings = await patternAnalyzer(candidates, recent);
          this.processFindings(findings, true);
        } catch {
          patternAnalyzer = null;
          this.processStatsFallback(groups);
        }
      } else if (candidates.length > 0) {
        this.processStatsFallback(groups);
      }

      // Fire pending timed reminders (capped)
      this.firePendingReminders();

      // Check reminder expiry
      const expired = checkReminderExpiry();
      if (expired > 0) {
        const expiryKey = 'reminder-expiry';
        if (!this.recentEventKeys.has(expiryKey)) {
          this.recentEventKeys.add(expiryKey);
          eventRepo.insert({
            id: nanoid(),
            type: 'recurring_suggestion',
            title: 'Patterns expired',
            body: `${expired} inactive recurring pattern(s) removed.`,
            data: { expiredCount: expired },
            createdAt: Date.now(),
          }).catch(() => {});
        }
      }

      // Merchant hints (with daily cooldown)
      const hints = await merchantHintRepo.getTop(20);
      for (const h of hints) {
        if ((h.useCount ?? 0) < 3) continue;
        if (h.confirmStrategy === 'dismissed') continue;
        const hintId = `hint-${h.canonicalName}`;
        if (this.dismissedIds.has(hintId)) continue;
        if (this.isHintNotifiedToday(hintId)) continue;
        this.markHintNotified(hintId);
        this.emit({
          id: hintId,
          text: `You've logged "${h.canonicalName}" ${h.useCount} times as ${h.category}.`,
          notificationBody: `I'll auto-categorize future "${h.canonicalName}" entries as ${h.category}.`,
          notificationType: 'rule-creation',
          createdAt: Date.now(),
        });
      }
    } catch {
      // Scheduler failures are silent
    }
  }

  private processFindings(findings: PatternFinding[], aiEnabled: boolean): void {
    for (const f of findings) {
      const timing = computePatternTiming(f.category, f.merchant, f.typicalAmount);
      const mid = f.merchant ? ` at ${f.merchant}` : '';

      if (timing.isTimed) {
        // Store as timed reminder — notification fires on-schedule, not now
        const body = aiEnabled
          ? f.notificationBody
          : staticNotificationBody('timed-log', f.category, f.typicalAmount, f.merchant, f.description, dayName(timing.daysOfWeek[0]), timing.hour);

        upsertReminder(f.category, f.typicalAmount, f.merchant, f.description, timing, body);

        const eventKey = `timed-${f.category}-${f.merchant ?? ''}`;
        if (!this.recentEventKeys.has(eventKey)) {
          this.recentEventKeys.add(eventKey);
          eventRepo.insert({
            id: nanoid(),
            type: 'recurring_suggestion',
            title: `Timed pattern: ${f.category}`,
            body: body,
            data: { category: f.category, typicalAmount: f.typicalAmount, merchant: f.merchant, description: f.description, confidence: f.confidence, notificationType: 'timed-log' },
            createdAt: Date.now(),
          }).catch(() => {});
        }
      } else {
        // No clear timing — emit rule-creation suggestion immediately
        const body = aiEnabled
          ? f.notificationBody
          : staticNotificationBody('rule-creation', f.category, f.typicalAmount, f.merchant, f.description);

        const s: Suggestion = {
          id: `rule-${f.category}-${f.typicalAmount}`,
          text: `~₹${f.typicalAmount} ${f.category}${mid}`,
          category: f.category,
          typicalAmount: f.typicalAmount,
          merchant: f.merchant ?? undefined,
          description: f.description,
          notificationBody: body,
          notificationType: 'rule-creation',
          createdAt: Date.now(),
        };
        this.emit(s);

        const eventKey = `rule-${f.category}-${f.merchant ?? ''}`;
        if (!this.recentEventKeys.has(eventKey)) {
          this.recentEventKeys.add(eventKey);
          eventRepo.insert({
            id: nanoid(),
            type: 'recurring_suggestion',
            title: `Recurring pattern: ${f.category}`,
            body: `${aiEnabled ? f.reasoning : `You've spent ~₹${f.typicalAmount} on ${f.category}${mid} a bunch of times.`} Create a recurring rule?`,
            data: { category: f.category, typicalAmount: f.typicalAmount, merchant: f.merchant, description: f.description, confidence: f.confidence, notificationType: 'rule-creation' },
            createdAt: Date.now(),
          }).catch(() => {});
        }
      }
    }
  }

  private processStatsFallback(groups: Map<string, { amounts: number[]; merchant: string | null; description: string | null }>): void {
    for (const [category, data] of groups) {
      if (data.amounts.length < 3) continue;
      const sorted = [...data.amounts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const similar = sorted.filter((a) => median > 0 && Math.abs(a - median) / median < 0.2);
      if (similar.length < 3) continue;

      const avg = Math.round(similar.reduce((s, a) => s + a, 0) / similar.length);
      const timing = computePatternTiming(category, data.merchant, avg);
      const mid = data.merchant ? ` at ${data.merchant}` : '';

      if (timing.isTimed) {
        const body = staticNotificationBody('timed-log', category, avg, data.merchant, data.description, dayName(timing.daysOfWeek[0]), timing.hour);
        upsertReminder(category, avg, data.merchant, data.description, timing, body);
        const eventKey = `timed-${category}-${data.merchant ?? ''}`;
        if (!this.recentEventKeys.has(eventKey)) {
          this.recentEventKeys.add(eventKey);
          eventRepo.insert({
            id: nanoid(),
            type: 'recurring_suggestion',
            title: `Timed pattern: ${category}`,
            body: body,
            data: { category, typicalAmount: avg, merchant: data.merchant, description: data.description, notificationType: 'timed-log' },
            createdAt: Date.now(),
          }).catch(() => {});
        }
      } else {
        const body = staticNotificationBody('rule-creation', category, avg, data.merchant, data.description);
        const s: Suggestion = {
          id: `rule-${category}-${avg}`,
          text: `~₹${avg} ${category}${mid}`,
          category,
          typicalAmount: avg,
          merchant: data.merchant ?? undefined,
          description: data.description,
          notificationBody: body,
          notificationType: 'rule-creation',
          createdAt: Date.now(),
        };
        this.emit(s);

        const eventKey = `rule-${category}-${data.merchant ?? ''}`;
        if (!this.recentEventKeys.has(eventKey)) {
          this.recentEventKeys.add(eventKey);
          eventRepo.insert({
            id: nanoid(),
            type: 'recurring_suggestion',
            title: `Recurring pattern: ${category}`,
            body: `You've spent ~₹${avg} on ${category}${mid} ${similar.length} times recently. Create a recurring rule?`,
            data: { category, typicalAmount: avg, merchant: data.merchant, description: data.description, count: similar.length, notificationType: 'rule-creation' },
            createdAt: Date.now(),
          }).catch(() => {});
        }
      }
    }
  }

  private firePendingReminders(): void {
    const pending = getPendingReminders().slice(0, this.MAX_PENDING_REMINDERS);
    for (const r of pending) {
      this.emitTimedReminder({
        id: r.id,
        category: r.category,
        typicalAmount: r.typicalAmount,
        merchant: r.merchant,
        description: r.description,
        notificationBody: r.notificationBody,
        createdAt: Date.now(),
      });
      markReminderNotified(r.id);
    }
  }

  start(): void {
    if (this.intervalId) return;
    this.loadDismissed();
    this.loadNotifiedHints();
    setTimeout(() => this.tick(), 2 * 60 * 1000);
    this.intervalId = setInterval(() => this.tick(), this.INTERVAL_MS);
    setTimeout(() => autoBackup(), 5 * 60 * 1000);
    this.backupIntervalId = setInterval(() => autoBackup(), this.BACKUP_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - this.lastTickTime < this.TICK_COOLDOWN_MS) return;
      this.tick();
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

export function onTimedReminder(fn: TimedReminderListener): () => void {
  return getInstance().onTimedReminder(fn);
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
