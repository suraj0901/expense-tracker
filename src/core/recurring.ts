/**
 * Recurring auto-log — detects strong spending patterns and auto-creates
 * transactions when the user has opted in.
 *
 * Rules are stored in OPFS. When a rule is enabled and the
 * scheduler runs within the rule's time window, the transaction is
 * auto-created without notification.
 */

import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import { transactionRepo } from './composition-root';
import { rupeesToPaise, paiseToRupees } from './domain/money';
import type { Paise } from './domain/money';
import type { Suggestion } from './scheduler';
import { kvGet, kvSet } from './platform/kv-store';

export interface AutoLogRule {
  id: string;
  category: string;
  typicalAmount: number; // rupees
  merchant: string | null;
  dayOfWeek: number | null; // 0=Sun…6=Sat
  dayOfMonth: number | null; // 1-31, for monthly patterns
  hour: number | null; // 0-23
  enabled: boolean;
  createdAt: number;
}

export interface DismissedRule extends AutoLogRule {
  dismissedAt: number;
}

const STORAGE_KEY = 'expense-tracker:auto-log-rules';
const DISMISSED_KEY = 'expense-tracker:dismissed-rules';

function loadRules(): AutoLogRule[] {
  try {
    const raw = kvGet(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRules(rules: AutoLogRule[]): void {
  kvSet(STORAGE_KEY, JSON.stringify(rules));
}

function loadDismissed(): DismissedRule[] {
  try {
    const raw = kvGet(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDismissed(rules: DismissedRule[]): void {
  kvSet(DISMISSED_KEY, JSON.stringify(rules));
}

export function getAutoLogRules(): AutoLogRule[] {
  return loadRules();
}

export function toggleAutoLogRule(id: string): AutoLogRule[] {
  const rules = loadRules().map((r) =>
    r.id === id ? { ...r, enabled: !r.enabled } : r
  );
  saveRules(rules);
  return rules;
}

export function removeAutoLogRule(id: string): AutoLogRule[] {
  const rules = loadRules().filter((r) => r.id !== id);
  saveRules(rules);
  return rules;
}

/** Create a rule from an accepted suggestion. Called when user taps "Log it" or "Create rule". */
export function upsertRuleFromSuggestion(
  s: Suggestion,
  timing?: { dayOfWeek?: number; hour?: number; dayOfMonth?: number }
): void {
  const rules = loadRules();
  const now = new Date();
  const existing = rules.find(
    (r) => r.category === s.category && r.merchant === (s.merchant ?? null)
  );
  if (existing) return; // already tracked

  rules.push({
    id: nanoid(),
    category: s.category ?? 'Other',
    typicalAmount: s.typicalAmount ?? 0,
    merchant: s.merchant ?? null,
    dayOfWeek: timing?.dayOfWeek ?? now.getDay(),
    dayOfMonth: timing?.dayOfMonth ?? null,
    hour: timing?.hour ?? now.getHours(),
    enabled: false, // user must opt in via settings
    createdAt: Date.now(),
  });
  saveRules(rules);
}

/** Check rules and auto-create transactions for matching enabled rules. */
export async function processAutoLogRules(): Promise<number> {
  const rules = loadRules().filter((r) => r.enabled);
  if (rules.length === 0) return 0;

  const now = new Date();
  const dow = now.getDay();
  const hour = now.getHours();
  const today = format(now, 'yyyy-MM-dd');

  const todayTxns = await transactionRepo.query({ start_date: today, end_date: today, limit: 1000 });

  let autoLogged = 0;
  for (const rule of rules) {
    const hourMatches = rule.hour === null || Math.abs(hour - rule.hour) <= 1;
    if (!hourMatches) continue;

    // Day matching: day-of-month takes priority over day-of-week. If neither set, always match.
    let dayMatches = true;
    if (rule.dayOfMonth !== null) {
      const dom = now.getDate();
      dayMatches = Math.abs(dom - rule.dayOfMonth) <= 2
        || (rule.dayOfMonth <= 2 && dom >= 29)
        || (rule.dayOfMonth >= 29 && dom <= 3);
    } else if (rule.dayOfWeek !== null) {
      dayMatches = rule.dayOfWeek === dow;
    }
    if (!dayMatches) continue;

    // Don't duplicate — check if a matching txn already exists today
    const exists = todayTxns.some(
      (t) => t.category === rule.category
        && Math.abs(paiseToRupees(t.amount as Paise) - rule.typicalAmount) / rule.typicalAmount < 0.2
    );
    if (exists) continue;

    await transactionRepo.insert({
      id: nanoid(),
      amount: rupeesToPaise(rule.typicalAmount),
      type: 'expense',
      category: rule.category,
      merchant: rule.merchant,
      note: 'auto-logged',
      description: null, tags: undefined,
      date: today,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
    });
    autoLogged++;
  }
  return autoLogged;
}

/** Get pending suggestions from scheduler events — rules not yet acted on. */
export function getPendingSuggestions(): AutoLogRule[] {
  const allRules = loadRules();
  return allRules.filter(r => !r.enabled);
}

export function enableAutoLogRule(id: string): void {
  const rules = loadRules().map(r =>
    r.id === id ? { ...r, enabled: true } : r
  );
  saveRules(rules);
}

export function getDismissedRules(): DismissedRule[] {
  return loadDismissed();
}

export function dismissRule(rule: AutoLogRule): void {
  // Remove from active
  removeAutoLogRule(rule.id);
  // Add to dismissed
  const dismissed = loadDismissed();
  dismissed.push({ ...rule, dismissedAt: Date.now(), enabled: false });
  saveDismissed(dismissed);
}

export function restoreRule(id: string): void {
  const dismissed = loadDismissed();
  const rule = dismissed.find(r => r.id === id);
  if (!rule) return;
  saveDismissed(dismissed.filter(r => r.id !== id));
  const { dismissedAt, ...restored } = rule;
  const rules = loadRules();
  rules.push({ ...restored, enabled: false });
  saveRules(rules);
}
