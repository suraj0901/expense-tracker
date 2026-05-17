/**
 * Database client — SQLocal + Drizzle ORM over SQLite WASM + OPFS.
 *
 * SQLocal handles the Web Worker and OPFS persistence automatically.
 * This module creates the Drizzle instance and provides typed query
 * functions used by the tool executor.
 */

import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { eq, and, gte, lte, desc, sql, ne, sum, count } from 'drizzle-orm';
import * as schema from './schema';
import { nanoid } from 'nanoid';
import type { Paise } from '../domain/money';
import { DEFAULT_CATEGORIES } from '../domain/types';

// ─── SQLocal + Drizzle instance ──────────────────────────────────────────

const sqlocal = new SQLocalDrizzle('expense-tracker.sqlite3');

export const db = drizzle(sqlocal.driver, { schema });

// ─── Initialization ─────────────────────────────────────────────────────

let initialized = false;

/**
 * Initialize the database: create tables and seed default categories.
 * Called once on app boot.
 */
export async function initializeDatabase(): Promise<void> {
  if (initialized) return;

  // Create tables using raw SQL (since drizzle-kit doesn't run in browser)
  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      budget_amount INTEGER,
      is_default INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER
    )
  `;

  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL REFERENCES categories(name),
      merchant TEXT,
      note TEXT,
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `;

  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls TEXT,
      created_at INTEGER NOT NULL
    )
  `;

  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS merchant_hints (
      canonical_name TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_used_at INTEGER NOT NULL
    )
  `;

  // Create indexes for common queries
  await sqlocal.sql`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)
  `;
  await sqlocal.sql`
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)
  `;
  await sqlocal.sql`
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)
  `;
  await sqlocal.sql`
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)
  `;

  // Seed default categories if not present
  const existing = await db.select().from(schema.categories);
  if (existing.length === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await db.insert(schema.categories).values({
        id: nanoid(),
        name: cat.name,
        icon: cat.icon,
        budgetAmount: cat.budgetAmount as number | null,
        isDefault: cat.isDefault,
        sortOrder: cat.sortOrder,
      });
    }
  }

  initialized = true;
  console.log('[DB] Initialized with', DEFAULT_CATEGORIES.length, 'default categories');
}

// ─── Transaction Operations ─────────────────────────────────────────────

interface InsertTransactionParams {
  id: string;
  amount: number; // paise
  type: string;
  category: string;
  merchant?: string | null;
  note?: string | null;
  date: string;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export async function insertTransaction(params: InsertTransactionParams) {
  await db.insert(schema.transactions).values({
    id: params.id,
    amount: params.amount,
    type: params.type,
    category: params.category,
    merchant: params.merchant ?? null,
    note: params.note ?? null,
    date: params.date,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    isDeleted: params.isDeleted,
  });

  // Update merchant hints if merchant is provided
  if (params.merchant) {
    await upsertMerchantHint(params.merchant, params.category);
  }

  return { success: true, id: params.id };
}

interface QueryTransactionsParams {
  category?: string;
  start_date?: string;
  end_date?: string;
  merchant?: string;
  limit?: number;
}

export async function queryTransactions(params: QueryTransactionsParams) {
  const conditions = [eq(schema.transactions.isDeleted, false)];

  if (params.category) {
    conditions.push(eq(schema.transactions.category, params.category));
  }
  if (params.start_date) {
    conditions.push(gte(schema.transactions.date, params.start_date));
  }
  if (params.end_date) {
    conditions.push(lte(schema.transactions.date, params.end_date));
  }
  if (params.merchant) {
    conditions.push(eq(schema.transactions.merchant, params.merchant));
  }

  const results = await db
    .select()
    .from(schema.transactions)
    .where(and(...conditions))
    .orderBy(desc(schema.transactions.date))
    .limit(params.limit ?? 50);

  return results.map((r) => ({
    ...r,
    amount: r.amount as Paise,
  }));
}

export async function getMonthlySummary(month: number, year: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const results = await db
    .select({
      type: schema.transactions.type,
      total: sum(schema.transactions.amount),
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.isDeleted, false),
        gte(schema.transactions.date, startDate),
        lte(schema.transactions.date, endDate)
      )
    )
    .groupBy(schema.transactions.type);

  let totalIncome = 0;
  let totalExpense = 0;

  for (const row of results) {
    const total = Number(row.total) || 0;
    if (row.type === 'income') totalIncome = total;
    if (row.type === 'expense') totalExpense = total;
  }

  // Category breakdown for expenses
  const categoryResults = await db
    .select({
      category: schema.transactions.category,
      total: sum(schema.transactions.amount),
      count: count(),
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.isDeleted, false),
        eq(schema.transactions.type, 'expense'),
        gte(schema.transactions.date, startDate),
        lte(schema.transactions.date, endDate)
      )
    )
    .groupBy(schema.transactions.category)
    .orderBy(desc(sum(schema.transactions.amount)));

  // Get category icons
  const allCategories = await db.select().from(schema.categories);
  const iconMap = new Map(allCategories.map((c) => [c.name, c.icon ?? '📦']));

  const categoryBreakdown = categoryResults.map((r) => ({
    category: r.category,
    icon: iconMap.get(r.category) ?? '📦',
    total: (Number(r.total) || 0) as Paise,
    count: r.count,
    percentage: totalExpense > 0 ? ((Number(r.total) || 0) / totalExpense) * 100 : 0,
  }));

  return {
    month,
    year,
    totalIncome: totalIncome as Paise,
    totalExpense: totalExpense as Paise,
    savings: (totalIncome - totalExpense) as Paise,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
    categoryBreakdown,
  };
}

