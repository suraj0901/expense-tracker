/**
 * Share target handler — parses shared SMS/bank text into DraftItems.
 *
 * Android apps (SMS, banking) share text via Web Share Target.
 * This parser extracts amount, merchant, and date using regex heuristics.
 * Complex cases fall back to the AI agent for parsing.
 */

import { nanoid } from 'nanoid';
import type { DraftItem } from '../features/drafts/types';

const AMT = String.raw`(\d{1,3}(?:,\d{3})+|\d{2,}(?:\.\d{2})?)`;

const AMOUNT_PATTERNS: RegExp[] = [
  // INR/Rs prefixed: "Rs.1250", "INR 500", "₹200"
  new RegExp(String.raw`(?:Rs\.?|INR|₹)\s*` + AMT, 'i'),
  // Amount before currency: "1250 Rs"
  new RegExp(AMT + String.raw`\s*(?:Rs\.?|INR|₹)`, 'i'),
  // Amount label: "amt: 1250", "amount: 500"
  new RegExp(String.raw`(?:amt|amount)[:\s]+` + AMT, 'i'),
  // Spend verbs: "spent 1250", "paid 500", "debited 200"
  new RegExp(String.raw`(?:spent|paid|debited|credited|deposited)[:\s]+` + AMT, 'i'),
  // UPI patterns: "UPI txn of Rs.500 to X", "debited by 1250.00"
  new RegExp(String.raw`(?:txn|transfer|payment)\s+(?:of|for)\s+(?:Rs\.?|INR|₹)?\s*` + AMT, 'i'),
  new RegExp(String.raw`(?:debited|credited)\s+(?:by|with|for)\s+(?:Rs\.?|INR|₹)?\s*` + AMT, 'i'),
  // Bank alert: "INR 500.00 debited from a/c **1234"
  new RegExp(String.raw`(?:INR|Rs\.?)\s*` + AMT + String.raw`\s*(?:debited|credited|spent)` , 'i'),
];

const MERCHANT_PATTERNS = [
  // "at X", "to X", "@X" followed by text
  /(?:at|to|@)\s+([A-Za-z0-9&.\s-]+?)(?:\.|,|\s+on\s|\s+Rs|\s+INR|\s+Ref|\s+Txn|\s*$)/i,
  /(?:at|to|@)\s+([A-Za-z0-9&.-]+)/i,
  // UPI: "to VPA someone@okbank" or merchant after "to"
  /(?:to|at)\s+(?:VPA\s+)?([A-Za-z0-9@._-]+)/i,
  // Bank: "at MERCHANT on date"
  /at\s+([A-Za-z0-9&.\s]+?)\s+on\s+\d/i,
  // Card: "at MERCHANT" near end
  /at\s+([A-Za-z0-9&.\s]{2,30}?)\s*$/i,
];

const DATE_PATTERNS = [
  /on\s+(\d{4}-\d{2}-\d{2})/i,
  /on\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i,
  /(\d{2}\/\d{2}\/\d{4})/,
  /(\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2,4})/i,
];

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const raw = (m[1] ?? m[2] ?? m[0]).replace(/,/g, '');
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  const bareMatch = text.match(/(?:spent|paid|debited)\D*(\d{2,})/i);
  if (bareMatch) {
    const n = parseInt(bareMatch[1], 10);
    if (!isNaN(n) && n > 1) return n;
  }
  return null;
}

function extractMerchant(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const raw = m[1].trim();
      // Filter out noise
      if (raw.length < 2 || raw.length > 50) continue;
      if (/^\d+$/.test(raw)) continue; // date or amount
      if (/^(Rs|INR|Ref|Txn|ID)/i.test(raw)) continue;
      return raw;
    }
  }
  return null;
}

function extractDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const m = text.match(pattern);
    if (m) return m[1];
  }
  return null;
}

/** Detect SMS source type for better UI handling */
function detectType(text: string): 'sms_bank' | 'sms_upi' | 'sms_card' | 'generic' {
  if (/\b(UPI|Google Pay|PhonePe|Paytm|BHIM)\b/i.test(text)) return 'sms_upi';
  if (/\b(card\s+\*+\d+|credit|debit card|swiped)\b/i.test(text)) return 'sms_card';
  if (/\b(debited|credited|a\/c|balance|available|bank|account)\b/i.test(text)) return 'sms_bank';
  return 'generic';
}

// Dedup: track recently processed texts (24h window)
const PROCESSED_TEXTS_KEY = 'expense-tracker:processed-texts';

function isDuplicate(text: string): boolean {
  try {
    const raw = localStorage.getItem(PROCESSED_TEXTS_KEY);
    const cache: Record<string, number> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const key = text.slice(0, 100).trim().toLowerCase();
    const last = cache[key];
    if (last && (now - last) < 24 * 60 * 60 * 1000) return true;
    cache[key] = now;
    // Cleanup old entries
    for (const k of Object.keys(cache)) {
      if (now - cache[k] > 24 * 60 * 60 * 1000) delete cache[k];
    }
    localStorage.setItem(PROCESSED_TEXTS_KEY, JSON.stringify(cache));
    return false;
  } catch { return false; }
}

/** Parse shared text into a DraftItem. Returns null if nothing extractable. */
export function parseSharedText(rawText: string): DraftItem | null {
  const text = rawText.trim();
  if (!text || text.length < 5) return null;

  // Dedup
  if (isDuplicate(text)) return null;

  const amount = extractAmount(text);
  if (!amount && text.length < 50) return null;

  return {
    id: nanoid(),
    text,
    amount,
    merchant: extractMerchant(text),
    date: extractDate(text),
    createdAt: Date.now(),
    source: detectType(text),
  };
}
