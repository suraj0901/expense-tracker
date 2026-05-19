/**
 * Database backup — full export/import + auto-backup to localStorage.
 */
import * as schema from './schema';
import { db } from './init';

const BACKUP_PREFIX = 'db_backup_';
const MAX_BACKUPS = 7;

export interface BackupData {
  version: 1;
  exportedAt: number;
  tables: {
    categories: (typeof schema.categories.$inferSelect)[];
    transactions: (typeof schema.transactions.$inferSelect)[];
    messages: (typeof schema.messages.$inferSelect)[];
    merchant_hints: (typeof schema.merchantHints.$inferSelect)[];
    goals: (typeof schema.goals.$inferSelect)[];
    insights: (typeof schema.insights.$inferSelect)[];
  };
}

async function dumpTables(): Promise<BackupData['tables']> {
  const [categories, transactions, messages, merchant_hints, goals, insights] =
    await Promise.all([
      db.select().from(schema.categories),
      db.select().from(schema.transactions),
      db.select().from(schema.messages),
      db.select().from(schema.merchantHints),
      db.select().from(schema.goals),
      db.select().from(schema.insights),
    ]);
  return { categories, transactions, messages, merchant_hints, goals, insights };
}

export async function exportDatabase(): Promise<void> {
  const tables = await dumpTables();
  const backup: BackupData = { version: 1, exportedAt: Date.now(), tables };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `expense-tracker-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importDatabase(file: File): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data || data.version !== 1 || !data.tables) {
      return { success: false, error: 'Invalid backup file format.' };
    }

    const { tables } = data as BackupData;

    // Validate required tables exist
    const required = ['categories', 'transactions', 'messages'];
    for (const t of required) {
      if (!Array.isArray((tables as Record<string, unknown>)[t])) {
        return { success: false, error: `Missing table: ${t}` };
      }
    }

    // Clear and restore in dependency order
    await db.delete(schema.insights);
    await db.delete(schema.goals);
    await db.delete(schema.merchantHints);
    await db.delete(schema.messages);
    await db.delete(schema.transactions);
    await db.delete(schema.categories);

    if (tables.categories.length > 0) {
      for (const row of tables.categories) {
        await db.insert(schema.categories).values(row);
      }
    }
    if (tables.transactions.length > 0) {
      for (const row of tables.transactions) {
        await db.insert(schema.transactions).values(row);
      }
    }
    if (tables.messages.length > 0) {
      for (const row of tables.messages) {
        await db.insert(schema.messages).values(row);
      }
    }
    if (tables.merchant_hints?.length > 0) {
      for (const row of tables.merchant_hints) {
        await db.insert(schema.merchantHints).values(row);
      }
    }
    if (tables.goals?.length > 0) {
      for (const row of tables.goals) {
        await db.insert(schema.goals).values(row);
      }
    }
    if (tables.insights?.length > 0) {
      for (const row of tables.insights) {
        await db.insert(schema.insights).values(row);
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error importing backup.' };
  }
}

export async function autoBackup(): Promise<void> {
  try {
    const tables = await dumpTables();
    const backup: BackupData = { version: 1, exportedAt: Date.now(), tables };
    const json = JSON.stringify(backup);
    const dateKey = new Date().toISOString().split('T')[0];
    localStorage.setItem(`${BACKUP_PREFIX}${dateKey}`, json);

    // Prune old backups, keep last MAX_BACKUPS
    const keys = getBackupKeys();
    if (keys.length > MAX_BACKUPS) {
      const toRemove = keys.slice(0, keys.length - MAX_BACKUPS);
      for (const k of toRemove) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // Auto-backup failures are silent
  }
}

function getBackupKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(BACKUP_PREFIX)) keys.push(k);
  }
  keys.sort();
  return keys;
}

export interface StoredBackup {
  date: string;
  sizeBytes: number;
}

export function getStoredBackups(): StoredBackup[] {
  return getBackupKeys().map((k) => ({
    date: k.replace(BACKUP_PREFIX, ''),
    sizeBytes: (localStorage.getItem(k) ?? '').length,
  }));
}

export function restoreFromLocalBackup(date: string): boolean {
  const json = localStorage.getItem(`${BACKUP_PREFIX}${date}`);
  if (!json) return false;

  try {
    const data = JSON.parse(json) as BackupData;
    if (!data || data.version !== 1 || !data.tables) return false;

    // We can't await inside a non-async context easily,
    // so store the parsed data for the caller to process
    localStorage.setItem('db_restore_pending', json);
    return true;
  } catch {
    return false;
  }
}

export async function processPendingRestore(): Promise<boolean> {
  const json = localStorage.getItem('db_restore_pending');
  if (!json) return false;

  try {
    const data = JSON.parse(json) as BackupData;
    const { tables } = data;

    await db.delete(schema.insights);
    await db.delete(schema.goals);
    await db.delete(schema.merchantHints);
    await db.delete(schema.messages);
    await db.delete(schema.transactions);
    await db.delete(schema.categories);

    if (tables.categories.length > 0) {
      for (const row of tables.categories) await db.insert(schema.categories).values(row);
    }
    if (tables.transactions.length > 0) {
      for (const row of tables.transactions) await db.insert(schema.transactions).values(row);
    }
    if (tables.messages.length > 0) {
      for (const row of tables.messages) await db.insert(schema.messages).values(row);
    }
    if (tables.merchant_hints?.length > 0) {
      for (const row of tables.merchant_hints) await db.insert(schema.merchantHints).values(row);
    }
    if (tables.goals?.length > 0) {
      for (const row of tables.goals) await db.insert(schema.goals).values(row);
    }
    if (tables.insights?.length > 0) {
      for (const row of tables.insights) await db.insert(schema.insights).values(row);
    }

    localStorage.removeItem('db_restore_pending');
    return true;
  } catch {
    return false;
  }
}

export function deleteLocalBackup(date: string): void {
  localStorage.removeItem(`${BACKUP_PREFIX}${date}`);
}
