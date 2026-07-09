/**
 * SQLite database initialization and persistence layer.
 * Uses Tauri SQL plugin for native apps (iOS/Android/Desktop),
 * falls back to sql.js with OPFS persistence for browser.
 */
import type { Database as SqlJsDatabase, SqlJsStatic } from "sql.js";
import type TauriDatabaseType from "@tauri-apps/plugin-sql";

// Dynamic check for Tauri - checked at runtime, not module load
// Tauri 2.x uses __TAURI_INTERNALS__ instead of __TAURI__
function checkIsTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
}

let SQL: SqlJsStatic | null = null;
let sqlJsDb: SqlJsDatabase | null = null;
let tauriDb: TauriDatabaseType | null = null;
let detectedTauri: boolean | null = null;

const DB_NAME = "budget.sqlite";
const TAURI_DB_PATH = "sqlite:budget.db";

function isTauriEnv(): boolean {
  if (detectedTauri === null) {
    detectedTauri = checkIsTauri();
  }
  return detectedTauri;
}

function isOpfsAvailable(): boolean {
  return typeof navigator !== "undefined" && "storage" in navigator && !isTauriEnv();
}

/**
 * Initialize the SQL.js library (loads WASM) - browser only.
 */
async function initSqlJs_(): Promise<SqlJsStatic> {
  if (SQL) return SQL;

  const initSqlJs = (await import("sql.js")).default;
  SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
  });

  return SQL;
}

/**
 * Load database from OPFS if available, otherwise from localStorage - browser only.
 */
async function loadPersistedData(): Promise<Uint8Array | null> {
  if (isOpfsAvailable()) {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(DB_NAME, { create: false });
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      // File doesn't exist yet
    }
  }

  try {
    const stored = localStorage.getItem(DB_NAME);
    if (stored) {
      const binary = atob(stored);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
  } catch {
    // localStorage not available
  }

  return null;
}

/**
 * Persist database - browser only (Tauri auto-persists).
 */
export async function persistDatabase(): Promise<void> {
  if (isTauriEnv()) return; // Tauri auto-persists
  if (!sqlJsDb) return;

  const data = sqlJsDb.export();

  if (isOpfsAvailable()) {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(DB_NAME, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(new Uint8Array(data).buffer as ArrayBuffer);
      await writable.close();
      return;
    } catch (err) {
      console.warn("OPFS write failed, falling back to localStorage:", err);
    }
  }

  try {
    const binary = Array.from(data as Uint8Array)
      .map((byte: number) => String.fromCharCode(byte))
      .join("");
    localStorage.setItem(DB_NAME, btoa(binary));
  } catch (err) {
    console.error("Failed to persist database:", err);
  }
}

/**
 * Initialize the database with retry logic for mobile.
 */
