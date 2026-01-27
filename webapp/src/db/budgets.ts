/**
 * Budget database operations.
 */
import { persistDatabase, runSQL, execSQL } from "./sqlite";
import type { Budget } from "@/types";

type BudgetRow = [
  string,  // month
  string,  // category_id
  number   // budget_cents
];

function rowToBudget(row: BudgetRow): Budget {
  return {
    month: row[0],
    categoryId: row[1],
    budgetCents: row[2],
  };
}

// Empty string category_id is reserved for overall monthly budget
const OVERALL_BUDGET_CATEGORY = "";

/**
 * Get the overall budget for a month.
 */
export async function getOverallBudget(month: string): Promise<Budget | null> {
  const rows = await execSQL(
    `SELECT month, category_id, budget_cents FROM budgets
     WHERE month = ? AND category_id = ?`,
    [month, OVERALL_BUDGET_CATEGORY]
  ) as BudgetRow[];

  if (rows.length === 0) return null;
  return rowToBudget(rows[0]);
}

/**
 * Create or update the overall budget for a month.
 */
export async function upsertOverallBudget(month: string, budgetCents: number): Promise<Budget> {
  await runSQL(
    `INSERT OR REPLACE INTO budgets (month, category_id, budget_cents)
     VALUES (?, ?, ?)`,
    [month, OVERALL_BUDGET_CATEGORY, budgetCents]
  );

  await persistDatabase();

  return {
    month,
    categoryId: OVERALL_BUDGET_CATEGORY,
    budgetCents,
  };
}

/**
 * Delete the overall budget for a month.
 */
export async function deleteOverallBudget(month: string): Promise<void> {
  await runSQL(
    "DELETE FROM budgets WHERE month = ? AND category_id = ?",
    [month, OVERALL_BUDGET_CATEGORY]
  );
  await persistDatabase();
}

/**
 * Get all budgets for a month (including per-category budgets if any).
 */
export async function getBudgetsForMonth(month: string): Promise<Budget[]> {
  const rows = await execSQL(
    `SELECT month, category_id, budget_cents FROM budgets WHERE month = ?`,
    [month]
  ) as BudgetRow[];

  return rows.map(rowToBudget);
}

/**
 * Get budget for a specific category in a month.
 */
export async function getCategoryBudget(month: string, categoryId: string): Promise<Budget | null> {
  const rows = await execSQL(
    `SELECT month, category_id, budget_cents FROM budgets
     WHERE month = ? AND category_id = ?`,
    [month, categoryId]
  ) as BudgetRow[];

  if (rows.length === 0) return null;
  return rowToBudget(rows[0]);
}

/**
 * Create or update a budget for a specific category.
 */
export async function upsertCategoryBudget(month: string, categoryId: string, budgetCents: number): Promise<Budget> {
  await runSQL(
    `INSERT OR REPLACE INTO budgets (month, category_id, budget_cents)
     VALUES (?, ?, ?)`,
    [month, categoryId, budgetCents]
  );

  await persistDatabase();

  return {
    month,
    categoryId,
    budgetCents,
  };
}

/**
 * Delete budget for a specific category.
 */
export async function deleteCategoryBudget(month: string, categoryId: string): Promise<void> {
  await runSQL(
    "DELETE FROM budgets WHERE month = ? AND category_id = ?",
    [month, categoryId]
  );
  await persistDatabase();
}

/**
 * Reassign budgets from one category to another.
 */
export async function reassignBudgets(fromCategoryId: string, toCategoryId: string): Promise<number> {
  // For budgets, we need to handle potential conflicts (same month, different categories)
  // Strategy: Keep the target category's budget if it exists, delete the source
  
  // Get all budgets for the source category
  const sourceBudgets = await execSQL(
    "SELECT month, budget_cents FROM budgets WHERE category_id = ?",
    [fromCategoryId]
  ) as [string, number][];

  let count = 0;
  for (const [month, budgetCents] of sourceBudgets) {
    // Check if target already has a budget for this month
    const existing = await getCategoryBudget(month, toCategoryId);
    if (!existing) {
      // Move the budget
      await runSQL(
        "UPDATE budgets SET category_id = ? WHERE month = ? AND category_id = ?",
        [toCategoryId, month, fromCategoryId]
      );
      count++;
    } else {
      // Target already has budget, just delete source (or merge - add amounts)
      // For now, we merge by adding the amounts
      await runSQL(
        "UPDATE budgets SET budget_cents = ? WHERE month = ? AND category_id = ?",
        [existing.budgetCents + budgetCents, month, toCategoryId]
      );
      await runSQL(
        "DELETE FROM budgets WHERE month = ? AND category_id = ?",
        [month, fromCategoryId]
      );
      count++;
    }
  }

  if (count > 0) {
    await persistDatabase();
  }

  return count;
}

/**
 * Bulk insert budgets (for import/migration).
 */
export async function bulkInsertBudgets(budgets: Budget[]): Promise<number> {
  await runSQL("BEGIN TRANSACTION");
  try {
    for (const b of budgets) {
      await runSQL(
        `INSERT OR REPLACE INTO budgets (month, category_id, budget_cents)
         VALUES (?, ?, ?)`,
        [b.month, b.categoryId, b.budgetCents]
      );
    }
    await runSQL("COMMIT");
    await persistDatabase();
    return budgets.length;
  } catch (err) {
    await runSQL("ROLLBACK");
    throw err;
  }
}