export async function getCategoryBreakdown(startDate: string, endDate: string) {
  const results = await db
    .select({
      category: schema.transactions.category,
      total: sum(schema.transactions.amount),
      count: count(),
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.isDeleted, false),
        eq(schema.transactions.type, 'expense'),
        gte(schema.transactions.date, startDate),
        lte(schema.transactions.date, endDate)
      )
    )
    .groupBy(schema.transactions.category)
    .orderBy(desc(sum(schema.transactions.amount)));

  const totalSpend = results.reduce((acc, r) => acc + (Number(r.total) || 0), 0);

  const allCategories = await db.select().from(schema.categories);
  const iconMap = new Map(allCategories.map((c) => [c.name, c.icon ?? '📦']));

  return results.map((r) => ({
    category: r.category,
    icon: iconMap.get(r.category) ?? '📦',
    total: (Number(r.total) || 0) as Paise,
    count: r.count,
    percentage: totalSpend > 0 ? ((Number(r.total) || 0) / totalSpend) * 100 : 0,
  }));
}

export async function getRecent(count: number = 10) {
  return db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.isDeleted, false))
    .orderBy(desc(schema.transactions.createdAt))
    .limit(count);
}

interface UpdateTransactionParams {
  amount?: number; // paise (already converted by tool executor)
  category?: string;
  merchant?: string;
  note?: string;
  updatedAt: number;
}

export async function updateTransaction(
  transactionId: string,
  params: UpdateTransactionParams
) {
  const updateData: Record<string, unknown> = {
    updatedAt: params.updatedAt,
  };

  if (params.amount !== undefined) updateData.amount = params.amount;
  if (params.category !== undefined) updateData.category = params.category;
  if (params.merchant !== undefined) updateData.merchant = params.merchant;
  if (params.note !== undefined) updateData.note = params.note;

  await db
    .update(schema.transactions)
    .set(updateData)
    .where(eq(schema.transactions.id, transactionId));

  // Update merchant hints if merchant or category changed
  if (params.merchant && params.category) {
    await upsertMerchantHint(params.merchant, params.category);
  }

  return { success: true, id: transactionId };
}

export async function softDelete(transactionId: string) {
  await db
    .update(schema.transactions)
    .set({ isDeleted: true, updatedAt: Date.now() })
    .where(eq(schema.transactions.id, transactionId));

  return { success: true, id: transactionId };
}

export async function undoDelete(transactionId: string) {
  await db
    .update(schema.transactions)
    .set({ isDeleted: false, updatedAt: Date.now() })
    .where(eq(schema.transactions.id, transactionId));

  return { success: true, id: transactionId };
}

export async function getBudgetStatus() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  // Get categories with budgets
  const budgetedCategories = await db
    .select()
    .from(schema.categories)
    .where(
      and(
        sql`${schema.categories.budgetAmount} IS NOT NULL`,
        ne(schema.categories.budgetAmount, 0)
      )
    );

  if (budgetedCategories.length === 0) {
    return {
      hasBudgets: false,
      message: 'No budgets set. You can set category budgets in settings.',
      items: [],
    };
  }

  const results = [];

  for (const cat of budgetedCategories) {
    const spentResult = await db
      .select({ total: sum(schema.transactions.amount) })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.isDeleted, false),
          eq(schema.transactions.type, 'expense'),
          eq(schema.transactions.category, cat.name),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate)
        )
      );

    const spent = (Number(spentResult[0]?.total) || 0) as Paise;
    const budget = (cat.budgetAmount ?? 0) as Paise;

    results.push({
      category: cat.name,
      icon: cat.icon ?? '📦',
      budgetAmount: budget,
      spent,
      remaining: (budget - spent) as Paise,
      percentUsed: budget > 0 ? (spent / budget) * 100 : 0,
    });
  }

  return { hasBudgets: true, items: results };
}

// ─── Message Operations ─────────────────────────────────────────────────

interface SaveMessageParams {
  id: string;
  role: string;
  content: string;
  toolCalls?: unknown[] | null;
  createdAt: number;
}

export async function saveMessage(params: SaveMessageParams) {
  await db.insert(schema.messages).values({
    id: params.id,
    role: params.role,
    content: params.content,
    toolCalls: params.toolCalls ? JSON.stringify(params.toolCalls) : null,
    createdAt: params.createdAt,
  });
}

export async function getMessageHistory(limit: number = 20) {
  const msgs = await db
    .select()
    .from(schema.messages)
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit);

  return msgs.reverse(); // oldest first for display
}

export async function getAllMessages() {
  return db
    .select()
    .from(schema.messages)
    .orderBy(schema.messages.createdAt);
}

// ─── Merchant Hints ─────────────────────────────────────────────────────

async function upsertMerchantHint(merchant: string, category: string) {
  const canonical = merchant.toLowerCase().trim();
  if (!canonical) return;

  const existing = await db
    .select()
    .from(schema.merchantHints)
    .where(eq(schema.merchantHints.canonicalName, canonical));

  if (existing.length > 0) {
    await db
      .update(schema.merchantHints)
      .set({
        category,
        useCount: (existing[0].useCount ?? 1) + 1,
        lastUsedAt: Date.now(),
      })
      .where(eq(schema.merchantHints.canonicalName, canonical));
  } else {
    await db.insert(schema.merchantHints).values({
      canonicalName: canonical,
      category,
      useCount: 1,
      lastUsedAt: Date.now(),
    });
  }
}

export async function getMerchantHints(limit: number = 30) {
  return db
    .select()
    .from(schema.merchantHints)
    .orderBy(desc(schema.merchantHints.useCount))
    .limit(limit);
}

// ─── Category Operations ────────────────────────────────────────────────

export async function getCategories() {
  return db
    .select()
    .from(schema.categories)
    .orderBy(schema.categories.sortOrder);
}
