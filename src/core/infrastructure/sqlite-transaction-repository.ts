/**
 * SQLite transaction repository — implements TransactionRepository
 * by wrapping the existing DB transaction operations.
 */
import type {
  TransactionRepository, InsertTransactionParams,
  UpdateTransactionParams, QueryTransactionsParams,
} from '../app/interfaces';
import type { Transaction } from '../domain/types';
import { insertTransaction, updateTransaction, softDelete, undoDelete } from '../db/transactions-write';
import { queryTransactions, getRecent, getTransactionById } from '../db/transactions-read';

export function createTransactionRepository(): TransactionRepository {
  return {
    async insert(params: InsertTransactionParams) {
      return insertTransaction(params);
    },
    async update(id: string, params: UpdateTransactionParams) {
      return updateTransaction(id, params);
    },
    async softDelete(id: string) {
      return softDelete(id);
    },
    async undoDelete(id: string) {
      return undoDelete(id);
    },
    async query(params: QueryTransactionsParams): Promise<Transaction[]> {
      return queryTransactions(params) as Promise<Transaction[]>;
    },
    async getRecent(count: number = 10): Promise<Transaction[]> {
      return getRecent(count) as Promise<Transaction[]>;
    },
    async getById(id: string): Promise<Transaction | null> {
      const result = await getTransactionById(id);
      return result as Transaction | null;
    },
  };
}
