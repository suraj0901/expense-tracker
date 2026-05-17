/**
 * Money utilities — unit + property-based tests.
 */
import { describe, it, expect } from 'vitest';
import { rupeesToPaise, paiseToRupees, formatINR, formatINRCompact } from './money';
import type { Paise } from './money';

describe('rupeesToPaise', () => {
  it('converts whole rupees to paise', () => {
    expect(rupeesToPaise(10)).toBe(1000);
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(0)).toBe(0);
  });

  it('rounds fractional rupees', () => {
    expect(rupeesToPaise(10.999)).toBe(1100);
    expect(rupeesToPaise(10.001)).toBe(1000);
  });
});

describe('paiseToRupees', () => {
  it('converts paise to rupees', () => {
    expect(paiseToRupees(1000 as Paise)).toBe(10);
    expect(paiseToRupees(0 as Paise)).toBe(0);
    expect(paiseToRupees(50 as Paise)).toBe(0.5);
  });
});

describe('round-trip property', () => {
  it('rupeesToPaise → paiseToRupees is identity for whole numbers', () => {
    // Property-based: test many values
    for (const r of [0, 1, 5, 10, 25, 100, 1000, 50000]) {
      const paise = rupeesToPaise(r);
      const back = paiseToRupees(paise);
      expect(back).toBe(r);
    }
  });

  it('paiseToRupees → rupeesToPaise is identity for paise values', () => {
    for (const p of [0, 1, 100, 500, 1000, 100000]) {
      const rupees = paiseToRupees(p as Paise);
      const back = rupeesToPaise(rupees);
      expect(back).toBe(p);
    }
  });

  it('fuzz test: random amounts always round-trip (whole rupees)', () => {
    const random = Math.random;
    for (let i = 0; i < 100; i++) {
      const amount = Math.round(random() * 1_000_000) / 100;
      const paise = rupeesToPaise(amount);
      const back = paiseToRupees(paise);
      expect(back).toBe(amount);
    }
  });
});

describe('formatINR', () => {
  it('formats paise as INR currency string', () => {
    expect(formatINR(50000 as Paise)).toBe('₹500');
    expect(formatINR(0 as Paise)).toBe('₹0');
    expect(formatINR(100000 as Paise)).toBe('₹1,000');
  });
});

describe('formatINRCompact', () => {
  it('uses compact notation for large values', () => {
    expect(formatINRCompact(10000000 as Paise)).toBe('₹1.0L');
    expect(formatINRCompact(100000 as Paise)).toBe('₹1.0K');
    expect(formatINRCompact(50000 as Paise)).toBe('₹500');
  });
});
