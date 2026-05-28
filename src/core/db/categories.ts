/**
 * Categories — read and write category data.
 */
import { nanoid } from 'nanoid';
import { eq, desc, ne, isNotNull, and } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';

export async function getCategories() {
  return db.select().from(schema.categories).orderBy(schema.categories.sortOrder);
}

export async function insertCategory(name: string, icon: string) {
  const all = await db.select().from(schema.categories).all();

  const duplicate = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return { name: duplicate.name, icon: duplicate.icon, existed: true };

  const maxOrder = all.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), 0);
  await db.insert(schema.categories).values({
    id: nanoid(),
    name,
    icon,
    budgetAmount: null,
    isDefault: false,
    sortOrder: maxOrder + 1,
  });

  return { name, icon, existed: false };
}

export async function updateCategory(categoryName: string, fields: { name?: string; icon?: string }) {
  const all = await db.select().from(schema.categories).all();
  const existing = all.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!existing) return false;

  if (fields.name) {
    const dupe = all.find(
      (c) => c.name.toLowerCase() === fields.name!.toLowerCase() && c.id !== existing.id
    );
    if (dupe) return false;
  }

  await db.update(schema.categories)
    .set(fields)
    .where(eq(schema.categories.id, existing.id));
  return true;
}

export async function deleteCategory(categoryName: string) {
  const all = await db.select().from(schema.categories).all();
  const existing = all.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!existing) return false;

  await db.delete(schema.categories).where(eq(schema.categories.id, existing.id));
  return true;
}

export async function setCategoryBudget(categoryName: string, budgetAmount: number) {
  const all = await db.select().from(schema.categories).all();
  const existing = all.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!existing) return false;

  await db.update(schema.categories)
    .set({ budgetAmount })
    .where(eq(schema.categories.id, existing.id));
  return true;
}

export async function clearCategoryBudget(categoryName: string) {
  const all = await db.select().from(schema.categories).all();
  const existing = all.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!existing) return false;

  await db.update(schema.categories)
    .set({ budgetAmount: null })
    .where(eq(schema.categories.id, existing.id));
  return true;
}

export async function getBudgetedCategories() {
  const result = await db.select().from(schema.categories)
    .where(and(
      isNotNull(schema.categories.budgetAmount),
      ne(schema.categories.budgetAmount, 0),
    ))
    .orderBy(desc(schema.categories.budgetAmount));
  return result;
}
