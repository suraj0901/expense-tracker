/**
 * Domain types — the core data shapes used across the application.
 * These are the application-level types, not the DB schema types.
 */

import type { Paise } from './money';

// ─── Transaction ─────────────────────────────────────────────────────────

export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  amount: Paise;
  type: TransactionType;
  category: string;
  merchant: string | null;
  note: string | null;
  date: string; // 'YYYY-MM-DD'
  createdAt: number; // Unix ms
  updatedAt: number; // Unix ms
  isDeleted: boolean;
}

// ─── Category ────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string; // emoji
  budgetAmount: Paise | null; // monthly limit in paise
  isDefault: boolean;
  sortOrder: number;
}

/** Default 14 categories from the architecture doc */
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Food', icon: '🍕', budgetAmount: null, isDefault: true, sortOrder: 1 },
  { name: 'Transport', icon: '🚗', budgetAmount: null, isDefault: true, sortOrder: 2 },
  { name: 'Shopping', icon: '🛍️', budgetAmount: null, isDefault: true, sortOrder: 3 },
  { name: 'Bills & Utilities', icon: '💡', budgetAmount: null, isDefault: true, sortOrder: 4 },
  { name: 'Rent', icon: '🏠', budgetAmount: null, isDefault: true, sortOrder: 5 },
  { name: 'Health', icon: '🏥', budgetAmount: null, isDefault: true, sortOrder: 6 },
  { name: 'Education', icon: '📚', budgetAmount: null, isDefault: true, sortOrder: 7 },
  { name: 'Entertainment', icon: '🎬', budgetAmount: null, isDefault: true, sortOrder: 8 },
  { name: 'Travel', icon: '✈️', budgetAmount: null, isDefault: true, sortOrder: 9 },
  { name: 'Groceries', icon: '🛒', budgetAmount: null, isDefault: true, sortOrder: 10 },
  { name: 'Personal Care', icon: '💇', budgetAmount: null, isDefault: true, sortOrder: 11 },
  { name: 'Gifts', icon: '🎁', budgetAmount: null, isDefault: true, sortOrder: 12 },
  { name: 'Subscriptions', icon: '📱', budgetAmount: null, isDefault: true, sortOrder: 13 },
  { name: 'Other', icon: '📦', budgetAmount: null, isDefault: true, sortOrder: 14 },
];

// ─── Message ─────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls: ToolCallRecord[] | null;
  createdAt: number; // Unix ms
}

// ─── Merchant Hint ───────────────────────────────────────────────────────

export interface MerchantHint {
  canonicalName: string; // lowercased, trimmed
  category: string;
  useCount: number;
  lastUsedAt: number; // Unix ms
}

// ─── Agent Types ─────────────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface AgentResponse {
  text: string;
  toolsUsed: ToolCallRecord[];
}

// ─── Chat Message (for AI provider) ─────────────────────────────────────

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatMessageRole;
  content: string | ToolResult[];
}

export interface AIProviderResponse {
  content: string;
  raw: unknown;
  hasToolCalls: boolean;
  toolCalls: ToolCall[];
}

// ─── Monthly Summary ────────────────────────────────────────────────────

export interface MonthlySummary {
  month: number;
  year: number;
  totalIncome: Paise;
  totalExpense: Paise;
  savings: Paise;
  savingsRate: number; // percentage
  categoryBreakdown: CategoryBreakdownItem[];
}

export interface CategoryBreakdownItem {
  category: string;
  icon: string;
  total: Paise;
  count: number;
  percentage: number;
}

// ─── Budget Status ──────────────────────────────────────────────────────

export interface BudgetStatusItem {
  category: string;
  icon: string;
  budgetAmount: Paise;
  spent: Paise;
  remaining: Paise;
  percentUsed: number;
}

export interface BudgetStatusResult {
  hasBudgets: boolean;
  message?: string;
  items: BudgetStatusItem[];
}

// ─── Goals ───────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  name: string;
  targetAmount: Paise;
  currentAmount: Paise;
  category: string | null;
  deadline: string | null;
  createdAt: number;
  updatedAt: number;
}

// ─── Backup ──────────────────────────────────────────────────────────────

export interface StoredBackup {
  date: string;
  sizeBytes: number;
}

// ─── Events ──────────────────────────────────────────────────────────────

export type EventType =
  | 'transaction_logged'
  | 'merchant_mapping_ask'
  | 'recurring_suggestion'
  | 'budget_warning'
  | 'goal_milestone'
  | 'monthly_insight'
  | 'ai_query_response';

export type EventStatus = 'pending' | 'dismissed' | 'acted';

export interface AppEvent {
  id: string;
  type: EventType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  status: EventStatus;
  createdAt: number;
  actedAt: number | null;
}

// ─── Unified Feed ────────────────────────────────────────────────────────

export interface FeedItem {
  kind: 'message' | 'event';
  message?: Message;
  event?: AppEvent;
  timestamp: number;
}
