/**
 * Tool definitions — the 9 tools the AI can call.
 *
 * Each tool has a name, description, and JSON Schema for parameters.
 * These are sent to the AI provider alongside the system prompt.
 */

import { z } from 'zod';

// ─── Zod schemas for validation ─────────────────────────────────────────

export const StoreExpenseSchema = z.object({
  amount: z.number().positive().describe('Amount in rupees (e.g. 120, 5000). Will be converted to paise internally.'),
  category: z.string().describe('Category name. Must be one of the available categories.'),
  merchant: z.string().optional().nullable().describe('Merchant or store name, if mentioned.'),
  date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today.'),
  note: z.string().optional().nullable().describe('Additional note about the expense.'),
});

export const StoreIncomeSchema = z.object({
  amount: z.number().positive().describe('Amount in rupees.'),
  source: z.string().describe('Source of income (e.g. "salary", "freelance").'),
  date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today.'),
  note: z.string().optional().nullable().describe('Additional note about the income.'),
});

export const GetExpensesSchema = z.object({
  category: z.string().optional().describe('Filter by category name.'),
  start_date: z.string().optional().describe('Start date in YYYY-MM-DD format.'),
  end_date: z.string().optional().describe('End date in YYYY-MM-DD format.'),
  merchant: z.string().optional().describe('Filter by merchant name.'),
  limit: z.number().optional().describe('Maximum number of results. Default 50.'),
});

export const GetMonthlySummarySchema = z.object({
  month: z.number().min(1).max(12).describe('Month number (1-12).'),
  year: z.number().describe('Year (e.g. 2026).'),
});

export const GetCategoryBreakdownSchema = z.object({
  start_date: z.string().describe('Start date in YYYY-MM-DD format.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format.'),
});

export const GetRecentTransactionsSchema = z.object({
  count: z.number().optional().default(10).describe('Number of recent transactions. Default 10.'),
});

export const UpdateExpenseSchema = z.object({
  transaction_id: z.string().describe('ID of the transaction to update.'),
  amount: z.number().positive().optional().describe('New amount in rupees.'),
  category: z.string().optional().describe('New category name.'),
  merchant: z.string().optional().describe('New merchant name.'),
  note: z.string().optional().describe('New note.'),
});

export const DeleteExpenseSchema = z.object({
  transaction_id: z.string().describe('ID of the transaction to soft-delete.'),
});

export const GetBudgetStatusSchema = z.object({});

export const UndoDeleteSchema = z.object({
  transaction_id: z.string().describe('ID of the transaction to restore.'),
});

// ─── Tool definitions for AI providers ──────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'store_expense',
    description: 'Insert a new expense transaction. Always call this immediately when user mentions spending money — do not ask for confirmation first.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in rupees (e.g. 120, 5000)' },
        category: { type: 'string', description: 'Category name (Food, Transport, Shopping, Bills & Utilities, Rent, Health, Education, Entertainment, Travel, Groceries, Personal Care, Gifts, Subscriptions, Other)' },
        merchant: { type: 'string', description: 'Merchant or store name, if mentioned' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Defaults to today if not specified.' },
        note: { type: 'string', description: 'Additional note about the expense' },
      },
      required: ['amount', 'category'],
    },
  },
  {
    name: 'store_income',
    description: 'Insert a new income transaction.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in rupees' },
        source: { type: 'string', description: 'Source of income (e.g. salary, freelance)' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format. Defaults to today.' },
        note: { type: 'string', description: 'Additional note about the income' },
      },
      required: ['amount', 'source'],
    },
  },
  {
    name: 'get_expenses',
    description: 'Query transactions with optional filters. Use this when the user asks about their spending.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category name' },
        start_date: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        end_date: { type: 'string', description: 'End date in YYYY-MM-DD format' },
        merchant: { type: 'string', description: 'Filter by merchant name' },
        limit: { type: 'number', description: 'Maximum results. Default 50.' },
      },
      required: [],
    },
  },
  {
    name: 'get_monthly_summary',
    description: 'Get aggregated totals and category breakdown for a specific month.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Month number (1-12)' },
        year: { type: 'number', description: 'Year (e.g. 2026)' },
      },
      required: ['month', 'year'],
    },
  },
  {
    name: 'get_category_breakdown',
    description: 'Get per-category spend totals for any date range.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'get_recent_transactions',
    description: 'Get the most recent N transactions. Used for context and corrections.',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of recent transactions. Default 10.' },
      },
      required: [],
    },
  },
  {
    name: 'update_expense',
    description: 'Correct an existing transaction. Partial update — only specified fields are changed.',
    parameters: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string', description: 'ID of the transaction to update' },
        amount: { type: 'number', description: 'New amount in rupees' },
        category: { type: 'string', description: 'New category name' },
        merchant: { type: 'string', description: 'New merchant name' },
        note: { type: 'string', description: 'New note' },
      },
      required: ['transaction_id'],
    },
  },
  {
    name: 'delete_expense',
    description: 'Soft-delete a transaction. The transaction is not permanently removed.',
    parameters: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string', description: 'ID of the transaction to soft-delete' },
      },
      required: ['transaction_id'],
    },
  },
  {
    name: 'get_budget_status',
    description: 'Get current month spend vs budget for each category that has a budget set.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'undo_delete',
    description: 'Restore a previously soft-deleted transaction. Call this when the user wants to undo a deletion.',
    parameters: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string', description: 'ID of the transaction to restore' },
      },
      required: ['transaction_id'],
    },
  },
];

// ─── Schema lookup for validation ───────────────────────────────────────

export const TOOL_SCHEMAS: Record<string, z.ZodSchema> = {
  store_expense: StoreExpenseSchema,
  store_income: StoreIncomeSchema,
  get_expenses: GetExpensesSchema,
  get_monthly_summary: GetMonthlySummarySchema,
  get_category_breakdown: GetCategoryBreakdownSchema,
  get_recent_transactions: GetRecentTransactionsSchema,
  update_expense: UpdateExpenseSchema,
  delete_expense: DeleteExpenseSchema,
  get_budget_status: GetBudgetStatusSchema,
  undo_delete: UndoDeleteSchema,
};