async function loadTauriDbWithRetry(maxRetries = 3): Promise<TauriDatabaseType> {
  const TauriDatabase = (await import("@tauri-apps/plugin-sql")).default;
  let lastError: unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const db = await TauriDatabase.load(TAURI_DB_PATH);
      // Enable WAL mode for better concurrency
      await db.execute("PRAGMA journal_mode=WAL");
      return db;
    } catch (err) {
      lastError = err;
      console.warn(`Database load attempt ${i + 1} failed:`, err);
      // Wait before retry (exponential backoff)
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Initialize the database.
 */
export async function initDatabase(): Promise<SqlJsDatabase | TauriDatabaseType> {
  if (isTauriEnv()) {
    if (tauriDb) return tauriDb;
    tauriDb = await loadTauriDbWithRetry();
    return tauriDb;
  } else {
    if (sqlJsDb) return sqlJsDb;
    const sql = await initSqlJs_();
    const persisted = await loadPersistedData();

    if (persisted) {
      sqlJsDb = new sql.Database(persisted);
    } else {
      sqlJsDb = new sql.Database();
    }

    return sqlJsDb;
  }
}

/**
 * Get the current database instance.
 */
export function getDatabase(): SqlJsDatabase | TauriDatabaseType {
  if (isTauriEnv()) {
    if (!tauriDb) {
      throw new Error("Database not initialized. Call initDatabase() first.");
    }
    return tauriDb;
  } else {
    if (!sqlJsDb) {
      throw new Error("Database not initialized. Call initDatabase() first.");
    }
    return sqlJsDb;
  }
}

/**
 * Check if the database has been initialized.
 */
export function isDatabaseReady(): boolean {
  return isTauriEnv() ? tauriDb !== null : sqlJsDb !== null;
}

/**
 * Check if running in Tauri environment.
 */
export function isTauri(): boolean {
  return isTauriEnv();
}

/**
 * Export the raw database bytes (for backup/sync) - browser only.
 */
export function exportDatabase(): Uint8Array {
  if (isTauriEnv()) {
    throw new Error("exportDatabase not supported in Tauri - use file system APIs");
  }
  if (!sqlJsDb) {
    throw new Error("Database not initialized");
  }
  return sqlJsDb.export();
}

/**
 * Import database from raw bytes - browser only.
 */
export async function importDatabase(data: Uint8Array): Promise<void> {
  if (isTauriEnv()) {
    throw new Error("importDatabase not supported in Tauri - use file system APIs");
  }
  
  const sql = await initSqlJs_();
  if (sqlJsDb) {
    sqlJsDb.close();
  }
  sqlJsDb = new sql.Database(data);
  await persistDatabase();
}

/**
 * Read all rows for a query, tolerating a missing table (returns []) so that an
 * older remote database without a given table doesn't abort the merge.
 */
function readAllRows(db: SqlJsDatabase, query: string): unknown[][] {
  try {
    const res = db.exec(query);
    if (res.length === 0) return [];
    return res[0].values as unknown[][];
  } catch {
    return [];
  }
}

/**
 * Reconcile a table keyed by `id` using the ISO `updated_at` column. ISO 8601
 * UTC timestamps compare lexicographically in chronological order, so the row
 * with the newer updated_at wins and carries its column values, including any
 * `deleted` tombstone. This propagates edits, deletes, and undeletes correctly.
 * Returns the number of local rows inserted or replaced.
 */
function mergeByUpdatedAt(
  local: SqlJsDatabase,
  remote: SqlJsDatabase,
  table: string,
  columns: string[],
): number {
  const idIdx = columns.indexOf("id");
  const tsIdx = columns.indexOf("updated_at");

  const localTimestamps = new Map<string, string>();
  for (const row of readAllRows(local, `SELECT id, updated_at FROM ${table}`)) {
    localTimestamps.set(String(row[0]), String(row[1]));
  }

  const remoteRows = readAllRows(remote, `SELECT ${columns.join(", ")} FROM ${table}`);
  if (remoteRows.length === 0) return 0;

  const placeholders = columns.map(() => "?").join(", ");
  const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

  let modified = 0;
  for (const row of remoteRows) {
    const id = String(row[idIdx]);
    const remoteTs = String(row[tsIdx]);
    const localTs = localTimestamps.get(id);
    if (localTs === undefined || remoteTs > localTs) {
      local.run(insertSql, row as (string | number | null)[]);
      modified++;
    }
  }
  return modified;
}

/**
 * Union a table by its primary key, keeping the local row on conflict. Used for
 * tables without a timestamp (budgets, config) so that rows unique to either
 * side are preserved. Returns the number of remote-only rows added locally.
 */
function mergeUnion(
  local: SqlJsDatabase,
  remote: SqlJsDatabase,
  table: string,
  columns: string[],
  keyColumns: string[],
): number {
  const keyIdx = keyColumns.map((k) => columns.indexOf(k));

  const localKeys = new Set<string>();
  for (const row of readAllRows(local, `SELECT ${keyColumns.join(", ")} FROM ${table}`)) {
    localKeys.add(row.map((v) => String(v)).join("\u0000"));
  }

  const remoteRows = readAllRows(remote, `SELECT ${columns.join(", ")} FROM ${table}`);
  if (remoteRows.length === 0) return 0;

  const placeholders = columns.map(() => "?").join(", ");
  const insertSql = `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

  let modified = 0;
  for (const row of remoteRows) {
    const key = keyIdx.map((i) => String(row[i])).join("\u0000");
    if (!localKeys.has(key)) {
      local.run(insertSql, row as (string | number | null)[]);
      modified++;
    }
  }
  return modified;
}

/**
 * Merge a remote database (raw bytes) into the local database at the row level,
 * instead of replacing the whole file. This prevents cross-device sync from
 * deleting rows that only exist on one device. Browser-only.
 * Returns the number of local rows inserted or updated by the merge.
 */
export async function mergeRemoteDatabase(data: Uint8Array): Promise<number> {
  if (isTauriEnv()) {
    throw new Error("mergeRemoteDatabase not supported in Tauri - use file system APIs");
  }

  const sql = await initSqlJs_();

  // No local database yet - adopt the remote one wholesale.
  if (!sqlJsDb) {
    sqlJsDb = new sql.Database(data);
    await persistDatabase();
    return 0;
  }

  const local = sqlJsDb;
  const remote = new sql.Database(data);
  let modified = 0;

  try {
    local.run("BEGIN TRANSACTION");

    modified += mergeByUpdatedAt(local, remote, "transactions", [
      "id", "date", "amount_cents", "category_id", "merchant", "notes", "created_at", "updated_at", "deleted",
    ]);
    modified += mergeByUpdatedAt(local, remote, "categories", [
      "id", "name", "kind", "parent_id", "active", "created_at", "updated_at",
    ]);
    modified += mergeUnion(local, remote, "budgets", ["month", "category_id", "budget_cents"], ["month", "category_id"]);
    modified += mergeUnion(local, remote, "config", ["key", "value"], ["key"]);

    local.run("COMMIT");
  } catch (err) {
    try {
      local.run("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    remote.close();
    throw err;
  }

  remote.close();
  await persistDatabase();
  return modified;
}

/**
 * Close the database connection.
 */
export async function closeDatabase(): Promise<void> {
  if (isTauriEnv() && tauriDb) {
    await tauriDb.close();
    tauriDb = null;
  } else if (sqlJsDb) {
    sqlJsDb.close();
    sqlJsDb = null;
  }
}

/**
 * Execute a SQL statement safely, allowing only read-only SELECT queries.
 * Designed for safe AI/User-generated query execution.
 */
export async function execReadOnlySQL(sql: string, params?: unknown[]): Promise<unknown[][]> {
  if (sql.includes(";")) {
    const parts = sql.split(";").filter(s => s.trim().length > 0);
    if (parts.length > 1) {
      throw new Error("Multiple statements are not allowed in read-only queries.");
    }
  }

  const normalized = sql.trim().toUpperCase();
  if (!normalized.startsWith("SELECT ") && !normalized.startsWith("WITH ")) {
    throw new Error("Only SELECT/WITH queries are allowed for safety.");
  }
  
  const prohibited = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "REPLACE", "TRUNCATE", "PRAGMA", "ATTACH", "DETACH"];
  const strippedSql = sql.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  for (const word of prohibited) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(strippedSql)) {
      throw new Error(`Prohibited keyword found in read-only query: ${word}`);
    }
  }

  return execSQL(sql, params);
}

/**
 * Execute a SQL statement and return results.
 * Works for both Tauri and browser.
 */
export async function execSQL(sql: string, params?: unknown[]): Promise<unknown[][]> {
  if (isTauriEnv()) {
    const db = getDatabase() as TauriDatabaseType;
    const result = await db.select<Record<string, unknown>[]>(sql, params as unknown[]);
    // Convert to array format
    if (result.length === 0) return [];
    const keys = Object.keys(result[0]);
    return result.map(row => keys.map(k => row[k]));
  } else {
    const db = getDatabase() as SqlJsDatabase;
    const result = db.exec(sql, params as (string | number | null | Uint8Array)[]);
    if (result.length === 0) return [];
    return result[0].values;
  }
}

/**
 * Run a SQL statement (INSERT, UPDATE, DELETE) without returning results.
 */
export async function runSQL(sql: string, params?: unknown[]): Promise<void> {
  if (isTauriEnv()) {
    const db = getDatabase() as TauriDatabaseType;
    await db.execute(sql, params as unknown[]);
  } else {
    const db = getDatabase() as SqlJsDatabase;
    db.run(sql, params as (string | number | null | Uint8Array)[]);
  }
}

/**
 * Get the number of rows affected by the last INSERT/UPDATE/DELETE.
 * Note: Tauri returns this from execute(), browser tracks via getRowsModified().
 */
export function getChanges(): number {
  if (isTauriEnv()) {
    // Tauri returns rowsAffected from execute() - caller should track this
    return 0;
  }
  const db = getDatabase() as SqlJsDatabase;
  return db.getRowsModified();
}
