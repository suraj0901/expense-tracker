/**
 * Recurring auto-log — detects strong spending patterns and auto-creates
 * transactions when the user has opted in.
 *
 * Rules are stored in localStorage. When a rule is enabled and the
 * scheduler runs within the rule's time window, the transaction is
 * auto-created without notification.
 */

import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import { insertTransaction, queryTransactions } from './db/client';
import { rupeesToPaise, paiseToRupees } from './domain/money';
import type { Paise } from './domain/money';
import type { Suggestion } from './scheduler';

export interface AutoLogRule {
  id: string;
  category: string;
  typicalAmount: number; // rupees
  merchant: string | null;
  dayOfWeek: number | null; // 0=Sun…6=Sat
  hour: number | null; // 0-23
  enabled: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'expense-tracker:auto-log-rules';

function loadRules(): AutoLogRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRules(rules: AutoLogRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
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

/** Create a rule from an accepted suggestion. Called when user taps "Log it". */
export function upsertRuleFromSuggestion(s: Suggestion): void {
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
    dayOfWeek: now.getDay(),
    hour: now.getHours(),
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

  const todayTxns = await queryTransactions({ start_date: today, end_date: today, limit: 1000 });

  let autoLogged = 0;
  for (const rule of rules) {
    // Time window: ±1 hour of the rule's hour, same day of week (or any)
    const hourMatches = rule.hour === null || Math.abs(hour - rule.hour) <= 1;
    const dowMatches = rule.dayOfWeek === null || rule.dayOfWeek === dow;
    if (!hourMatches || !dowMatches) continue;

    // Don't duplicate — check if a matching txn already exists today
    const exists = todayTxns.some(
      (t) => t.category === rule.category
        && Math.abs(paiseToRupees(t.amount as Paise) - rule.typicalAmount) / rule.typicalAmount < 0.2
    );
    if (exists) continue;

    await insertTransaction({
      id: nanoid(),
      amount: rupeesToPaise(rule.typicalAmount),
      type: 'expense',
      category: rule.category,
      merchant: rule.merchant,
      note: 'auto-logged',
      date: today,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
    });
    autoLogged++;
  }
  return autoLogged;
}
