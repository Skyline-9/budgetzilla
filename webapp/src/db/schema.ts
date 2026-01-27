/**
 * Database schema and migration system.
 */
import { execSQL, runSQL, persistDatabase, isTauri } from "./sqlite";

const SCHEMA_VERSION = 1;

/**
 * Schema definitions for all tables.
 */
const SCHEMA = `
-- Schema version tracking
CREATE TABLE IF NOT EXISTS _schema_version (
  version INTEGER PRIMARY KEY
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category_id TEXT,
  merchant TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER DEFAULT 0
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  parent_id TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Budgets table (overall monthly budgets have category_id = '')
CREATE TABLE IF NOT EXISTS budgets (
  month TEXT NOT NULL,
  category_id TEXT NOT NULL DEFAULT '',
  budget_cents INTEGER NOT NULL,
  PRIMARY KEY (month, category_id)
);

-- Config key-value store
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(deleted);
CREATE INDEX IF NOT EXISTS idx_categories_kind ON categories(kind);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
`;

/**
 * Get the current schema version from the database.
 */
async function getCurrentVersion(): Promise<number> {
  try {
    const result = await execSQL("SELECT version FROM _schema_version LIMIT 1");
    if (result.length > 0) {
      return result[0][0] as number;
    }
  } catch {
    // Table doesn't exist yet
  }
  return 0;
}

/**
 * Set the schema version in the database.
 */
async function setVersion(version: number): Promise<void> {
  await runSQL("DELETE FROM _schema_version");
  await runSQL("INSERT INTO _schema_version (version) VALUES (?)", [version]);
}

/**
 * Run migrations to bring database up to current schema.
 */
export async function runMigrations(): Promise<void> {
  const currentVersion = await getCurrentVersion();

  console.log(`Database version: ${currentVersion}, target: ${SCHEMA_VERSION}`);

  if (currentVersion < SCHEMA_VERSION) {
    console.log("Running migrations...");

    // Create all tables (IF NOT EXISTS makes this idempotent)
    // Execute each statement separately for Tauri compatibility
    const statements = SCHEMA.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await runSQL(stmt);
      }
    }

    // Run version-specific migrations
    if (currentVersion < 1) {
      // Initial schema - nothing extra needed
      console.log("Applied migration v1: Initial schema");
    }

    // Future migrations would go here:
    // if (currentVersion < 2) { ... }

    await setVersion(SCHEMA_VERSION);
    await persistDatabase();

    console.log(`Migrations complete. Database now at version ${SCHEMA_VERSION}`);
  } else {
    console.log("Database schema is up to date");
  }
}

/**
 * Check if the database has been set up (has tables).
 */
export async function isDatabaseSetup(): Promise<boolean> {
  try {
    const result = await execSQL(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
    );
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Clear all data from the database (keeps schema).
 */
export async function clearAllData(): Promise<void> {
  await runSQL("DELETE FROM transactions");
  await runSQL("DELETE FROM categories");
  await runSQL("DELETE FROM budgets");
  await runSQL("DELETE FROM config");
  await persistDatabase();
}

/**
 * Get table row counts (for debugging/stats).
 */
export async function getTableStats(): Promise<Record<string, number>> {
  const tables = ["transactions", "categories", "budgets", "config"];
  const stats: Record<string, number> = {};

  for (const table of tables) {
    try {
      const result = await execSQL(`SELECT COUNT(*) FROM ${table}`);
      stats[table] = result[0]?.[0] as number ?? 0;
    } catch {
      stats[table] = 0;
    }
  }

  return stats;
}
