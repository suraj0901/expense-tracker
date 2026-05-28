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
        description: { type: 'string', description: 'Human-readable summary extracted from user message (e.g. "Lunch at office with friends")' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Lowercase context labels: location (office, home), meal (breakfast, lunch), social (with friends), payment (upi, cash), occasion (birthday, travel). Max 5-8.' },
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
        description: { type: 'string', description: 'Human-readable summary from user message' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Lowercase context labels' },
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
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags (e.g. ["office", "lunch"]). Returns transactions matching ALL tags.' },
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
        description: { type: 'string', description: 'Updated human-readable summary' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags' },
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
  {
    name: 'update_category',
    description: 'Rename a category or change its icon.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Current category name' },
        new_name: { type: 'string', description: 'New name for the category' },
        icon: { type: 'string', description: 'New emoji icon' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_category',
    description: 'Delete a category by name.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Category name to delete' } },
      required: ['name'],
    },
  },
  {
    name: 'set_budget',
    description: 'Set a monthly budget for a category. Amount in rupees.',
    parameters: {
      type: 'object',
      properties: {
        category_name: { type: 'string', description: 'Category to set budget for' },
        amount: { type: 'number', description: 'Monthly budget amount in rupees' },
      },
      required: ['category_name', 'amount'],
    },
  },
  {
    name: 'get_budgets',
    description: 'List all categories that have budgets set, with their monthly amounts.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'delete_budget',
    description: 'Remove the budget from a category.',
    parameters: {
      type: 'object',
      properties: { category_name: { type: 'string', description: 'Category to remove budget from' } },
      required: ['category_name'],
    },
  },
  {
    name: 'get_spending_trend',
    description: 'Compare current month spending vs previous month. Shows income, expense, and percentage changes.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_merchant_mappings',
    description: 'List all known merchant→category mappings and their confirmation strategies.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'update_merchant_mapping',
    description: 'Change the category or confirmation strategy for a merchant mapping.',
    parameters: {
      type: 'object',
      properties: {
        canonical_name: { type: 'string', description: 'The merchant name (lowercase, as shown by get_merchant_mappings)' },
        category: { type: 'string', description: 'New category for this merchant' },
        confirm_strategy: { type: 'string', description: "Confirmation strategy: 'auto', 'ask_always', or 'dismissed'" },
      },
      required: ['canonical_name'],
    },
  },
  {
    name: 'delete_merchant_mapping',
    description: 'Completely remove a merchant→category mapping. The AI will re-learn the merchant next time it appears.',
    parameters: {
      type: 'object',
      properties: { canonical_name: { type: 'string', description: 'Merchant name to forget' } },
      required: ['canonical_name'],
    },
  },
  {
    name: 'get_auto_log_rules',
    description: 'List all auto-log rules — both active/pending and dismissed. Shows status, category, amount, merchant.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'enable_auto_log_rule',
    description: 'Enable an auto-log rule so transactions are created automatically going forward.',
    parameters: {
      type: 'object',
      properties: { rule_id: { type: 'string', description: 'Rule ID from get_auto_log_rules' } },
      required: ['rule_id'],
    },
  },
  {
    name: 'disable_auto_log_rule',
    description: 'Disable an auto-log rule. The rule will no longer create automatic transactions (but is not deleted).',
    parameters: {
      type: 'object',
      properties: { rule_id: { type: 'string', description: 'Rule ID from get_auto_log_rules' } },
      required: ['rule_id'],
    },
  },
  {
    name: 'delete_auto_log_rule',
    description: 'Permanently delete an auto-log rule (either active or dismissed).',
    parameters: {
      type: 'object',
      properties: { rule_id: { type: 'string', description: 'Rule ID from get_auto_log_rules' } },
      required: ['rule_id'],
    },
  },
  {
    name: 'get_event_feed',
    description: 'Get recent events — transaction logs, merchant confirmations, budget warnings, recurring suggestions.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Number of recent events. Default 10.' } },
      required: [],
    },
  },
  {
    name: 'get_insights',
    description: 'Get AI-generated monthly spending insights. Defaults to current month.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Month (1-12). Defaults to current month.' },
        year: { type: 'number', description: 'Year. Defaults to current year.' },
      },
      required: [],
    },
  },
];

// Re-export schemas for convenience
export { TOOL_SCHEMAS };
export type { z };
