/**
 * Excel (XLSX) import service.
 */
import * as XLSX from "xlsx";
import { bulkInsertCategories } from "@/db/categories";
import { bulkInsertTransactions } from "@/db/transactions";
import { bulkInsertBudgets } from "@/db/budgets";
import type { CategoryCreate, CategoryKind, TransactionCreate, Budget } from "@/types";

export interface ImportXLSXResult {
    categoriesImported: number;
    transactionsImported: number;
    budgetsImported: number;
    errors: string[];
}

/**
 * Import data from an Excel file.
 */
export async function importXLSX(file: File): Promise<ImportXLSXResult> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    const result: ImportXLSXResult = {
        categoriesImported: 0,
        transactionsImported: 0,
        budgetsImported: 0,
        errors: [],
    };

    // 1. Import Categories
    const categoriesSheet = workbook.Sheets["Categories"];
    if (categoriesSheet) {
        const categoriesRows = XLSX.utils.sheet_to_json<any>(categoriesSheet);
        const categoriesToInsert: (CategoryCreate & { id?: string })[] = categoriesRows.map(row => ({
            id: row.id,
            name: row.name,
            kind: row.kind as CategoryKind,
            parentId: row.parent_id || null,
            active: row.active === 1 || row.active === true,
        }));

        if (categoriesToInsert.length > 0) {
            result.categoriesImported = await bulkInsertCategories(categoriesToInsert);
        }
    } else {
        result.errors.push("Missing 'Categories' sheet.");
    }

    // 2. Import Transactions
    const transactionsSheet = workbook.Sheets["Transactions"];
    if (transactionsSheet) {
        const transactionsRows = XLSX.utils.sheet_to_json<any>(transactionsSheet);
        const transactionsToInsert: (TransactionCreate & { id?: string })[] = transactionsRows.map(row => ({
            id: row.id,
            date: String(row.date), // Ensure date is string
            amountCents: Number(row.amount_cents),
            categoryId: row.category_id,
            merchant: row.merchant || undefined,
            notes: row.notes || undefined,
        }));

        if (transactionsToInsert.length > 0) {
            result.transactionsImported = await bulkInsertTransactions(transactionsToInsert);
        }
    } else {
        result.errors.push("Missing 'Transactions' sheet.");
    }

    // 3. Import Budgets
    const budgetsSheet = workbook.Sheets["Budgets"];
    if (budgetsSheet) {
        const budgetsRows = XLSX.utils.sheet_to_json<any>(budgetsSheet);
        const budgetsToInsert: Budget[] = budgetsRows.map(row => ({
            month: String(row.month),
            categoryId: String(row.category_id ?? ""),
            budgetCents: Number(row.budget_cents),
        }));

        if (budgetsToInsert.length > 0) {
            result.budgetsImported = await bulkInsertBudgets(budgetsToInsert);
        }
    } else {
        result.errors.push("Missing 'Budgets' sheet.");
    }

    return result;
}
