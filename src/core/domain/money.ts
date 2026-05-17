/**
 * Money type and conversion utilities.
 *
 * All monetary values are stored in paise (1 rupee = 100 paise).
 * Conversion happens exactly twice — at the boundary:
 *   rupeesToPaise on write (tool executor input)
 *   paiseToRupees on read  (tool executor output)
 */

/** Branded type for paise amounts — prevents accidental mixing with rupees */
export type Paise = number & { readonly __brand: 'paise' };

/** Convert rupees to paise for storage. Always integer. */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100) as Paise;
}

/** Convert paise to rupees for display. */
export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

/** Format paise as INR display string. Never shows paise to user. */
export function formatINR(paise: Paise): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** Format a number as compact INR (e.g., ₹5K, ₹1.5L) */
export function formatINRCompact(paise: Paise): string {
  const rupees = paiseToRupees(paise);
  if (rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(1)}L`;
  }
  if (rupees >= 1000) {
    return `₹${(rupees / 1000).toFixed(rupees >= 10000 ? 0 : 1)}K`;
  }
  return formatINR(paise);
}
