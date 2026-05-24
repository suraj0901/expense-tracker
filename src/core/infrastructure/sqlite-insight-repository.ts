/**
 * SQLite insight repository — implements InsightRepository.
 */
import type { InsightRepository } from '../app/interfaces';
import { getInsight, upsertInsight, isInsightStale } from '../db/insights';

export function createInsightRepository(): InsightRepository {
  return {
    async get(month: number, year: number) {
      return getInsight(month, year);
    },
    async upsert(month: number, year: number, text: string) {
      await upsertInsight(month, year, text);
    },
    async isStale(month: number, year: number, generatedAt: number) {
      return isInsightStale(month, year, generatedAt);
    },
  };
}
