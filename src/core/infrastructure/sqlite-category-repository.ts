/**
 * SQLite category repository — implements CategoryRepository.
 */
import type { CategoryRepository } from '../app/interfaces';
import type { Category } from '../domain/types';
import { getCategories, insertCategory } from '../db/categories';
import type { Paise } from '../domain/money';

export function createCategoryRepository(): CategoryRepository {
  return {
    async getAll(): Promise<Category[]> {
      const cats = await getCategories();
      return cats.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon ?? '📦',
        budgetAmount: (c.budgetAmount ?? null) as Paise | null,
        isDefault: c.isDefault,
        sortOrder: c.sortOrder ?? 0,
      }));
    },
    async create(name: string, icon: string) {
      const result = await insertCategory(name, icon);
      return { ...result, icon: result.icon ?? '📦' };
    },
  };
}
