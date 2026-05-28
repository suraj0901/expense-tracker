/**
 * SQLite summary repository — implements SummaryRepository.
 */
import type { SummaryRepository } from '../app/interfaces';
import type { MonthlySummary, CategoryBreakdownItem, BudgetStatusResult } from '../domain/types';
import { getMonthlySummary, getCategoryBreakdown, getBudgetStatus, getSpendingTrend } from '../db/summaries';

export function createSummaryRepository(): SummaryRepository {
  return {
    async getMonthlySummary(month: number, year: number): Promise<MonthlySummary> {
      return getMonthlySummary(month, year) as Promise<MonthlySummary>;
    },
    async getCategoryBreakdown(startDate: string, endDate: string): Promise<CategoryBreakdownItem[]> {
      return getCategoryBreakdown(startDate, endDate) as Promise<CategoryBreakdownItem[]>;
    },
    async getBudgetStatus(): Promise<BudgetStatusResult> {
      const result = await getBudgetStatus();
      return result as BudgetStatusResult;
    },
    async getSpendingTrend(): Promise<SpendingTrend> {
      return getSpendingTrend() as Promise<SpendingTrend>;
    },
  };
}
