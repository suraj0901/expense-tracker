/**
 * Categories — read the category list from the DB.
 */
import * as schema from './schema';
import { db } from './init';

export async function getCategories() {
  return db.select().from(schema.categories).orderBy(schema.categories.sortOrder);
}
