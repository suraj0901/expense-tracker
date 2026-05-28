/**
 * SQLite category repository — implements CategoryRepository.
 */
import type { CategoryRepository } from '../app/interfaces';
import type { Category } from '../domain/types';
import { getCategories, insertCategory, updateCategory, deleteCategory, setCategoryBudget, clearCategoryBudget, getBudgetedCategories } from '../db/categories';
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
    async update(name: string, fields: { name?: string; icon?: string }) {
      return updateCategory(name, fields);
    },
    async delete(name: string) {
      return deleteCategory(name);
    },
    async setBudget(name: string, budgetAmount: number) {
      return setCategoryBudget(name, budgetAmount);
    },
    async clearBudget(name: string) {
      return clearCategoryBudget(name);
    },
    async getBudgeted(): Promise<Category[]> {
      const cats = await getBudgetedCategories();
      return cats.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon ?? '📦',
        budgetAmount: (c.budgetAmount ?? null) as Paise | null,
        isDefault: c.isDefault,
        sortOrder: c.sortOrder ?? 0,
      }));
    },
  };
}
