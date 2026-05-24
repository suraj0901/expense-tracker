/**
 * Recurring auto-log tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAutoLogRules, toggleAutoLogRule, removeAutoLogRule,
  upsertRuleFromSuggestion,
} from './recurring';
import type { Suggestion } from './scheduler';
import { kvClear } from './platform/kv-store';

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 's1',
    text: '~₹25 Transport',
    category: 'Transport',
    typicalAmount: 25,
    merchant: undefined,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('getAutoLogRules', () => {
  beforeEach(() => {
    kvClear();
  });

  it('returns empty array by default', () => {
    expect(getAutoLogRules()).toEqual([]);
  });
});

describe('upsertRuleFromSuggestion', () => {
  beforeEach(() => {
    kvClear();
  });

  it('creates a new rule from a suggestion', () => {
    upsertRuleFromSuggestion(makeSuggestion());
    const rules = getAutoLogRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].category).toBe('Transport');
    expect(rules[0].typicalAmount).toBe(25);
    expect(rules[0].enabled).toBe(false); // user must opt in
  });

  it('does not duplicate rules for same category+merchant', () => {
    upsertRuleFromSuggestion(makeSuggestion());
    upsertRuleFromSuggestion(makeSuggestion());
    expect(getAutoLogRules()).toHaveLength(1);
  });

  it('creates separate rules for different categories', () => {
    upsertRuleFromSuggestion(makeSuggestion({ category: 'Transport' }));
    upsertRuleFromSuggestion(makeSuggestion({ category: 'Food' }));
    expect(getAutoLogRules()).toHaveLength(2);
  });

  it('stores rule with current day and hour', () => {
    upsertRuleFromSuggestion(makeSuggestion());
    const rule = getAutoLogRules()[0];
    const now = new Date();
    expect(rule.dayOfWeek).toBe(now.getDay());
    expect(rule.hour).toBe(now.getHours());
    expect(rule.createdAt).toBeGreaterThan(0);
  });
});

describe('toggleAutoLogRule', () => {
  beforeEach(() => {
    kvClear();
  });

  it('toggles a rule from disabled to enabled', () => {
    upsertRuleFromSuggestion(makeSuggestion());
    const rule = getAutoLogRules()[0];
    toggleAutoLogRule(rule.id);
    expect(getAutoLogRules()[0].enabled).toBe(true);
  });

  it('toggles back from enabled to disabled', () => {
    upsertRuleFromSuggestion(makeSuggestion());
    const rule = getAutoLogRules()[0];
    toggleAutoLogRule(rule.id);
    toggleAutoLogRule(rule.id);
    expect(getAutoLogRules()[0].enabled).toBe(false);
  });
});

describe('removeAutoLogRule', () => {
  beforeEach(() => {
    kvClear();
  });

  it('removes a rule by id', () => {
    upsertRuleFromSuggestion(makeSuggestion({ id: 'r1' }));
    const rule = getAutoLogRules()[0];
    removeAutoLogRule(rule.id);
    expect(getAutoLogRules()).toHaveLength(0);
  });

  it('does nothing for unknown id', () => {
    upsertRuleFromSuggestion(makeSuggestion({ id: 'r1' }));
    removeAutoLogRule('nonexistent');
    expect(getAutoLogRules()).toHaveLength(1);
  });
});
