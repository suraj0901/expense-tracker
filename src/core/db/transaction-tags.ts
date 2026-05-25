/**
 * Transaction tags — CRUD for the transaction_tags table.
 */
import { eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as schema from './schema';
import { db } from './init';

export async function getTagsForTransaction(transactionId: string): Promise<string[]> {
  const rows = await db
    .select({ tag: schema.transactionTags.tag })
    .from(schema.transactionTags)
    .where(eq(schema.transactionTags.transactionId, transactionId));
  return rows.map((r) => r.tag);
}

export async function getTagsForTransactions(transactionIds: string[]): Promise<Map<string, string[]>> {
  if (transactionIds.length === 0) return new Map();
  const map = new Map<string, string[]>();
  for (const id of transactionIds) map.set(id, []);
  const rows = await db
    .select()
    .from(schema.transactionTags)
    .where(inArray(schema.transactionTags.transactionId, transactionIds));
  for (const row of rows) {
    const list = map.get(row.transactionId);
    if (list) list.push(row.tag);
  }
  return map;
}

export async function insertTags(transactionId: string, tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  const normalized = [...new Set(tags.map((t) => t.toLowerCase().trim()))].filter(Boolean);
  for (const tag of normalized) {
    await db.insert(schema.transactionTags).values({
      id: nanoid(),
      transactionId,
      tag,
    });
  }
}

export async function deleteTagsForTransaction(transactionId: string): Promise<void> {
  await db
    .delete(schema.transactionTags)
    .where(eq(schema.transactionTags.transactionId, transactionId));
}

export async function upsertTagsForTransaction(transactionId: string, tags: string[]): Promise<void> {
  await deleteTagsForTransaction(transactionId);
  await insertTags(transactionId, tags);
}
