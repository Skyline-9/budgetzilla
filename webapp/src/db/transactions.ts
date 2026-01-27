/**
 * Transaction database operations.
 */
import { persistDatabase, runSQL, execSQL, isTauri } from "./sqlite";
import type { Transaction, TransactionCreate, TransactionUpdate } from "@/types";

type TransactionRow = [
  string,  // id
  string,  // date
  number,  // amount_cents
  string,  // category_id
  string | null,  // merchant
  string | null,  // notes
  string,  // created_at
  string,  // updated_at
  number   // deleted
];

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row[0],
    date: row[1],
    amountCents: row[2],
    categoryId: row[3],
    merchant: row[4] ?? undefined,
    notes: row[5] ?? undefined,
    createdAt: row[6],
    updatedAt: row[7],
  };
}

export type GetTransactionsParams = {
  from?: string;
  to?: string;
  q?: string;
  categoryId?: string[];
  minAmountCents?: number;
  maxAmountCents?: number;
  includeDeleted?: boolean;
};

/**
 * Get transactions with optional filters.
 */
export async function getTransactions(params: GetTransactionsParams = {}): Promise<Transaction[]> {
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  // Exclude deleted by default
  if (!params.includeDeleted) {
    conditions.push("deleted = 0");
  }

  // Date range
  if (params.from) {
    conditions.push("date >= ?");
    values.push(params.from);
  }
  if (params.to) {
    conditions.push("date <= ?");
    values.push(params.to);
  }

  // Search query (merchant or notes)
  if (params.q) {
    conditions.push("(merchant LIKE ? OR notes LIKE ?)");
    const pattern = `%${params.q}%`;
    values.push(pattern, pattern);
  }

  // Category filter (multi-select)
  if (params.categoryId && params.categoryId.length > 0) {
    const placeholders = params.categoryId.map(() => "?").join(", ");
    conditions.push(`category_id IN (${placeholders})`);
    values.push(...params.categoryId);
  }

  // Amount range
  if (params.minAmountCents !== undefined) {
    conditions.push("amount_cents >= ?");
    values.push(params.minAmountCents);
  }
  if (params.maxAmountCents !== undefined) {
    conditions.push("amount_cents <= ?");
    values.push(params.maxAmountCents);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `
    SELECT id, date, amount_cents, category_id, merchant, notes, created_at, updated_at, deleted
    FROM transactions
    ${whereClause}
    ORDER BY date DESC, created_at DESC
  `;

  const rows = await execSQL(sql, values) as TransactionRow[];
  return rows.map(rowToTransaction);
}

/**
 * Get a single transaction by ID.
 */
export async function getTransaction(id: string): Promise<Transaction | null> {
  const rows = await execSQL(
    `SELECT id, date, amount_cents, category_id, merchant, notes, created_at, updated_at, deleted
     FROM transactions WHERE id = ?`,
    [id]
  ) as TransactionRow[];

  if (rows.length === 0) return null;
  return rowToTransaction(rows[0]);
}

/**
 * Create a new transaction.
 */
export async function createTransaction(data: TransactionCreate): Promise<Transaction> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await runSQL(
    `INSERT INTO transactions (id, date, amount_cents, category_id, merchant, notes, created_at, updated_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, data.date, data.amountCents, data.categoryId, data.merchant ?? null, data.notes ?? null, now, now]
  );

  await persistDatabase();

  return {
    id,
    date: data.date,
    amountCents: data.amountCents,
    categoryId: data.categoryId,
    merchant: data.merchant,
    notes: data.notes,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update an existing transaction.
 */
export async function updateTransaction(id: string, data: TransactionUpdate): Promise<Transaction> {
  const existing = await getTransaction(id);
  if (!existing) {
    throw new Error(`Transaction not found: ${id}`);
  }

  const now = new Date().toISOString();
  const updates: string[] = ["updated_at = ?"];
  const values: (string | number | null)[] = [now];

  if (data.date !== undefined) {
    updates.push("date = ?");
    values.push(data.date);
  }
  if (data.amountCents !== undefined) {
    updates.push("amount_cents = ?");
    values.push(data.amountCents);
  }
  if (data.categoryId !== undefined) {
    updates.push("category_id = ?");
    values.push(data.categoryId);
  }
  if (data.merchant !== undefined) {
    updates.push("merchant = ?");
    values.push(data.merchant ?? null);
  }
  if (data.notes !== undefined) {
    updates.push("notes = ?");
    values.push(data.notes ?? null);
  }

  values.push(id);
  await runSQL(`UPDATE transactions SET ${updates.join(", ")} WHERE id = ?`, values);

  await persistDatabase();

  return (await getTransaction(id))!;
}

/**
 * Soft-delete a transaction.
 */
export async function deleteTransaction(id: string): Promise<void> {
  const now = new Date().toISOString();
  await runSQL(
    "UPDATE transactions SET deleted = 1, updated_at = ? WHERE id = ?",
    [now, id]
  );
  await persistDatabase();
}

/**
 * Permanently delete a transaction (for data cleanup).
 */
export async function hardDeleteTransaction(id: string): Promise<void> {
  await runSQL("DELETE FROM transactions WHERE id = ?", [id]);
  await persistDatabase();
}

/**
 * Bulk insert transactions (for import/migration).
 */
export async function bulkInsertTransactions(transactions: (TransactionCreate & { id?: string })[]): Promise<number> {
  const now = new Date().toISOString();

  await runSQL("BEGIN TRANSACTION");
  try {
    for (const t of transactions) {
      const id = t.id ?? crypto.randomUUID();
      await runSQL(
        `INSERT OR REPLACE INTO transactions (id, date, amount_cents, category_id, merchant, notes, created_at, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, t.date, t.amountCents, t.categoryId, t.merchant ?? null, t.notes ?? null, now, now]
      );
    }
    await runSQL("COMMIT");
    await persistDatabase();
    return transactions.length;
  } catch (err) {
    await runSQL("ROLLBACK");
    throw err;
  }
}

/**
 * Reassign transactions from one category to another.
 */
export async function reassignTransactions(fromCategoryId: string, toCategoryId: string): Promise<number> {
  const now = new Date().toISOString();
  
  // Get count before update for return value
  const countResult = await execSQL(
    "SELECT COUNT(*) FROM transactions WHERE category_id = ?",
    [fromCategoryId]
  );
  const count = (countResult[0]?.[0] as number) ?? 0;
  
  await runSQL(
    "UPDATE transactions SET category_id = ?, updated_at = ? WHERE category_id = ?",
    [toCategoryId, now, fromCategoryId]
  );
  await persistDatabase();
  return count;
}
