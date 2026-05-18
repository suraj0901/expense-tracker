/**
 * Tool definitions for AI providers — JSON Schema format.
 */
import type { z } from 'zod';
import { TOOL_SCHEMAS } from './tool-schemas';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'store_expense',
    description: 'Insert a new expense transaction. Call immediately when user mentions spending — do not ask first.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in rupees (e.g. 120, 5000)' },
        category: { type: 'string', description: 'Category name' },
        merchant: { type: 'string', description: 'Merchant or store name, if mentioned' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD. Defaults to today.' },
        note: { type: 'string', description: 'Additional note' },
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
        date: { type: 'string', description: 'Date in YYYY-MM-DD. Defaults to today.' },
        note: { type: 'string', description: 'Additional note' },
      },
      required: ['amount', 'source'],
    },
  },
  {
    name: 'get_expenses',
    description: 'Query transactions with optional filters.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category' },
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        merchant: { type: 'string', description: 'Filter by merchant' },
        limit: { type: 'number', description: 'Max results. Default 50.' },
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
        month: { type: 'number', description: 'Month (1-12)' },
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
    description: 'Get the most recent N transactions.',
    parameters: {
      type: 'object',
      properties: { count: { type: 'number', description: 'Number of recent transactions. Default 10.' } },
      required: [],
    },
  },
  {
    name: 'update_expense',
    description: 'Correct an existing transaction. Partial update.',
    parameters: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string', description: 'Transaction ID' },
        amount: { type: 'number', description: 'New amount in rupees' },
        category: { type: 'string', description: 'New category' },
        merchant: { type: 'string', description: 'New merchant' },
        note: { type: 'string', description: 'New note' },
      },
      required: ['transaction_id'],
    },
  },
  {
    name: 'delete_expense',
    description: 'Soft-delete a transaction.',
    parameters: {
      type: 'object',
      properties: { transaction_id: { type: 'string', description: 'Transaction ID' } },
      required: ['transaction_id'],
    },
  },
  {
    name: 'get_budget_status',
    description: 'Get current month spend vs budget per category.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'undo_delete',
    description: 'Restore a previously soft-deleted transaction.',
    parameters: {
      type: 'object',
      properties: { transaction_id: { type: 'string', description: 'Transaction ID to restore' } },
      required: ['transaction_id'],
    },
  },
  {
    name: 'set_goal',
    description: 'Create a new financial goal (savings target or spending limit).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Goal name (e.g. "Emergency Fund", "Vacation")' },
        target_amount: { type: 'number', description: 'Target amount in rupees' },
        category: { type: 'string', description: 'Optional category this goal applies to' },
        deadline: { type: 'string', description: 'Optional deadline YYYY-MM-DD' },
      },
      required: ['name', 'target_amount'],
    },
  },
  {
    name: 'get_goals',
    description: 'List all goals with current progress.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'delete_goal',
    description: 'Delete a goal by ID.',
    parameters: {
      type: 'object',
      properties: { goal_id: { type: 'string', description: 'Goal ID to delete' } },
      required: ['goal_id'],
    },
  },
  {
    name: 'list_categories',
    description: 'List all available categories.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_category',
    description: 'Create a new category. Call list_categories first — only create if no existing category fits. Avoid duplicates: "Pet Care" means no need for "Pets" or "Pet Food".',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Category name (e.g. "Pet Care", "Car Maintenance")' },
        icon: { type: 'string', description: 'Single emoji for the category' },
      },
      required: ['name'],
    },
  },
];

// Re-export schemas for convenience
export { TOOL_SCHEMAS };
export type { z };
