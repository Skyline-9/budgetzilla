/**
 * Cashew CSV import service.
 */
import { getDatabase, persistDatabase } from "@/db/sqlite";
import { getCategories, bulkInsertCategories } from "@/db/categories";
import { getTransactions, bulkInsertTransactions } from "@/db/transactions";
import type { CategoryKind } from "@/types";

export interface ImportOptions {
  commit: boolean;
  skipDuplicates: boolean;
  preserveExtras: boolean;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  filename: string;
  commit: boolean;
  skipDuplicates: boolean;
  preserveExtras: boolean;
  totalRows: number;
  parsedRows: number;
  invalidRows: number;
  categoriesCreated: number;
  transactionsCreated: number;
  transactionsSkipped: number;
  columnMapping: Record<string, string>;
  warnings: string[];
  errors: ImportRowError[];
}

/**
 * Parse a CSV string into an array of row objects.
 */
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Parse rows
  const rows: Array<Record<string, string>> = [];
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

  return rows;
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
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted field
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
 * Normalize a header name for matching.
 */
function normalizeHeader(name: string): string {
  return (name || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Normalize a name for grouping.
 */
function normalizeName(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Build column mapping from CSV headers to known Cashew columns.
 */
function resolveColumns(headers: string[]): Record<string, string | null> {
  const colMap: Record<string, string> = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (norm && !colMap[norm]) {
      colMap[norm] = h;
    }
  }

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      if (colMap[k]) return colMap[k];
    }
    return null;
  };

  return {
    account: pick("account"),
    amount: pick("amount"),
    currency: pick("currency"),
    title: pick("title"),
    note: pick("note", "notes"),
    date: pick("date", "notedate"),
    income: pick("income"),
    type: pick("type"),
    category_name: pick("categoryname", "category"),
    subcategory_name: pick("subcategoryname", "subcategory"),
    color: pick("color"),
    icon: pick("icon"),
    emoji: pick("emoji"),
    budget: pick("budget"),
    objective: pick("objective"),
  };
}

/**
 * Parse a boolean value.
 */
function parseBool(val: string): boolean {
  return ["true", "1", "yes", "y", "t"].includes(val.trim().toLowerCase());
}

/**
 * Parse a date string and return YYYY-MM-DD format.
 */
function parseDate(val: string): string {
  const s = val.trim();
  if (!s) throw new Error("date is empty");

  // Try common formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,                    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/,  // YYYY-MM-DD HH:MM
    /^(\d{4})\/(\d{2})\/(\d{2})$/,                  // YYYY/MM/DD
  ];

  for (const fmt of formats) {
    const match = s.match(fmt);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  // Try ISO parse
  try {
    const date = new Date(s);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  } catch {
    // Ignore
  }

  throw new Error(`Unrecognized date format: ${s}`);
}

/**
 * Parse an amount string and return cents.
 */
function parseAmountCents(val: string, incomeFlag: boolean | null): number {
  let s = val.trim();
  if (!s) throw new Error("amount is empty");

  let explicitNegative = false;
  let explicitPositive = false;

  // Handle parentheses for negative
  if (s.startsWith("(") && s.endsWith(")")) {
    explicitNegative = true;
    s = s.slice(1, -1).trim();
  }

  if (s.startsWith("-")) {
    explicitNegative = true;
    s = s.slice(1).trim();
  } else if (s.startsWith("+")) {
    explicitPositive = true;
    s = s.slice(1).trim();
  }

  // Remove non-numeric characters except . and ,
  let cleaned = s.replace(/[^0-9.,]/g, "");
  if (!cleaned) throw new Error(`amount is not numeric: ${val}`);

  // Normalize decimal separator
  let num: string;
  if (cleaned.includes(".") && cleaned.includes(",")) {
    // Assume comma is thousands separator: 1,234.56
    num = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length === 2) {
      // Assume comma is decimal: 123,45
      num = parts[0] + "." + parts[1];
    } else {
      // Assume commas are thousands separators
      num = parts.join("");
    }
  } else {
    num = cleaned.replace(/,/g, "");
  }

  const value = parseFloat(num);
  if (isNaN(value)) throw new Error(`amount is not numeric: ${val}`);

  const centsAbs = Math.round(value * 100);

  if (explicitNegative) return -centsAbs;
  if (explicitPositive) return centsAbs;
  if (incomeFlag === true) return centsAbs;
  if (incomeFlag === false) return -centsAbs;
  return centsAbs;
}

