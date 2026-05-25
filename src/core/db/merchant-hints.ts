/**
 * Merchant hints — learn merchant→category mappings for cross-session memory.
 */
import { eq, desc } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';

export async function upsertMerchantHint(merchant: string, category: string, confirmStrategy?: string) {
  const canonical = merchant.toLowerCase().trim();
  if (!canonical) return;
  const existing = await db.select().from(schema.merchantHints)
    .where(eq(schema.merchantHints.canonicalName, canonical));
  const strategy = confirmStrategy ?? existing[0]?.confirmStrategy ?? 'auto';
  if (existing.length > 0) {
    await db.update(schema.merchantHints).set({
      category, useCount: (existing[0].useCount ?? 1) + 1, lastUsedAt: Date.now(),
      confirmStrategy: strategy,
    }).where(eq(schema.merchantHints.canonicalName, canonical));
  } else {
    await db.insert(schema.merchantHints).values({
      canonicalName: canonical, category, useCount: 1, lastUsedAt: Date.now(),
      confirmStrategy: strategy,
    });
  }
}

export async function getMerchantHints(limit: number = 30) {
  return db.select().from(schema.merchantHints)
    .orderBy(desc(schema.merchantHints.useCount)).limit(limit);
}
