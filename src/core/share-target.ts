/**
 * Share target handler — parses shared SMS/bank text into DraftItems.
 *
 * Android apps (SMS, banking) share text via Web Share Target.
 * This parser extracts amount, merchant, and date using regex heuristics.
 * Complex cases fall back to the AI agent for parsing.
 */

import { nanoid } from 'nanoid';
import type { DraftItem } from '../features/drafts/types';

// Amount: comma-formatted (1,250) or plain-digits (1250), optional decimals (45.50)
const AMT = String.raw`(\d{1,3}(?:,\d{3})+|\d{2,}(?:\.\d{2})?)`;

const AMOUNT_PATTERNS: RegExp[] = [
  new RegExp(String.raw`(?:Rs\.?|INR|₹)\s*` + AMT, 'i'),
  new RegExp(AMT + String.raw`\s*(?:Rs\.?|INR|₹)`, 'i'),
  new RegExp(String.raw`(?:amt|amount)[:\s]+` + AMT, 'i'),
  new RegExp(String.raw`(?:spent|paid|debited)[:\s]+` + AMT, 'i'),
];

const MERCHANT_PATTERNS = [
  /(?:at|to|@)\s+([A-Za-z0-9&.\s]+?)(?:\.|,|\s+on\s|\s+Rs|\s+INR|\s*$)/i,
  /(?:at|to|@)\s+([A-Za-z0-9&.]+)/i,
];

const DATE_PATTERNS = [
  /on\s+(\d{4}-\d{2}-\d{2})/i,
  /on\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i,
  /(\d{2}\/\d{2}\/\d{4})/,
];

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const raw = m[1].replace(/,/g, '');
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  // Last resort: bare number near "spent" or "paid"
  const bareMatch = text.match(/(?:spent|paid|debited)\D*(\d{2,})/i);
  if (bareMatch) {
    const n = parseInt(bareMatch[1], 10);
    if (!isNaN(n) && n > 1) return n; // >1 to avoid ₹1 false positives
  }
  return null;
}

function extractMerchant(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const m = text.match(pattern);
    if (m) return m[1].trim();
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

/** Parse shared text into a DraftItem. Returns null if nothing extractable. */
export function parseSharedText(rawText: string): DraftItem | null {
  const text = rawText.trim();
  if (!text || text.length < 5) return null;

  const amount = extractAmount(text);
  // If no amount found and text is short, treat as user message (not an SMS)
  if (!amount && text.length < 50) return null;

  return {
    id: nanoid(),
    text,
    amount,
    merchant: extractMerchant(text),
    date: extractDate(text),
    createdAt: Date.now(),
  };
}
