/**
 * Repository interfaces — consumed by app and feature layers.
 * Infrastructure implementations fulfill these contracts.
 */
import type {
  Transaction, Message, MerchantHint, Category, Goal,
  MonthlySummary, CategoryBreakdownItem, BudgetStatusResult, StoredBackup, AppEvent, SpendingTrend,
} from '../domain/types';
import type { Paise } from '../domain/money';

// ─── Transaction Repository ──────────────────────────────────────────────

export interface InsertTransactionParams {
  id: string; amount: number; type: string; category: string;
  merchant?: string | null; note?: string | null;
  description?: string | null; tags?: string[];
  date: string; createdAt: number; updatedAt: number; isDeleted: boolean;
}

export interface UpdateTransactionParams {
  amount?: number; category?: string; merchant?: string;
  note?: string; description?: string; tags?: string[];
  updatedAt: number;
}

export interface QueryTransactionsParams {
  category?: string; start_date?: string; end_date?: string;
  merchant?: string; limit?: number; tags?: string[];
}

export interface TransactionRepository {
  insert(params: InsertTransactionParams): Promise<{ success: boolean; id: string }>;
  update(id: string, params: UpdateTransactionParams): Promise<{ success: boolean; id: string }>;
  softDelete(id: string): Promise<{ success: boolean; id: string }>;
  undoDelete(id: string): Promise<{ success: boolean; id: string }>;
  query(params: QueryTransactionsParams): Promise<Transaction[]>;
  getRecent(count?: number): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
}

// ─── Message Repository ──────────────────────────────────────────────────

export interface SaveMessageParams {
  id: string; role: string; content: string;
  toolCalls?: unknown[] | null; createdAt: number;
}

export interface MessageRepository {
  save(params: SaveMessageParams): Promise<void>;
  getHistory(limit?: number): Promise<Message[]>;
  getAll(): Promise<Message[]>;
}

// ─── Category Repository ─────────────────────────────────────────────────

export interface CategoryRepository {
  getAll(): Promise<Category[]>;
  create(name: string, icon: string): Promise<{ name: string; icon: string; existed: boolean }>;
  update(name: string, fields: { name?: string; icon?: string }): Promise<boolean>;
  delete(name: string): Promise<boolean>;
  setBudget(name: string, budgetAmount: number): Promise<boolean>;
  clearBudget(name: string): Promise<boolean>;
  getBudgeted(): Promise<Category[]>;
}

// ─── Merchant Hint Repository ────────────────────────────────────────────

export interface MerchantHintRepository {
  upsert(merchant: string, category: string, confirmStrategy?: string): Promise<void>;
  getTop(limit?: number): Promise<MerchantHint[]>;
  getAll(): Promise<MerchantHint[]>;
  update(canonicalName: string, fields: { category?: string; confirmStrategy?: string }): Promise<boolean>;
  delete(canonicalName: string): Promise<void>;
}

// ─── Goal Repository ─────────────────────────────────────────────────────

export interface NewGoalParams {
  id: string; name: string; targetAmount: Paise;
  category?: string | null; deadline?: string | null;
}

export interface GoalUpdateFields {
  name?: string; targetAmount?: Paise; currentAmount?: Paise;
  category?: string | null; deadline?: string | null;
}

export interface GoalRepository {
  set(goal: NewGoalParams): Promise<Goal>;
  getAll(): Promise<Goal[]>;
  update(id: string, fields: GoalUpdateFields): Promise<Goal | null>;
  delete(id: string): Promise<boolean>;
}

// ─── Summary Repository ──────────────────────────────────────────────────

export interface SummaryRepository {
  getMonthlySummary(month: number, year: number): Promise<MonthlySummary>;
  getCategoryBreakdown(startDate: string, endDate: string): Promise<CategoryBreakdownItem[]>;
  getBudgetStatus(): Promise<BudgetStatusResult>;
  getSpendingTrend(): Promise<SpendingTrend>;
}

// ─── Insight Repository ──────────────────────────────────────────────────

export interface InsightRepository {
  get(month: number, year: number): Promise<{ text: string; generatedAt: number } | null>;
  upsert(month: number, year: number, text: string): Promise<void>;
  isStale(month: number, year: number, generatedAt: number): Promise<boolean>;
}

// ─── Backup Repository ───────────────────────────────────────────────────

export interface BackupRepository {
  exportDatabase(): Promise<void>;
  importDatabase(file: File): Promise<{ success: boolean; error?: string }>;
  exportCSV(): Promise<void>;
  exportPDF(): Promise<void>;
  getStoredBackups(): StoredBackup[];
  restoreFromLocalBackup(date: string): boolean;
  processPendingRestore(): Promise<boolean>;
  deleteLocalBackup(date: string): void;
}

// ─── Event Repository ────────────────────────────────────────────────────

export interface InsertEventParams {
  id: string; type: string; title: string; body: string;
  data?: Record<string, unknown> | null; status?: string;
  createdAt: number;
}

export interface EventRepository {
  insert(params: InsertEventParams): Promise<{ success: boolean; id: string }>;
  getRecent(limit?: number): Promise<AppEvent[]>;
  getAll(): Promise<AppEvent[]>;
  updateStatus(id: string, status: string): Promise<void>;
  dismissAll(type?: string): Promise<void>;
}
