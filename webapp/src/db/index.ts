/**
 * Database module exports.
 * Provides SQLite-based local storage for the budget app.
 */

// Core database functions
export {
  initDatabase,
  getDatabase,
  isDatabaseReady,
  persistDatabase,
  exportDatabase,
  importDatabase,
  closeDatabase,
  execSQL,
  runSQL,
} from "./sqlite";

// Schema and migrations
export { runMigrations, isDatabaseSetup, clearAllData, getTableStats } from "./schema";

// Entity operations
export * from "./transactions";
export * from "./categories";
export * from "./budgets";
export * from "./dashboard";

// Re-export types
export type { GetTransactionsParams } from "./transactions";
export type { DashboardParams } from "./dashboard";
