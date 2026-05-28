/**
 * PatternReminders — timed-log notifications for recurring spending habits.
 *
 * Separate from AutoLogRule because timed-log prompts the user each time
 * ("Breakfast again?") rather than auto-creating transactions silently.
 *
 * Reminders are stored in OPFS. Content is pre-generated (AI or static
 * fallback) at detection time — never called live at notification time.
 */

import { nanoid } from 'nanoid';
import { transactionRepo } from './composition-root';
import { paiseToRupees } from './domain/money';
import type { Paise } from './domain/money';
import type { PatternCandidate } from './agent/proactive-agent';
import { kvGet, kvSet } from './platform/kv-store';

export interface PatternReminder {
  id: string;
  category: string;
  typicalAmount: number; // rupees
  merchant: string | null;
  daysOfWeek: number[]; // 0=Sun…6=Sat
  hour: number; // 0-23
  notificationBody: string; // pre-generated AI text (or static fallback)
  lastNotifiedAt: number; // timestamp, prevents re-fire same day
  lastMatchedAt: number; // timestamp of last matching transaction
  createdAt: number;
  dismissed: boolean;
}

export interface TimingResult {
  daysOfWeek: number[];
  hour: number;
  isTimed: boolean;
}

const STORAGE_KEY = 'expense-tracker:pattern-reminders';
const EXPIRY_WEEKS = 3;

function loadReminders(): PatternReminder[] {
  try {
    const raw = kvGet(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveReminders(reminders: PatternReminder[]): void {
  kvSet(STORAGE_KEY, JSON.stringify(reminders));
}

export function getPatternReminders(): PatternReminder[] {
  return loadReminders();
}

export function dismissReminder(id: string): void {
  const reminders = loadReminders().map((r) =>
    r.id === id ? { ...r, dismissed: true } : r
  );
  saveReminders(reminders);
}

export function markReminderNotified(id: string): void {
  const reminders = loadReminders().map((r) =>
    r.id === id ? { ...r, lastNotifiedAt: Date.now() } : r
  );
  saveReminders(reminders);
}

export function markReminderMatched(id: string): void {
  const reminders = loadReminders().map((r) =>
    r.id === id ? { ...r, lastMatchedAt: Date.now() } : r
  );
  saveReminders(reminders);
}

export function upsertReminder(
  category: string,
  typicalAmount: number,
  merchant: string | null,
  timing: TimingResult,
  notificationBody: string
): void {
  const reminders = loadReminders();
  const existing = reminders.find(
    (r) => r.category === category && r.merchant === (merchant ?? null)
  );
  const now = Date.now();

  if (existing) {
    existing.daysOfWeek = timing.daysOfWeek;
    existing.hour = timing.hour;
    existing.notificationBody = notificationBody;
    existing.lastMatchedAt = now;
    existing.dismissed = false;
  } else {
    reminders.push({
      id: nanoid(),
      category,
      typicalAmount,
      merchant,
      daysOfWeek: timing.daysOfWeek,
      hour: timing.hour,
      notificationBody,
      lastNotifiedAt: 0,
      lastMatchedAt: now,
      createdAt: now,
      dismissed: false,
    });
  }
  saveReminders(reminders);
}

export function getPendingReminders(): PatternReminder[] {
  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();

  return loadReminders().filter((r) => {
    if (r.dismissed) return false;
    if (!r.daysOfWeek.includes(dow)) return false;
    if (Math.abs(hour - r.hour) > 1) return false;

    const lastDate = new Date(r.lastNotifiedAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    if (lastDay.getTime() >= today.getTime()) return false;

    return true;
  });
}

export function checkReminderExpiry(): number {
  const now = Date.now();
  const cutoff = now - EXPIRY_WEEKS * 7 * 24 * 60 * 60 * 1000;
  const reminders = loadReminders();
  const active = reminders.filter((r) => !(r.lastMatchedAt > 0 && r.lastMatchedAt < cutoff));
  const expired = reminders.length - active.length;
  if (expired > 0) saveReminders(active);
  return expired;
}

/** Compute day-of-week and hour timing from transaction history. */
export function computePatternTiming(
  category: string,
  merchant: string | null,
  typicalAmount: number
): TimingResult {
  try {
    const txns = getRecentTransactionsFromCache(category, merchant, typicalAmount);
    if (txns.length < 3) return { daysOfWeek: [], hour: 0, isTimed: false };

    const dayCounts = new Map<number, number>();
    const hours: number[] = [];

    for (const txn of txns) {
      const d = new Date(txn.date + 'T00:00:00');
      const dow = d.getDay();
      dayCounts.set(dow, (dayCounts.get(dow) || 0) + 1);
      // hours aren't stored in transaction date, default to ~8am
      hours.push(8);
    }

    const total = txns.length;
    const daysOfWeek: number[] = [];
    for (const [day, count] of dayCounts) {
      if (count / total >= 0.4) {
        daysOfWeek.push(day);
      }
    }

    // Need at least one day with ≥60% concentration to call it timed
    const maxConcentration = Math.max(...Array.from(dayCounts.values())) / total;
    const isTimed = daysOfWeek.length > 0 && maxConcentration >= 0.6;

    // Use mode of hours if available, default to 8
    hours.sort((a, b) => a - b);
    const hour = hours[Math.floor(hours.length / 2)] || 8;

    return { daysOfWeek: isTimed ? daysOfWeek : [], hour, isTimed };
  } catch {
    return { daysOfWeek: [], hour: 0, isTimed: false };
  }
}

/** Static fallback notification bodies — used when AI is unavailable. */
export function staticNotificationBody(
  type: 'timed-log' | 'rule-creation',
  category: string,
  typicalAmount: number,
  merchant: string | null,
  dayName?: string,
  hour?: number
): string {
  const mid = merchant ? ` at ${merchant}` : '';
  if (type === 'timed-log') {
    const timePart = dayName && hour != null
      ? `${dayName}s around ${formatHour(hour)}`
      : '';
    const prefix = timePart ? `${timePart}?` : 'Again?';
    return `${prefix} Your usual ~₹${typicalAmount} ${category}${mid} — want me to log it?`;
  }
  return `You've spent ~₹${typicalAmount} on ${category}${mid} multiple times. Create a recurring rule?`;
}

function formatHour(h: number): string {
  const hour = h % 12 || 12;
  const ampm = h < 12 ? 'am' : 'pm';
  return `${hour}:00${ampm}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayName(day: number): string {
  return DAY_NAMES[day] || 'Day';
}

// In-memory cache of recent transactions for timing computation.
// Populated by scheduler before pattern detection.
let recentTxnCache: Array<{ date: string; category: string; amount: number; merchant: string | null }> = [];

export function setRecentTransactionCache(
  txns: Array<{ date: string; category: string; amount: number; merchant: string | null }>
): void {
  recentTxnCache = txns;
}

function getRecentTransactionsFromCache(
  category: string,
  merchant: string | null,
  typicalAmount: number
): Array<{ date: string; category: string; amount: number; merchant: string | null }> {
  return recentTxnCache.filter(
    (t) => t.category === category
      && (merchant === null || t.merchant === merchant)
      && typicalAmount > 0
      && Math.abs(t.amount - typicalAmount) / typicalAmount < 0.2
  );
}
