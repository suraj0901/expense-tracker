/**
 * Transaction write operations — insert, update, soft-delete, undo.
 */
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';

interface InsertTransactionParams {
  id: string; amount: number; type: string; category: string;
  merchant?: string | null; note?: string | null; date: string;
  createdAt: number; updatedAt: number; isDeleted: boolean;
}

export async function insertTransaction(params: InsertTransactionParams) {
  await db.insert(schema.transactions).values({
    id: params.id, amount: params.amount, type: params.type,
    category: params.category, merchant: params.merchant ?? null,
    note: params.note ?? null, date: params.date,
    createdAt: params.createdAt, updatedAt: params.updatedAt,
    isDeleted: params.isDeleted,
  });
  return { success: true, id: params.id };
}

interface UpdateTransactionParams {
  amount?: number; category?: string; merchant?: string; note?: string; updatedAt: number;
}

export async function updateTransaction(id: string, params: UpdateTransactionParams) {
  const data: Record<string, unknown> = { updatedAt: params.updatedAt };
  if (params.amount !== undefined) data.amount = params.amount;
  if (params.category !== undefined) data.category = params.category;
  if (params.merchant !== undefined) data.merchant = params.merchant;
  if (params.note !== undefined) data.note = params.note;
  await db.update(schema.transactions).set(data).where(eq(schema.transactions.id, id));
  return { success: true, id };
}

export async function softDelete(id: string) {
  await db.update(schema.transactions)
    .set({ isDeleted: true, updatedAt: Date.now() })
    .where(eq(schema.transactions.id, id));
  return { success: true, id };
}

export async function undoDelete(id: string) {
  await db.update(schema.transactions)
    .set({ isDeleted: false, updatedAt: Date.now() })
    .where(eq(schema.transactions.id, id));
  return { success: true, id };
}
