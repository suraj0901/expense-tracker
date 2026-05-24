/**
 * SQLite merchant hint repository — implements MerchantHintRepository.
 */
import type { MerchantHintRepository } from '../app/interfaces';
import type { MerchantHint } from '../domain/types';
import { upsertMerchantHint, getMerchantHints } from '../db/merchant-hints';

export function createMerchantHintRepository(): MerchantHintRepository {
  return {
    async upsert(merchant: string, category: string): Promise<void> {
      await upsertMerchantHint(merchant, category);
    },
    async getTop(limit: number = 30): Promise<MerchantHint[]> {
      return getMerchantHints(limit);
    },
  };
}
