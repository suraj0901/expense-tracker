/**
 * DB client — bootstrap and admin-only exports.
 *
 * Data CRUD operations are consumed via repository interfaces from
 * the composition root. This barrel is intentionally minimal —
 * only bootstrap (init) and admin operations (backup/export) remain.
 */
export { db, initializeDatabase, getStorageInfo } from './init';
export type { StorageInfo } from './init';
export { exportCSV, exportPDF } from './export';
export { exportDatabase, importDatabase, autoBackup, getStoredBackups, restoreFromLocalBackup, processPendingRestore, deleteLocalBackup } from './backup';
