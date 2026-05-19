/**
 * DB client — barrel re-exports.
 */
export { db, initializeDatabase, getStorageInfo } from './init';
export type { StorageInfo } from './init';
export { insertTransaction, updateTransaction, softDelete, undoDelete } from './transactions-write';
export { queryTransactions, getRecent } from './transactions-read';
export { getMonthlySummary, getCategoryBreakdown, getBudgetStatus } from './summaries';
export { saveMessage, getMessageHistory, getAllMessages } from './messages';
export { upsertMerchantHint, getMerchantHints } from './merchant-hints';
export { getCategories, insertCategory } from './categories';
export { getInsight, upsertInsight, isInsightStale } from './insights';
export { setGoal, getGoals, updateGoal, deleteGoal } from './goals';
export type { Goal } from './goals';
export { exportCSV, exportPDF } from './export';
