/**
 * Drizzle ORM schema — 4 tables.
 *
 * transactions · categories · messages · merchant_hints · goals · insights
 */

import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// ─── categories ──────────────────────────────────────────────────────────

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  icon: text('icon'), // emoji
  budgetAmount: integer('budget_amount'), // paise, nullable — monthly limit
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order'),
});

// ─── transactions ────────────────────────────────────────────────────────

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  amount: integer('amount').notNull(), // paise — NEVER floats
  type: text('type').notNull(), // 'expense' | 'income'
  category: text('category')
    .notNull()
    .references(() => categories.name),
  merchant: text('merchant'), // nullable
  note: text('note'), // nullable
  date: text('date').notNull(), // 'YYYY-MM-DD'
  createdAt: integer('created_at').notNull(), // Unix ms
  updatedAt: integer('updated_at').notNull(), // Unix ms
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
});

// ─── messages ────────────────────────────────────────────────────────────

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(), // display text
  toolCalls: text('tool_calls'), // JSON array of tool calls, nullable
  createdAt: integer('created_at').notNull(), // Unix ms
});

// ─── merchant_hints ──────────────────────────────────────────────────────

export const merchantHints = sqliteTable('merchant_hints', {
  canonicalName: text('canonical_name').primaryKey(), // lowercased, trimmed
  category: text('category').notNull(), // last confirmed category
  useCount: integer('use_count').notNull().default(1),
  lastUsedAt: integer('last_used_at').notNull(),
});

// ─── goals ────────────────────────────────────────────────────────────────

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(), // paise
  currentAmount: integer('current_amount').notNull().default(0), // paise
  category: text('category'), // nullable — if goal is category-specific
  deadline: text('deadline'), // nullable — 'YYYY-MM-DD'
  createdAt: integer('created_at').notNull(), // Unix ms
  updatedAt: integer('updated_at').notNull(), // Unix ms
});

// ─── insights ────────────────────────────────────────────────────────────

export const insights = sqliteTable('insights', {
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  text: text('text').notNull(),
  generatedAt: integer('generated_at').notNull(),
}, (table) => ({
  pk: primaryKey(table.month, table.year),
}));

// ─── events ──────────────────────────────────────────────────────────────

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  // 'transaction_logged' | 'merchant_mapping_ask' | 'recurring_suggestion' |
  // 'budget_warning' | 'goal_milestone' | 'monthly_insight' | 'ai_query_response'
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: text('data'), // JSON blob — type-specific payload
  status: text('status').notNull().default('pending'),
  // 'pending' | 'dismissed' | 'acted'
  createdAt: integer('created_at').notNull(),
  actedAt: integer('acted_at'), // nullable
});
