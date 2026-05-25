/**
 * Draft types — parsed but unconfirmed transactions from SMS/voice.
 */

export interface DraftItem {
  id: string;
  text: string; // original raw text
  amount: number | null; // extracted rupees
  merchant: string | null;
  date: string | null; // 'YYYY-MM-DD' or null
  createdAt: number;
  source?: string; // 'sms_bank' | 'sms_upi' | 'sms_card' | 'generic'
}

export const DRAFT_QUEUE_KEY = 'expense-tracker:drafts';
