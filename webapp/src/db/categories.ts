/**
 * Category database operations.
 */
import { persistDatabase, runSQL, execSQL } from "./sqlite";
import type { Category, CategoryCreate, CategoryUpdate, CategoryKind } from "@/types";
import { reassignTransactions } from "./transactions";
import { reassignBudgets } from "./budgets";

type CategoryRow = [
  string,       // id
  string,       // name
  string,       // kind
  string | null, // parent_id
  number,       // active
  string,       // created_at
  string        // updated_at
];

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row[0],
    name: row[1],
    kind: row[2] as CategoryKind,
    parentId: row[3],
    active: row[4] === 1,
  };
}

/**
 * Get all categories.
 */
export async function getCategories(): Promise<Category[]> {
  const rows = await execSQL(
    `SELECT id, name, kind, parent_id, active, created_at, updated_at
     FROM categories
     ORDER BY name`
  ) as CategoryRow[];

  return rows.map(rowToCategory);
}

/**
 * Get a single category by ID.
 */
export async function getCategory(id: string): Promise<Category | null> {
  const rows = await execSQL(
    `SELECT id, name, kind, parent_id, active, created_at, updated_at
     FROM categories WHERE id = ?`,
    [id]
  ) as CategoryRow[];

  if (rows.length === 0) return null;
  return rowToCategory(rows[0]);
}

/**
 * Check if a category exists.
 */
export async function categoryExists(id: string): Promise<boolean> {
  const rows = await execSQL("SELECT 1 FROM categories WHERE id = ?", [id]);
  return rows.length > 0;
}

/**
 * Create a new category.
 */
export async function createCategory(data: CategoryCreate): Promise<Category> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await runSQL(
    `INSERT INTO categories (id, name, kind, parent_id, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.kind, data.parentId ?? null, data.active ? 1 : 0, now, now]
  );

  await persistDatabase();

  return {
    id,
    name: data.name,
    kind: data.kind,
    parentId: data.parentId,
    active: data.active,
  };
}

/**
 * Update an existing category.
 */
export async function updateCategory(id: string, data: CategoryUpdate): Promise<Category> {
  const existing = await getCategory(id);
  if (!existing) {
    throw new Error(`Category not found: ${id}`);
  }

  const now = new Date().toISOString();
  const updates: string[] = ["updated_at = ?"];
  const values: (string | number | null)[] = [now];

  if (data.name !== undefined) {
    updates.push("name = ?");
    values.push(data.name);
  }
  if (data.kind !== undefined) {
    updates.push("kind = ?");
    values.push(data.kind);
  }
  if (data.parentId !== undefined) {
    updates.push("parent_id = ?");
    values.push(data.parentId ?? null);
  }
  if (data.active !== undefined) {
    updates.push("active = ?");
    values.push(data.active ? 1 : 0);
  }

  values.push(id);
  await runSQL(`UPDATE categories SET ${updates.join(", ")} WHERE id = ?`, values);

  await persistDatabase();

  return (await getCategory(id))!;
}

/**
 * Delete a category and reassign its transactions/budgets.
 */
export async function deleteCategory(id: string, reassignToId: string): Promise<void> {
  const existing = await getCategory(id);
  if (!existing) {
    throw new Error(`Category not found: ${id}`);
  }

  // Verify the target category exists
  if (reassignToId !== id) {
    const target = await getCategory(reassignToId);
    if (!target) {
      throw new Error(`Target category not found: ${reassignToId}`);
    }
  }

  // Reassign transactions and budgets
  await reassignTransactions(id, reassignToId);
  await reassignBudgets(id, reassignToId);

  // Clear parent references for child categories
  const now = new Date().toISOString();
  await runSQL(
    "UPDATE categories SET parent_id = NULL, updated_at = ? WHERE parent_id = ?",
    [now, id]
  );

  // Delete the category
  await runSQL("DELETE FROM categories WHERE id = ?", [id]);

  await persistDatabase();
}

/**
 * Get child categories of a parent.
 */
export async function getChildCategories(parentId: string): Promise<Category[]> {
  const rows = await execSQL(
    `SELECT id, name, kind, parent_id, active, created_at, updated_at
     FROM categories WHERE parent_id = ?`,
    [parentId]
  ) as CategoryRow[];

  return rows.map(rowToCategory);
}

/**
 * Bulk insert categories (for import/migration).
 */
export async function bulkInsertCategories(categories: (CategoryCreate & { id?: string })[]): Promise<number> {
  const now = new Date().toISOString();

  await runSQL("BEGIN TRANSACTION");
  try {
    for (const c of categories) {
      const id = c.id ?? crypto.randomUUID();
      await runSQL(
        `INSERT OR REPLACE INTO categories (id, name, kind, parent_id, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, c.name, c.kind, c.parentId ?? null, c.active ? 1 : 0, now, now]
      );
    }
    await runSQL("COMMIT");
    await persistDatabase();
    return categories.length;
  } catch (err) {
    await runSQL("ROLLBACK");
    throw err;
  }
}
