/**
 * Drizzle ORM schema — 4 tables.
 *
 * transactions · categories · messages · merchant_hints
 *
 * sync_metadata is a Phase 2 stub — table exists but is unused in MVP.
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

// ─── sync_metadata (Phase 2 stub) ───────────────────────────────────────

export const syncMetadata = sqliteTable('sync_metadata', {
  id: text('id').primaryKey().default('singleton'),
  deviceId: text('device_id').notNull(), // random UUID at install
  lastSyncedAt: integer('last_synced_at'), // null until sync configured
  tursoDbUrl: text('turso_db_url'), // null until sync configured
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
