/**
 * Spreadsheet-style CSV import service.
 * Specifically handles the format found in sample.csv
 */
import { getCategories, bulkInsertCategories } from "@/db/categories";
import { getTransactions, bulkInsertTransactions } from "@/db/transactions";
import type { CategoryKind } from "@/types";

export interface SpreadsheetImportOptions {
    commit: boolean;
    skipDuplicates: boolean;
}

export interface SpreadsheetImportResult {
    filename: string;
    totalParsedRows: number;
    transactionsCreated: number;
    categoriesCreated: number;
    warnings: string[];
    errors: string[];
}

/**
 * Parse a CSV line handling quoted fields.
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
 * Parse amount string to cents.
 */
function parseAmountCents(val: string): number {
    const s = val.trim().replace(/[$,]/g, "");
    if (!s) return 0;
    const valNum = parseFloat(s);
    if (isNaN(valNum)) return 0;
    return Math.round(valNum * 100);
}

/**
 * Detect date format YYYY-MM-DD.
 */
function isValidDate(val: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}

interface IntermediateTx {
    date: string;
    category: string;
    kind: CategoryKind;
    merchant: string;
    amountCents: number;
    notes: string;
}

/**
 * Main import logic for the special spreadsheet format.
 */
export async function importSpreadsheetCSV(
    file: File,
    options: SpreadsheetImportOptions
): Promise<SpreadsheetImportResult> {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

    // Skip the first "comment" line if it looks like one
    // Row 2 is headers: ,Period,Income,Expense,Amount,Vendor,Notes,,,,,
    let startIdx = 0;
    if (lines[0].includes("Rent is for current month")) {
        startIdx = 1;
    }

    // Check headers at startIdx
    const headers = parseCSVLine(lines[startIdx]);
    if (!headers.includes("Amount") && !headers.includes("Vendor")) {
        // If headers aren't where we expect, maybe try one more?
        startIdx++;
    }

    const transactions: IntermediateTx[] = [];
    const warnings: string[] = [];

    let lastDate = "";
    let currentGroup: { primary: IntermediateTx; subs: IntermediateTx[] } | null = null;

    const flushGroup = () => {
        if (!currentGroup) return;
        if (currentGroup.subs.length > 0) {
            // If we have sub-items, we use those as the transactions
            // and ignore the primary's total amount (usually it's the sum)
            transactions.push(...currentGroup.subs);
        } else {
            // No sub-items, just the primary
            transactions.push(currentGroup.primary);
        }
        currentGroup = null;
    };

    for (let i = startIdx + 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length < 5) continue;

        const dateVal = row[0].trim();

        if (isValidDate(dateVal)) {
            // This is a primary row
            flushGroup();

            const categoryIncome = row[2].trim();
            const categoryExpense = row[3].trim();
            const amountRaw = row[4].trim();
            const vendor = row[5].trim();
            const notes = row[6].trim();

            const kind: CategoryKind = categoryIncome ? "income" : "expense";
            const category = categoryIncome || categoryExpense || "Uncategorized";
            const amountCents = parseAmountCents(amountRaw);

            lastDate = dateVal;
            currentGroup = {
                primary: {
                    date: dateVal,
                    category,
                    kind,
                    merchant: vendor,
                    amountCents: kind === "expense" ? -amountCents : amountCents,
                    notes
                },
                subs: []
            };
        } else if (lastDate && row[5] && row[6] && !isNaN(parseFloat(row[6].replace(/,/g, "")))) {
            // This looks like a sub-item row
            // Sub-row index 5 is category/merchant, 6 is amount, 7 is notes
            const subCatOrMerchant = row[5].trim();
            const subAmountRaw = row[6].trim();
            const subNotes = row[7]?.trim() || "";

            if (currentGroup) {
                const amountCents = parseAmountCents(subAmountRaw);
                currentGroup.subs.push({
                    date: lastDate,
                    category: subCatOrMerchant, // We'll treat this as category for now
                    kind: currentGroup.primary.kind,
                    merchant: currentGroup.primary.merchant, // Inherit vendor from primary
                    amountCents: currentGroup.primary.kind === "expense" ? -amountCents : amountCents,
                    notes: subNotes
                });
            }
        }
    }
    flushGroup();

    if (transactions.length === 0) {
        return {
            filename: file.name,
            totalParsedRows: 0,
            transactionsCreated: 0,
            categoriesCreated: 0,
            warnings: ["No transactions found in file."],
            errors: []
        };
    }

    // Database part
    const existingCategories = await getCategories();
    const existingTransactions = await getTransactions({ includeDeleted: false });

    // Build map for existing categories
    const categoryMap = new Map<string, string>(); // `${kind}:${name.toLowerCase()}` -> id
    for (const c of existingCategories) {
        categoryMap.set(`${c.kind}:${c.name.toLowerCase()}`, c.id);
    }

    // Build set for duplicate checking
    const existingTxKeys = new Set<string>();
    if (options.skipDuplicates) {
        for (const tx of existingTransactions) {
            const key = `${tx.date}|${tx.amountCents}|${tx.categoryId}|${tx.merchant || ""}|${tx.notes || ""}`;
            existingTxKeys.add(key.toLowerCase());
        }
    }

    const categoriesToCreate: any[] = [];
    const finalTransactions: any[] = [];
    let skippedCount = 0;

    for (const tx of transactions) {
        const key = `${tx.kind}:${tx.category.toLowerCase()}`;
        let catId = categoryMap.get(key);

        if (!catId) {
            catId = crypto.randomUUID();
            const newCat = {
                id: catId,
                name: tx.category,
                kind: tx.kind,
                parentId: null,
                active: true
            };
            categoriesToCreate.push(newCat);
            categoryMap.set(key, catId);
        }

        // Check for duplicates
        const txKey = `${tx.date}|${tx.amountCents}|${catId}|${tx.merchant || ""}|${tx.notes || ""}`.toLowerCase();
        if (options.skipDuplicates && existingTxKeys.has(txKey)) {
            skippedCount++;
            continue;
        }

        finalTransactions.push({
            date: tx.date,
            amountCents: tx.amountCents,
            categoryId: catId,
            merchant: tx.merchant || undefined,
            notes: tx.notes || undefined
        });
    }

    if (options.commit) {
        if (categoriesToCreate.length > 0) {
            await bulkInsertCategories(categoriesToCreate);
        }
        if (finalTransactions.length > 0) {
            await bulkInsertTransactions(finalTransactions);
        }
    }

    return {
        filename: file.name,
        totalParsedRows: transactions.length,
        transactionsCreated: finalTransactions.length,
        categoriesCreated: categoriesToCreate.length,
        warnings: skippedCount > 0 ? [`Skipped ${skippedCount} duplicate transaction(s).`] : warnings,
        errors: []
    };
}
