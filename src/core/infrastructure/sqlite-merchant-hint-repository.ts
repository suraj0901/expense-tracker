/**
 * SQLite merchant hint repository — implements MerchantHintRepository.
 */
import type { MerchantHintRepository } from '../app/interfaces';
import type { MerchantHint } from '../domain/types';
import { upsertMerchantHint, getMerchantHints, getAllMerchantHints, updateMerchantHint, deleteMerchantHint } from '../db/merchant-hints';

export function createMerchantHintRepository(): MerchantHintRepository {
  return {
    async upsert(merchant: string, category: string, confirmStrategy?: string): Promise<void> {
      await upsertMerchantHint(merchant, category, confirmStrategy);
    },
    async getTop(limit: number = 30): Promise<MerchantHint[]> {
      return getMerchantHints(limit) as Promise<MerchantHint[]>;
    },
    async getAll(): Promise<MerchantHint[]> {
      return getAllMerchantHints() as Promise<MerchantHint[]>;
    },
    async update(canonicalName: string, fields: { category?: string; confirmStrategy?: string }): Promise<boolean> {
      return updateMerchantHint(canonicalName, fields);
    },
    async delete(canonicalName: string): Promise<void> {
      await deleteMerchantHint(canonicalName);
    },
  };
}
