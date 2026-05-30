import { describe, it, expect } from 'vitest';
import { hasSpendingIntent, hasLoggingToolCall } from './agent';
import { buildSystemPrompt } from './system-prompt';
import type { ToolCallRecord } from '../domain/types';

describe('hasSpendingIntent', () => {
  it('detects ₹ symbol with amount', () => {
    expect(hasSpendingIntent('spent ₹120 on food')).toBe(true);
  });

  it('detects rupees keyword', () => {
    expect(hasSpendingIntent('paid 500 rupees for auto')).toBe(true);
  });

  it('detects lakh shorthand', () => {
    expect(hasSpendingIntent('rent 1.5L this month')).toBe(true);
  });

  it('detects k shorthand', () => {
    expect(hasSpendingIntent('salary 50k credited')).toBe(true);
  });

  it('detects spending verbs', () => {
    expect(hasSpendingIntent('bought groceries')).toBe(true);
    expect(hasSpendingIntent('paid for cab')).toBe(true);
    expect(hasSpendingIntent('gave 200 to friend')).toBe(true);
  });

  it('detects income verbs', () => {
    expect(hasSpendingIntent('received salary')).toBe(true);
    expect(hasSpendingIntent('got paid today')).toBe(true);
    expect(hasSpendingIntent('earned 5000')).toBe(true);
  });

  it('detects common expense merchants', () => {
    expect(hasSpendingIntent('lunch at office')).toBe(true);
    expect(hasSpendingIntent('uber to airport')).toBe(true);
    expect(hasSpendingIntent('swiggy order')).toBe(true);
  });

  it('detects auto-parsed input', () => {
    expect(hasSpendingIntent('[Auto-parsed: ₹120 at Swiggy]')).toBe(true);
  });

  it('does not flag conversational messages', () => {
    expect(hasSpendingIntent('hello')).toBe(false);
    expect(hasSpendingIntent('how are you')).toBe(false);
    expect(hasSpendingIntent('show my expenses')).toBe(false);
  });

  it('detects ₹ symbol anywhere in message', () => {
    expect(hasSpendingIntent('I think I spent around ₹250 yesterday')).toBe(true);
  });
});

describe('hasLoggingToolCall', () => {
  const makeRecord = (name: string): ToolCallRecord => ({
    id: 'test-id',
    name,
    args: {},
    result: {},
  });

  it('returns true when store_expense is present', () => {
    expect(hasLoggingToolCall([makeRecord('store_expense')])).toBe(true);
  });

  it('returns true when store_income is present', () => {
    expect(hasLoggingToolCall([makeRecord('store_income')])).toBe(true);
  });

  it('returns true when logging call is among other calls', () => {
    expect(hasLoggingToolCall([
      makeRecord('list_categories'),
      makeRecord('store_expense'),
      makeRecord('get_budget_status'),
    ])).toBe(true);
  });

  it('returns false for non-logging calls only', () => {
    expect(hasLoggingToolCall([
      makeRecord('list_categories'),
      makeRecord('get_expenses'),
    ])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasLoggingToolCall([])).toBe(false);
  });
});

describe('buildSystemPrompt', () => {
  it('contains the critical rule', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain('CRITICAL RULE');
    expect(prompt).toContain('you MUST call store_expense() or store_income()');
    expect(prompt).toContain('non-negotiable');
    expect(prompt).toContain('Only process the LAST user message');
  });

  it('instructs to call store_expense alongside list_categories', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain('call list_categories AND store_expense together');
  });

  it('injects today date', () => {
    const prompt = buildSystemPrompt([]);
    const today = new Date().toISOString().split('T')[0];
    expect(prompt).toContain(today);
  });

  it('injects merchant hints when provided', () => {
    const hints = [
      { canonicalName: 'swiggy', category: 'Food', useCount: 5, lastUsedAt: Date.now(), confirmStrategy: 'auto' as const },
      { canonicalName: 'uber', category: 'Transport', useCount: 3, lastUsedAt: Date.now(), confirmStrategy: 'auto' as const },
    ];
    const prompt = buildSystemPrompt(hints);
    expect(prompt).toContain('Known merchants: swiggy→Food, uber→Transport');
  });
});
