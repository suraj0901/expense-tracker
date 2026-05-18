/**
 * DB init — Drizzle instance + schema creation + category seeding.
 */
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { nanoid } from 'nanoid';
import * as schema from './schema';
import { DEFAULT_CATEGORIES } from '../domain/types';

const sqlocal = new SQLocalDrizzle('expense-tracker.sqlite3');
export const db = drizzle(sqlocal.driver, { schema });

let initialized = false;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, icon TEXT,
      budget_amount INTEGER, is_default INTEGER NOT NULL DEFAULT 1, sort_order INTEGER
    )
  `;
  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, amount INTEGER NOT NULL, type TEXT NOT NULL,
      category TEXT NOT NULL REFERENCES categories(name), merchant TEXT,
      note TEXT, date TEXT NOT NULL, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL,
      tool_calls TEXT, created_at INTEGER NOT NULL
    )
  `;
  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS merchant_hints (
      canonical_name TEXT PRIMARY KEY, category TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 1, last_used_at INTEGER NOT NULL
    )
  `;
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
  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      target_amount INTEGER NOT NULL, current_amount INTEGER NOT NULL DEFAULT 0,
      category TEXT, deadline TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )
  `;
  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS insights (
      month INTEGER NOT NULL, year INTEGER NOT NULL,
      text TEXT NOT NULL, generated_at INTEGER NOT NULL,
      PRIMARY KEY (month, year)
    )
  `;
  const existing = await db.select().from(schema.categories);
  if (existing.length === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await db.insert(schema.categories).values({
        id: nanoid(), name: cat.name, icon: cat.icon,
        budgetAmount: cat.budgetAmount as number | null,
        isDefault: cat.isDefault, sortOrder: cat.sortOrder,
      });
    }
  }
  initialized = true;
}
