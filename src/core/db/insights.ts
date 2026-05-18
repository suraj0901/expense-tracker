/**
 * Insights cache — store AI-generated monthly insights so we don't regenerate on every navigation.
 */
import { eq, and, gte, lt, sql } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';

export async function getInsight(month: number, year: number) {
  const rows = await db.select()
    .from(schema.insights)
    .where(and(eq(schema.insights.month, month), eq(schema.insights.year, year)));
  if (rows.length === 0) return null;
  const r = rows[0];
  return { text: r.text, generatedAt: r.generatedAt };
}

export async function upsertInsight(month: number, year: number, text: string) {
  const generatedAt = Date.now();
  const existing = await db.select()
    .from(schema.insights)
    .where(and(eq(schema.insights.month, month), eq(schema.insights.year, year)));
  if (existing.length > 0) {
    await db.update(schema.insights)
      .set({ text, generatedAt })
      .where(and(eq(schema.insights.month, month), eq(schema.insights.year, year)));
  } else {
    await db.insert(schema.insights).values({ month, year, text, generatedAt });
  }
}

export async function isInsightStale(month: number, year: number, generatedAt: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const rows = await db.select({
    maxUpdated: sql<number>`MAX(${schema.transactions.updatedAt})`,
  }).from(schema.transactions).where(and(
    eq(schema.transactions.isDeleted, false),
    gte(schema.transactions.date, startDate),
    lt(schema.transactions.date, endDate),
  ));
  const maxUpdated = rows[0]?.maxUpdated ?? 0;
  return maxUpdated > generatedAt;
}
