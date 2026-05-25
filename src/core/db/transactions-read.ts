/**
 * Transaction read operations — queries and recent transactions.
 */
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';
import type { Paise } from '../domain/money';
import { getTagsForTransactions } from './transaction-tags';

interface QueryTransactionsParams {
  category?: string; start_date?: string; end_date?: string;
  merchant?: string; limit?: number; tags?: string[];
}

async function attachTags<T extends { id: string }>(rows: T[]): Promise<(T & { tags: string[] })[]> {
  if (rows.length === 0) return rows.map(r => ({ ...r, tags: [] }));
  const ids = rows.map(r => r.id);
  const tagMap = await getTagsForTransactions(ids);
  return rows.map(r => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
}

export async function queryTransactions(params: QueryTransactionsParams) {
  const conditions = [eq(schema.transactions.isDeleted, false)];
  if (params.category) conditions.push(eq(schema.transactions.category, params.category));
  if (params.start_date) conditions.push(gte(schema.transactions.date, params.start_date));
  if (params.end_date) conditions.push(lte(schema.transactions.date, params.end_date));
  if (params.merchant) conditions.push(eq(schema.transactions.merchant, params.merchant));

  if (params.tags && params.tags.length > 0) {
    const normalizedTags = params.tags.map(t => t.toLowerCase().trim());
    // Subquery: find transaction IDs that have ALL requested tags
    const tagMatches = await db
      .select({ transactionId: schema.transactionTags.transactionId })
      .from(schema.transactionTags)
      .where(and(
        inArray(schema.transactionTags.tag, normalizedTags),
        eq(schema.transactions.isDeleted, false),
      ))
      .innerJoin(schema.transactions, eq(schema.transactions.id, schema.transactionTags.transactionId))
      .groupBy(schema.transactionTags.transactionId)
      .having(sql`COUNT(DISTINCT ${schema.transactionTags.tag}) = ${normalizedTags.length}`);
    const matchingIds = tagMatches.map(r => r.transactionId);
    if (matchingIds.length === 0) return [];
    conditions.push(inArray(schema.transactions.id, matchingIds));
  }

  const results = await db.select().from(schema.transactions)
    .where(and(...conditions)).orderBy(desc(schema.transactions.date))
    .limit(params.limit ?? 50);
  const withTags = await attachTags(results);
  return withTags.map((r) => ({ ...r, amount: r.amount as Paise }));
}

export async function getRecent(count: number = 10) {
  const results = await db.select().from(schema.transactions)
    .where(eq(schema.transactions.isDeleted, false))
    .orderBy(desc(schema.transactions.createdAt)).limit(count);
  return attachTags(results);
}

export async function getTransactionById(id: string) {
  const results = await db.select().from(schema.transactions)
    .where(and(eq(schema.transactions.id, id), eq(schema.transactions.isDeleted, false)))
    .limit(1);
  if (results.length === 0) return null;
  const withTags = await attachTags(results);
  return withTags[0] ?? null;
}
