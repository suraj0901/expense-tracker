/**
 * Goals CRUD — set, get, update, delete financial goals.
 */
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';
import type { Paise } from '../domain/money';
import type { Goal } from '../domain/types';

export async function setGoal(goal: {
  id: string;
  name: string;
  targetAmount: Paise;
  category?: string | null;
  deadline?: string | null;
}): Promise<Goal> {
  const now = Date.now();
  await db.insert(schema.goals).values({
    id: goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: 0 as Paise,
    category: goal.category ?? null,
    deadline: goal.deadline ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return {
    ...goal,
    currentAmount: 0 as Paise,
    category: goal.category ?? null,
    deadline: goal.deadline ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getGoals(): Promise<Goal[]> {
  const rows = await db.select().from(schema.goals)
    .orderBy(schema.goals.createdAt);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    targetAmount: r.targetAmount as Paise,
    currentAmount: r.currentAmount as Paise,
    category: r.category,
    deadline: r.deadline,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function updateGoal(
  id: string,
  fields: {
    name?: string;
    targetAmount?: Paise;
    currentAmount?: Paise;
    category?: string | null;
    deadline?: string | null;
  }
): Promise<Goal | null> {
  const existing = await db.select().from(schema.goals).where(eq(schema.goals.id, id));
  if (existing.length === 0) return null;

  await db.update(schema.goals)
    .set({ ...fields, updatedAt: Date.now() })
    .where(eq(schema.goals.id, id));

  const rows = await db.select().from(schema.goals).where(eq(schema.goals.id, id));
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    targetAmount: r.targetAmount as Paise,
    currentAmount: r.currentAmount as Paise,
    category: r.category,
    deadline: r.deadline,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function deleteGoal(id: string): Promise<boolean> {
  const existing = await db.select().from(schema.goals).where(eq(schema.goals.id, id));
  if (existing.length === 0) return false;
  await db.delete(schema.goals).where(eq(schema.goals.id, id));
  return true;
}
