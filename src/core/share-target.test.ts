/**
 * Share target parser tests.
 */
import { describe, it, expect } from 'vitest';
import { parseSharedText } from './share-target';

describe('parseSharedText', () => {
  it('extracts amount and merchant from "Rs.500 at Swiggy" format', () => {
    const d = parseSharedText('Rs.500 spent at Swiggy');
    expect(d).not.toBeNull();
    expect(d!.amount).toBe(500);
    expect(d!.merchant).toBe('Swiggy');
  });

  it('extracts amount with INR prefix', () => {
    const d = parseSharedText('INR 1250 spent at Amazon');
    expect(d).not.toBeNull();
    expect(d!.amount).toBe(1250);
    expect(d!.merchant).toBe('Amazon');
  });

  it('extracts amount with ₹ symbol', () => {
    const d = parseSharedText('₹250 at Chai Point');
    expect(d).not.toBeNull();
    expect(d!.amount).toBe(250);
    expect(d!.merchant).toBe('Chai Point');
  });

  it('extracts amount with comma formatting', () => {
    const d = parseSharedText('Rs.1,500 at Big Bazaar on 2026-05-19');
    expect(d).not.toBeNull();
    expect(d!.amount).toBe(1500);
    expect(d!.merchant).toBe('Big Bazaar');
    expect(d!.date).toBe('2026-05-19');
  });

  it('returns null for short text without amount', () => {
    const d = parseSharedText('hello');
    expect(d).toBeNull();
  });

  it('returns null for empty text', () => {
    const d = parseSharedText('');
    expect(d).toBeNull();
  });

  it('handles text with amount but no merchant', () => {
    const d = parseSharedText('Paid Rs.500 for groceries');
    expect(d).not.toBeNull();
    expect(d!.amount).toBe(500);
    expect(d!.merchant).toBeNull();
  });

  it('extracts amount from "debited" format (bank SMS)', () => {
    const d = parseSharedText('Rs.750 debited from your account at Zomato');
    expect(d).not.toBeNull();
    expect(d!.amount).toBe(750);
    expect(d!.merchant).toBe('Zomato');
  });

  it('extracts amount after "spent" keyword', () => {
    const d = parseSharedText('You spent INR 320 at Ola Cabs');
    expect(d).not.toBeNull();
    expect(d!.amount).toBe(320);
  });

  it('handles decimal amounts', () => {
    const d = parseSharedText('Rs.45.50 at local store');
    expect(d).not.toBeNull();
    expect(d!.amount).toBe(45.50);
  });
});
