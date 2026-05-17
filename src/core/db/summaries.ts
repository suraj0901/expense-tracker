/**
 * Summary operations — monthly summaries, category breakdowns, budget status.
 */
import { eq, and, gte, lte, desc, sql, sum, count, ne } from 'drizzle-orm';
import * as schema from './schema';
import { db } from './init';
import type { Paise } from '../domain/money';

export async function getMonthlySummary(month: number, year: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const results = await db.select({
    type: schema.transactions.type, total: sum(schema.transactions.amount),
  }).from(schema.transactions).where(and(
    eq(schema.transactions.isDeleted, false),
    gte(schema.transactions.date, startDate), lte(schema.transactions.date, endDate),
  )).groupBy(schema.transactions.type);
  let totalIncome = 0, totalExpense = 0;
  for (const row of results) {
    const t = Number(row.total) || 0;
    if (row.type === 'income') totalIncome = t;
    if (row.type === 'expense') totalExpense = t;
  }
  const catResults = await db.select({
    category: schema.transactions.category,
    total: sum(schema.transactions.amount), count: count(),
  }).from(schema.transactions).where(and(
    eq(schema.transactions.isDeleted, false), eq(schema.transactions.type, 'expense'),
    gte(schema.transactions.date, startDate), lte(schema.transactions.date, endDate),
  )).groupBy(schema.transactions.category).orderBy(desc(sum(schema.transactions.amount)));
  const allCats = await db.select().from(schema.categories);
  const iconMap = new Map(allCats.map((c) => [c.name, c.icon ?? '📦']));
  const breakdown = catResults.map((r) => ({
    category: r.category, icon: iconMap.get(r.category) ?? '📦',
    total: (Number(r.total) || 0) as Paise, count: r.count,
    percentage: totalExpense > 0 ? ((Number(r.total) || 0) / totalExpense) * 100 : 0,
  }));
  return { month, year,
    totalIncome: totalIncome as Paise, totalExpense: totalExpense as Paise,
    savings: (totalIncome - totalExpense) as Paise,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
    categoryBreakdown: breakdown,
  };
}

export async function getCategoryBreakdown(startDate: string, endDate: string) {
  const results = await db.select({
    category: schema.transactions.category,
    total: sum(schema.transactions.amount), count: count(),
  }).from(schema.transactions).where(and(
    eq(schema.transactions.isDeleted, false), eq(schema.transactions.type, 'expense'),
    gte(schema.transactions.date, startDate), lte(schema.transactions.date, endDate),
  )).groupBy(schema.transactions.category).orderBy(desc(sum(schema.transactions.amount)));
  const total = results.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
  const allCats = await db.select().from(schema.categories);
  const iconMap = new Map(allCats.map((c) => [c.name, c.icon ?? '📦']));
  return results.map((r) => ({
    category: r.category, icon: iconMap.get(r.category) ?? '📦',
    total: (Number(r.total) || 0) as Paise, count: r.count,
    percentage: total > 0 ? ((Number(r.total) || 0) / total) * 100 : 0,
  }));
}

export async function getBudgetStatus() {
  const now = new Date(); const month = now.getMonth() + 1; const year = now.getFullYear();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const budgeted = await db.select().from(schema.categories).where(and(
    sql`${schema.categories.budgetAmount} IS NOT NULL`,
    ne(schema.categories.budgetAmount, 0),
  ));
  if (budgeted.length === 0) return { hasBudgets: false, message: 'No budgets set.', items: [] };
  const items = [];
  for (const cat of budgeted) {
    const spentResult = await db.select({ total: sum(schema.transactions.amount) })
      .from(schema.transactions).where(and(
        eq(schema.transactions.isDeleted, false), eq(schema.transactions.type, 'expense'),
        eq(schema.transactions.category, cat.name),
        gte(schema.transactions.date, startDate), lte(schema.transactions.date, endDate),
      ));
    const spent = (Number(spentResult[0]?.total) || 0) as Paise;
    const budget = (cat.budgetAmount ?? 0) as Paise;
    items.push({
      category: cat.name, icon: cat.icon ?? '📦', budgetAmount: budget, spent,
      remaining: (budget - spent) as Paise, percentUsed: budget > 0 ? (spent / budget) * 100 : 0,
    });
  }
  return { hasBudgets: true, items };
}
