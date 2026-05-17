/**
 * DB client — barrel re-exports.
 */
export { db, initializeDatabase } from './init';
export { insertTransaction, updateTransaction, softDelete, undoDelete } from './transactions-write';
export { queryTransactions, getRecent } from './transactions-read';
export { getMonthlySummary, getCategoryBreakdown, getBudgetStatus } from './summaries';
export { saveMessage, getMessageHistory, getAllMessages } from './messages';
export { upsertMerchantHint, getMerchantHints } from './merchant-hints';
export { getCategories } from './categories';
