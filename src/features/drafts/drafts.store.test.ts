/**
 * Draft store tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useDraftStore } from './drafts.store';
import type { DraftItem } from './types';

function makeDraft(overrides: Partial<DraftItem> = {}): DraftItem {
  return {
    id: 'd1',
    text: 'Rs.500 at Swiggy',
    amount: 500,
    merchant: 'Swiggy',
    date: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('useDraftStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useDraftStore.setState({ drafts: [] });
  });

  it('starts with empty drafts', () => {
    expect(useDraftStore.getState().drafts).toEqual([]);
  });

  it('adds a draft', () => {
    const draft = makeDraft();
    useDraftStore.getState().add(draft);
    expect(useDraftStore.getState().drafts).toHaveLength(1);
    expect(useDraftStore.getState().drafts[0].text).toBe('Rs.500 at Swiggy');
  });

  it('removes a draft by id', () => {
    useDraftStore.getState().add(makeDraft({ id: 'a' }));
    useDraftStore.getState().add(makeDraft({ id: 'b' }));
    useDraftStore.getState().remove('a');
    expect(useDraftStore.getState().drafts).toHaveLength(1);
    expect(useDraftStore.getState().drafts[0].id).toBe('b');
  });

  it('clears all drafts', () => {
    useDraftStore.getState().add(makeDraft({ id: 'a' }));
    useDraftStore.getState().add(makeDraft({ id: 'b' }));
    useDraftStore.getState().clearAll();
    expect(useDraftStore.getState().drafts).toHaveLength(0);
  });

  it('addFromText creates draft from text', () => {
    useDraftStore.getState().addFromText('hello test', 100, 'TestMerchant');
    const drafts = useDraftStore.getState().drafts;
    expect(drafts).toHaveLength(1);
    expect(drafts[0].text).toBe('hello test');
    expect(drafts[0].amount).toBe(100);
    expect(drafts[0].merchant).toBe('TestMerchant');
  });

  it('persists drafts to localStorage', () => {
    useDraftStore.getState().add(makeDraft({ id: 'x' }));
    const raw = localStorage.getItem('expense-tracker:drafts');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('x');
  });

  it('reload resets state from localStorage', () => {
    localStorage.setItem('expense-tracker:drafts', JSON.stringify([makeDraft({ id: 'lr' })]));
    useDraftStore.getState().reload();
    expect(useDraftStore.getState().drafts).toHaveLength(1);
    expect(useDraftStore.getState().drafts[0].id).toBe('lr');
  });
});
