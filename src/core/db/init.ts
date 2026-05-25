/**
 * DB init — Drizzle instance + DDL execution + category seeding.
 *
 * DDL lives here (not in schema.ts) because SQLocal/Drizzle with
 * sqlite-proxy doesn't auto-create tables from Drizzle definitions.
 * schema.ts provides the ORM type definitions for query building.
 * If you change schema.ts, update the DDL here to match.
 */
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { nanoid } from 'nanoid';
import * as schema from './schema';
import { DEFAULT_CATEGORIES } from '../domain/types';
import { logger } from '../logger';

let sqlocal: SQLocalDrizzle;
export let db: ReturnType<typeof drizzle>;

let initialized = false;

export interface StorageInfo {
  persisted: boolean;
  storageType: 'opfs' | 'memory';
  usageBytes: number;
  quotaBytes: number;
  pctUsed: number;
}

let cachedStorageInfo: StorageInfo | null = null;

export function getStorageInfo(): StorageInfo | null {
  return cachedStorageInfo;
}

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;

  sqlocal = new SQLocalDrizzle('expense-tracker.sqlite3');
  db = drizzle(sqlocal.driver, { schema });

  if ('storage' in navigator) {
    const persisted = await navigator.storage.persist();
    const estimate = await navigator.storage.estimate();
    const usageBytes = estimate.usage ?? 0;
    const quotaBytes = estimate.quota ?? 0;
    const pctUsed = quotaBytes > 0 ? Math.round((usageBytes / quotaBytes) * 100) : 0;
    const storageType: 'opfs' | 'memory' = self.crossOriginIsolated ? 'opfs' : 'memory';
    cachedStorageInfo = { persisted, storageType, usageBytes, quotaBytes, pctUsed };
    logger.info('storage_init', {
      persisted,
      storage_type: storageType,
      cross_origin_isolated: self.crossOriginIsolated,
      usage_mb: Math.round(usageBytes / 1024 / 1024),
      quota_mb: Math.round(quotaBytes / 1024 / 1024),
      pct_used: pctUsed,
    });
    if (storageType === 'memory') {
      logger.warn('storage_init', {
        message: 'OPFS unavailable — data will be lost on refresh. Ensure COOP and COEP headers are set.',
      });
    }
  }

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
      note TEXT, description TEXT, date TEXT NOT NULL, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `;
  // Migration: add description column if upgrading from older schema
  try {
    await sqlocal.sql`ALTER TABLE transactions ADD COLUMN description TEXT`;
  } catch { /* column already exists — ok */ }
  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS transaction_tags (
      id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id),
      tag TEXT NOT NULL
    )
  `;
  await sqlocal.sql`
    CREATE INDEX IF NOT EXISTS idx_transaction_tags_transaction_id ON transaction_tags(transaction_id)
  `;
  await sqlocal.sql`
    CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag ON transaction_tags(tag)
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
      use_count INTEGER NOT NULL DEFAULT 1, last_used_at INTEGER NOT NULL,
      confirm_strategy TEXT NOT NULL DEFAULT 'auto'
    )
  `;
  // Migration: add confirm_strategy column if upgrading from older schema
  try {
    await sqlocal.sql`ALTER TABLE merchant_hints ADD COLUMN confirm_strategy TEXT NOT NULL DEFAULT 'auto'`;
  } catch { /* column already exists — ok */ }
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

  await sqlocal.sql`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, type TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL,
      data TEXT, status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL, acted_at INTEGER
    )
  `;
  await sqlocal.sql`
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)
  `;
  await sqlocal.sql`
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)
  `;
  await sqlocal.sql`
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)
  `;

  initialized = true;
}
