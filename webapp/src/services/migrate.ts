/**
 * Data migration utility.
 * Imports CSV data into SQLite.
 */
import { persistDatabase, runSQL } from "@/db/sqlite";
import { runMigrations } from "@/db/schema";
import type { CategoryKind } from "@/types";

export interface MigrationResult {
  success: boolean;
  transactionsImported: number;
  categoriesImported: number;
  budgetsImported: number;
  warnings: string[];
  errors: string[];
}

interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse a CSV string into an array of row objects.
 */
function parseCSV(text: string): CSVParseResult {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);

  return result;
}

/**
 * Migrate transactions from CSV data.
 */
async function migrateTransactions(csv: CSVParseResult): Promise<{ count: number; warnings: string[] }> {
  const now = new Date().toISOString();
  const warnings: string[] = [];
  let count = 0;

  await runSQL("BEGIN TRANSACTION");
  try {
    for (const row of csv.rows) {
      const id = row.id || crypto.randomUUID();
      const date = row.date || "";
      const amountCents = parseInt(row.amount_cents || "0", 10);
      const categoryId = row.category_id || "";
      const merchant = row.merchant || null;
      const notes = row.notes || null;
      const createdAt = row.created_at || now;
      const updatedAt = row.updated_at || now;
      const deleted = row.deleted === "true" || row.deleted === "1" ? 1 : 0;

      if (!date) {
        warnings.push(`Skipping transaction ${id}: missing date`);
        continue;
      }

      await runSQL(
        `INSERT OR REPLACE INTO transactions 
         (id, date, amount_cents, category_id, merchant, notes, created_at, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, date, amountCents, categoryId, merchant, notes, createdAt, updatedAt, deleted]
      );
      count++;
    }
    await runSQL("COMMIT");
  } catch (err) {
    await runSQL("ROLLBACK");
    throw err;
  }

  return { count, warnings };
}

/**
 * Migrate categories from CSV data.
 */
async function migrateCategories(csv: CSVParseResult): Promise<{ count: number; warnings: string[] }> {
  const now = new Date().toISOString();
  const warnings: string[] = [];
  let count = 0;

  await runSQL("BEGIN TRANSACTION");
  try {
    for (const row of csv.rows) {
      const id = row.id || crypto.randomUUID();
      const name = row.name || "Unnamed";
      const kind = (row.kind || "expense") as CategoryKind;
      const parentId = row.parent_id || null;
      const active = row.active !== "false" && row.active !== "0" ? 1 : 0;
      const createdAt = row.created_at || now;
      const updatedAt = row.updated_at || now;

      if (!["expense", "income"].includes(kind)) {
        warnings.push(`Category ${id}: invalid kind "${kind}", defaulting to "expense"`);
      }

      await runSQL(
        `INSERT OR REPLACE INTO categories 
         (id, name, kind, parent_id, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, name, kind === "income" ? "income" : "expense", parentId, active, createdAt, updatedAt]
      );
      count++;
    }
    await runSQL("COMMIT");
  } catch (err) {
    await runSQL("ROLLBACK");
    throw err;
  }

  return { count, warnings };
}

/**
 * Migrate budgets from CSV data.
 */
async function migrateBudgets(csv: CSVParseResult): Promise<{ count: number; warnings: string[] }> {
  const warnings: string[] = [];
  let count = 0;

  await runSQL("BEGIN TRANSACTION");
  try {
    for (const row of csv.rows) {
      const month = row.month || "";
      const categoryId = row.category_id ?? "";
      const budgetCents = parseInt(row.budget_cents || "0", 10);

      if (!month) {
        warnings.push(`Skipping budget: missing month`);
        continue;
      }

      await runSQL(
        `INSERT OR REPLACE INTO budgets (month, category_id, budget_cents)
         VALUES (?, ?, ?)`,
        [month, categoryId, budgetCents]
      );
      count++;
    }
    await runSQL("COMMIT");
  } catch (err) {
    await runSQL("ROLLBACK");
    throw err;
  }

  return { count, warnings };
}

/**
 * Migrate all data from CSV files.
 * 
 * @param files Object containing the CSV file contents:
 *   - transactions: contents of transactions.csv
 *   - categories: contents of categories.csv  
 *   - budgets: contents of budgets.csv
 */
export async function migrateFromCSV(files: {
  transactions?: string;
  categories?: string;
  budgets?: string;
}): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    transactionsImported: 0,
    categoriesImported: 0,
    budgetsImported: 0,
    warnings: [],
    errors: [],
  };

  try {
    // Ensure schema is up to date
    await runMigrations();

    // Import categories first (transactions reference them)
    if (files.categories) {
      const csv = parseCSV(files.categories);
      const { count, warnings } = await migrateCategories(csv);
      result.categoriesImported = count;
      result.warnings.push(...warnings.map(w => `[categories] ${w}`));
    }

    // Import transactions
    if (files.transactions) {
      const csv = parseCSV(files.transactions);
      const { count, warnings } = await migrateTransactions(csv);
      result.transactionsImported = count;
      result.warnings.push(...warnings.map(w => `[transactions] ${w}`));
    }

    // Import budgets
    if (files.budgets) {
      const csv = parseCSV(files.budgets);
      const { count, warnings } = await migrateBudgets(csv);
      result.budgetsImported = count;
      result.warnings.push(...warnings.map(w => `[budgets] ${w}`));
    }

    // Persist to storage
    await persistDatabase();

    result.success = true;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}

/**
 * Import data from uploaded files.
 * Accepts File objects from a file input.
 */
export async function migrateFromFiles(files: {
  transactions?: File;
  categories?: File;
  budgets?: File;
}): Promise<MigrationResult> {
  const contents: {
    transactions?: string;
    categories?: string;
    budgets?: string;
  } = {};

  if (files.transactions) {
    contents.transactions = await files.transactions.text();
  }
  if (files.categories) {
    contents.categories = await files.categories.text();
  }
  if (files.budgets) {
    contents.budgets = await files.budgets.text();
  }

  return migrateFromCSV(contents);
}