/**
 * Determine kind from cents and income flag.
 */
function kindFromCents(cents: number, incomeFlag: boolean | null): CategoryKind {
  if (cents > 0) return "income";
  if (cents < 0) return "expense";
  return incomeFlag ? "income" : "expense";
}

/**
 * Import a Cashew CSV file.
 */
export async function importCashewCSV(
  file: File,
  options: ImportOptions
): Promise<ImportResult> {
  const text = await file.text();
  return importCashewCSVText(text, file.name, options);
}

/**
 * Import Cashew CSV from text content.
 */
export async function importCashewCSVText(
  text: string,
  filename: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { commit, skipDuplicates, preserveExtras } = options;
  const warnings: string[] = [];
  const errors: ImportRowError[] = [];

  const rows = parseCSV(text);
  if (rows.length === 0) {
    return {
      filename,
      commit,
      skipDuplicates,
      preserveExtras,
      totalRows: 0,
      parsedRows: 0,
      invalidRows: 0,
      categoriesCreated: 0,
      transactionsCreated: 0,
      transactionsSkipped: 0,
      columnMapping: {},
      warnings: ["CSV contained only headers (no rows)."],
      errors: [],
    };
  }

  // Resolve columns
  const headers = Object.keys(rows[0]);
  const cols = resolveColumns(headers);

  if (!cols.amount || !cols.date) {
    throw new Error(`Missing required columns: amount and date. Found: ${headers.join(", ")}`);
  }

  const now = new Date().toISOString();
  const maxErrors = 50;

  // Parse all rows
  interface ParsedTx {
    rowNum: number;
    date: string;
    amountCents: number;
    kind: CategoryKind;
    merchant: string;
    notes: string;
    pathKey: [string, string]; // [normalized category, normalized subcategory]
    extras: Record<string, string>;
  }

  const parsed: ParsedTx[] = [];
  const stats: Record<string, { incomeCount: number; expenseCount: number; incomeTotal: number; expenseTotal: number }> = {};
  const display: Record<string, { category: string; subcategory: string | null }> = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, header is row 1

    try {
      const amountRaw = row[cols.amount!] || "";
      const dateRaw = row[cols.date!] || "";

      if (!amountRaw.trim()) throw new Error("amount is empty");
      if (!dateRaw.trim()) throw new Error("date is empty");

      const incomeRaw = cols.income ? (row[cols.income] || "") : "";
      const incomeFlag = cols.income ? parseBool(incomeRaw) : null;

      const cents = parseAmountCents(amountRaw, incomeFlag);
      const dateStr = parseDate(dateRaw);

      const merchant = cols.title ? (row[cols.title] || "").trim() : "";
      const notes = cols.note ? (row[cols.note] || "").trim() : "";

      let cat = cols.category_name ? (row[cols.category_name] || "").trim() : "";
      let sub = cols.subcategory_name ? (row[cols.subcategory_name] || "").trim() : "";

      // Promote subcategory if no category
      if (!cat && sub) {
        cat = sub;
        sub = "";
      }
      if (!cat) cat = "Uncategorized";

      const kind = kindFromCents(cents, incomeFlag);
      const ncat = normalizeName(cat);
      const nsub = normalizeName(sub);
      const pkey: [string, string] = [ncat, nsub];
      const pkeyStr = `${ncat}|||${nsub}`;

      if (!display[pkeyStr]) {
        display[pkeyStr] = { category: cat, subcategory: sub || null };
      }

      if (!stats[pkeyStr]) {
        stats[pkeyStr] = { incomeCount: 0, expenseCount: 0, incomeTotal: 0, expenseTotal: 0 };
      }

      if (kind === "income") {
        stats[pkeyStr].incomeCount++;
        stats[pkeyStr].incomeTotal += Math.max(cents, 0);
      } else {
        stats[pkeyStr].expenseCount++;
        stats[pkeyStr].expenseTotal += Math.max(-cents, 0);
      }

      const extras: Record<string, string> = {};
      if (preserveExtras) {
        for (const [key, col] of Object.entries(cols)) {
          if (col && row[col]) {
            extras[`cashew_${key}`] = row[col];
          }
        }
      }

      parsed.push({
        rowNum,
        date: dateStr,
        amountCents: cents,
        kind,
        merchant,
        notes,
        pathKey: pkey,
        extras,
      });
    } catch (e) {
      if (errors.length < maxErrors) {
        errors.push({ row: rowNum, message: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const invalidRows = rows.length - parsed.length;
  if (invalidRows > 0) {
    warnings.push(`Skipped ${invalidRows} invalid row(s).`);
  }

  if (parsed.length === 0) {
    return {
      filename,
      commit,
      skipDuplicates,
      preserveExtras,
      totalRows: rows.length,
      parsedRows: 0,
      invalidRows: rows.length,
      categoriesCreated: 0,
      transactionsCreated: 0,
      transactionsSkipped: 0,
      columnMapping: Object.fromEntries(
        Object.entries(cols).filter((entry): entry is [string, string] => entry[1] !== null)
      ),
      warnings,
      errors,
    };
  }

  // Load existing categories and transactions
  const existingCategories = await getCategories();
  const existingTx = await getTransactions({ includeDeleted: false });

  // Build maps for existing data
  const existingRootMap: Map<string, string> = new Map(); // `${kind}:${normalizedName}` -> id
  const existingChildMap: Map<string, string> = new Map(); // `${kind}:${parentId}:${normalizedName}` -> id

  for (const cat of existingCategories) {
    const n = normalizeName(cat.name);
    if (!cat.parentId) {
      existingRootMap.set(`${cat.kind}:${n}`, cat.id);
    } else {
      existingChildMap.set(`${cat.kind}:${cat.parentId}:${n}`, cat.id);
    }
  }

  // Build duplicate check set
  const existingTxKeys: Set<string> = new Set();
  if (skipDuplicates) {
    for (const tx of existingTx) {
      const key = `${tx.date}|${tx.amountCents}|${tx.categoryId}|${tx.merchant || ""}|${tx.notes || ""}`;
      existingTxKeys.add(key);
    }
  }

  // Create categories as needed
  const createdCategories: Array<{ id: string; name: string; kind: CategoryKind; parentId: string | null; active: boolean }> = [];
  const createdRootMap: Map<string, string> = new Map();
  const createdChildMap: Map<string, string> = new Map();
  const leafIdByPathKind: Map<string, string> = new Map(); // `${pathKey}:${kind}` -> id

  for (const [pkeyStr, st] of Object.entries(stats)) {
    const inc = st.incomeCount;
    const exp = st.expenseCount;
    if (inc <= 0 && exp <= 0) continue;

    const kindsNeeded: CategoryKind[] = [];
    if (exp > 0) kindsNeeded.push("expense");
    if (inc > 0) kindsNeeded.push("income");

    const disp = display[pkeyStr] || { category: "Uncategorized", subcategory: null };
    const baseParent = disp.category || "Uncategorized";
    const baseChild = disp.subcategory;

    const mixed = inc > 0 && exp > 0;
    let majority: CategoryKind | null = null;
    if (mixed) {
      if (inc !== exp) {
        majority = inc > exp ? "income" : "expense";
      } else if (st.incomeTotal !== st.expenseTotal) {
        majority = st.incomeTotal > st.expenseTotal ? "income" : "expense";
      } else {
        majority = "expense";
      }
    }

    for (const kind of kindsNeeded) {
      let parentName = baseParent;
      if (mixed && majority && kind !== majority) {
        const suffix = kind === "income" ? "Income" : "Expense";
        if (!parentName.endsWith(` (${suffix})`)) {
          parentName = `${parentName} (${suffix})`;
        }
      }

      // Get or create parent category
      const parentNorm = normalizeName(parentName);
      const parentKey = `${kind}:${parentNorm}`;
      let parentId = existingRootMap.get(parentKey) || createdRootMap.get(parentKey);

      if (!parentId) {
        parentId = crypto.randomUUID();
        createdRootMap.set(parentKey, parentId);
        createdCategories.push({
          id: parentId,
          name: parentName.slice(0, 200),
          kind,
          parentId: null,
          active: true,
        });
      }

      let leafId = parentId;

      // Get or create child category if needed
      if (baseChild) {
        const childNorm = normalizeName(baseChild);
        const childKey = `${kind}:${parentId}:${childNorm}`;
        let childId = existingChildMap.get(childKey) || createdChildMap.get(childKey);

        if (!childId) {
          childId = crypto.randomUUID();
          createdChildMap.set(childKey, childId);
          createdCategories.push({
            id: childId,
            name: baseChild.slice(0, 200),
            kind,
            parentId,
            active: true,
          });
        }
        leafId = childId;
      }

      leafIdByPathKind.set(`${pkeyStr}:${kind}`, leafId);
    }
  }

  // Create transactions
  const newTransactions: Array<{
    id?: string;
    date: string;
    amountCents: number;
    categoryId: string;
    merchant?: string;
    notes?: string;
  }> = [];
  const newTxKeys: Set<string> = new Set();
  let skipped = 0;

  for (const tx of parsed) {
    const pkeyStr = `${tx.pathKey[0]}|||${tx.pathKey[1]}`;
    let leafId = leafIdByPathKind.get(`${pkeyStr}:${tx.kind}`);

    if (!leafId) {
      // Fallback to Uncategorized
      const fallbackKey = `${tx.kind}:${normalizeName("Uncategorized")}`;
      leafId = existingRootMap.get(fallbackKey) || createdRootMap.get(fallbackKey);
      if (!leafId) {
        leafId = crypto.randomUUID();
        createdRootMap.set(fallbackKey, leafId);
        createdCategories.push({
          id: leafId,
          name: "Uncategorized",
          kind: tx.kind,
          parentId: null,
          active: true,
        });
      }
    }

    const txKey = `${tx.date}|${tx.amountCents}|${leafId}|${tx.merchant}|${tx.notes}`;
    
    if (skipDuplicates && (existingTxKeys.has(txKey) || newTxKeys.has(txKey))) {
      skipped++;
      continue;
    }

    newTxKeys.add(txKey);
    newTransactions.push({
      date: tx.date,
      amountCents: tx.amountCents,
      categoryId: leafId,
      merchant: tx.merchant || undefined,
      notes: tx.notes || undefined,
    });
  }

  if (skipDuplicates && skipped > 0) {
    warnings.push(`Skipped ${skipped} duplicate transaction(s).`);
  }

  // Commit to database
  if (commit) {
    if (createdCategories.length > 0) {
      await bulkInsertCategories(createdCategories);
    }
    if (newTransactions.length > 0) {
      await bulkInsertTransactions(newTransactions);
    }
  }

  return {
    filename,
    commit,
    skipDuplicates,
    preserveExtras,
    totalRows: rows.length,
    parsedRows: parsed.length,
    invalidRows,
    categoriesCreated: createdCategories.length,
    transactionsCreated: newTransactions.length,
    transactionsSkipped: skipped,
    columnMapping: Object.fromEntries(
      Object.entries(cols).filter((entry): entry is [string, string] => entry[1] !== null)
    ),
    warnings,
    errors,
  };
}
