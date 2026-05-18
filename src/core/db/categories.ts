/**
 * Categories — read and write category data.
 */
import { nanoid } from 'nanoid';
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
