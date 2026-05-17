/**
 * Transaction read operations — queries and recent transactions.
 */
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';
import type { Paise } from '../domain/money';

interface QueryTransactionsParams {
  category?: string; start_date?: string; end_date?: string;
  merchant?: string; limit?: number;
}

export async function queryTransactions(params: QueryTransactionsParams) {
  const conditions = [eq(schema.transactions.isDeleted, false)];
  if (params.category) conditions.push(eq(schema.transactions.category, params.category));
  if (params.start_date) conditions.push(gte(schema.transactions.date, params.start_date));
  if (params.end_date) conditions.push(lte(schema.transactions.date, params.end_date));
  if (params.merchant) conditions.push(eq(schema.transactions.merchant, params.merchant));
  const results = await db.select().from(schema.transactions)
    .where(and(...conditions)).orderBy(desc(schema.transactions.date))
    .limit(params.limit ?? 50);
  return results.map((r) => ({ ...r, amount: r.amount as Paise }));
}

export async function getRecent(count: number = 10) {
  return db.select().from(schema.transactions)
    .where(eq(schema.transactions.isDeleted, false))
    .orderBy(desc(schema.transactions.createdAt)).limit(count);
}
