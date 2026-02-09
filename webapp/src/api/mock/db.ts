import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import type { Budget, Category, Transaction } from "@/types";
import type { GetDashboardParams, GetTransactionsParams } from "@/api/types";

type MockDb = {
  categories: Category[];
  transactions: Transaction[];
  budgetsByMonth: Record<string, number>;
};

declare global {
  // eslint-disable-next-line no-var
  var __budgetMockDb: MockDb | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string, n: number) {
  return `${prefix}_${String(n).padStart(4, "0")}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function seededRandom(seed: number) {
  // xorshift32-ish
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}

function toYmd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function monthKey(ymd: string) {
  return ymd.slice(0, 7);
}

function monthRange(from?: string, to?: string, fallbackStart?: string, fallbackEnd?: string) {
  const startRaw = from ?? fallbackStart;
  const endRaw = to ?? fallbackEnd;
  if (!startRaw || !endRaw) return [] as string[];

  const start = startOfMonth(parseISO(startRaw));
  const end = startOfMonth(parseISO(endRaw));
  if (!isValid(start) || !isValid(end)) return [] as string[];

  const out: string[] = [];
  for (let d = start; d <= end; d = addMonths(d, 1)) {
    out.push(format(d, "yyyy-MM"));
  }
  return out;
}

function trendIntervalForRange(from?: string, to?: string) {
  if (!from || !to) return "month" as const;
  const a = parseISO(from);
  const b = parseISO(to);
  if (!isValid(a) || !isValid(b)) return "month" as const;
  const diffDays = Math.abs(differenceInCalendarDays(b, a));
  return diffDays <= 31 ? ("day" as const) : ("month" as const);
}

function isWithinRange(ymd: string, from?: string, to?: string) {
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
}

function normalizeQuery(q?: string) {
  const s = (q ?? "").trim().toLowerCase();
  return s.length ? s : undefined;
}

export function getMockDb(): MockDb {
  if (globalThis.__budgetMockDb) return globalThis.__budgetMockDb;

  const createdAt = nowIso();
  const updatedAt = createdAt;

  const categories: Category[] = [
    { id: "cat_income_salary", name: "Salary", kind: "income", active: true },
    { id: "cat_income_freelance", name: "Freelance", kind: "income", active: true },

    { id: "cat_expense_rent", name: "Rent", kind: "expense", active: true },
    { id: "cat_expense_bills", name: "Bills", kind: "expense", active: true, parentId: null },
    { id: "cat_expense_utilities", name: "Utilities", kind: "expense", active: true, parentId: "cat_expense_bills" },
    { id: "cat_expense_internet", name: "Internet", kind: "expense", active: true, parentId: "cat_expense_bills" },
    { id: "cat_expense_phone", name: "Phone", kind: "expense", active: true, parentId: "cat_expense_bills" },

    { id: "cat_expense_food", name: "Food", kind: "expense", active: true, parentId: null },
    { id: "cat_expense_groceries", name: "Groceries", kind: "expense", active: true, parentId: "cat_expense_food" },
    { id: "cat_expense_dining", name: "Dining", kind: "expense", active: true, parentId: "cat_expense_food" },

    { id: "cat_expense_transport", name: "Transport", kind: "expense", active: true },
    { id: "cat_expense_entertainment", name: "Entertainment", kind: "expense", active: true },
    { id: "cat_expense_subscriptions", name: "Subscriptions", kind: "expense", active: true },
    { id: "cat_expense_health", name: "Health", kind: "expense", active: true },
  ];

  const rand = seededRandom(42);
  const txns: Transaction[] = [];

  // Use a fixed date for consistent mock data: Feb 28, 2026
  const today = new Date(2026, 1, 28);
  const start = startOfMonth(subMonths(today, 5)); // Sept 2025

  const merchants = [
    "Whole Foods",
    "Trader Joe’s",
    "Safeway",
    "Starbucks",
    "Chipotle",
    "Netflix",
    "Spotify",
    "Apple",
    "Uber",
    "Lyft",
    "Shell",
    "PG&E",
    "Comcast",
    "AT&T",
    "CVS",
    "AMC",
  ];

  const expenseCategoryPool = categories.filter((c) => c.kind === "expense" && c.active && c.parentId !== null);
  const incomeCategoryPool = categories.filter((c) => c.kind === "income" && c.active);

  // Seed a couple of predictable monthly events
  function addTxn(partial: Omit<Transaction, "id" | "createdAt" | "updatedAt">) {
    const id = makeId("txn", txns.length + 1);
    txns.push({ id, ...partial, createdAt, updatedAt });
  }

  // Monthly rent + bills + salary
  for (let m = 0; m < 6; m++) {
    const monthStart = startOfMonth(addDays(start, m * 31));
    addTxn({
      date: toYmd(addDays(monthStart, 0)),
      amountCents: 520000, // $5200
      categoryId: "cat_income_salary",
      merchant: "Employer Inc.",
      notes: "Paycheck",
    });
    addTxn({
      date: toYmd(addDays(monthStart, 2)),
      amountCents: -235000, // -$2350
      categoryId: "cat_expense_rent",
      merchant: "Landlord",
      notes: "Rent",
    });
    addTxn({
      date: toYmd(addDays(monthStart, 5)),
      amountCents: -9200,
      categoryId: "cat_expense_internet",
      merchant: "Comcast",
      notes: "Internet",
    });
    addTxn({
      date: toYmd(addDays(monthStart, 6)),
      amountCents: -6800,
      categoryId: "cat_expense_phone",
      merchant: "AT&T",
      notes: "Phone bill",
    });
    addTxn({
      date: toYmd(addDays(monthStart, 7)),
      amountCents: -12400,
      categoryId: "cat_expense_utilities",
      merchant: "PG&E",
      notes: "Utilities",
    });
  }

  // Random-ish expenses across months/days - generate more data
  const txnTarget = 120;
  while (txns.length < txnTarget) {
    const dayOffset = Math.floor(rand() * 180);
    const date = toYmd(addDays(start, dayOffset));
    const isIncome = rand() < 0.12;

    if (isIncome) {
      const cat = incomeCategoryPool[Math.floor(rand() * incomeCategoryPool.length)]!;
      const cents = Math.floor((rand() * 1600 + 200) * 100); // $200-$1800
      addTxn({
        date,
        amountCents: cents,
        categoryId: cat.id,
        merchant: "Client",
        notes: rand() < 0.6 ? "Invoice payment" : undefined,
      });
      continue;
    }

    const cat = expenseCategoryPool[Math.floor(rand() * expenseCategoryPool.length)]!;
    const merchant = merchants[Math.floor(rand() * merchants.length)]!;
    const base = rand();
    const dollars =
      cat.id.includes("groceries") ? 35 + base * 140 :
        cat.id.includes("dining") ? 12 + base * 90 :
          cat.id.includes("transport") ? 8 + base * 55 :
            cat.id.includes("entertainment") ? 10 + base * 70 :
              cat.id.includes("subscriptions") ? 8 + base * 25 :
                cat.id.includes("health") ? 10 + base * 90 :
                  8 + base * 80;
    const cents = -Math.floor(dollars * 100);

    addTxn({
      date,
      amountCents: cents,
      categoryId: cat.id,
      merchant,
      notes: rand() < 0.1 ? "This is a very long note that should wrap to multiple lines to test the layout of the transactions table. It contains multiple sentences and should be long enough to exceed the column width." :
        rand() < 0.2 ? "Another fairly lengthy note about this specific purchase, including details about what was bought and why it was necessary for the household." :
          rand() < 0.3 ? "—" : undefined,
    });
  }

  // Add specific transactions with extremely long notes
  addTxn({
    date: "2026-02-25",
    amountCents: -5420,
    categoryId: "cat_expense_groceries",
    merchant: "Whole Foods",
    notes: "Weekly grocery run for the family. Bought organic milk, eggs, bread, some fresh vegetables (carrots, kale, spinach), several pounds of chicken breast, and a specialty wheel of brie cheese that was on sale. Also grabbed some sparkling water and a bag of coffee beans for the morning. Total was a bit higher than usual because of the coffee beans and the cheese, but it should last us through the end of next week.",
  });

  addTxn({
    date: "2026-02-15",
    amountCents: -12500,
    categoryId: "cat_expense_entertainment",
    merchant: "Concert Venue",
    notes: "Tickets for the upcoming indie rock festival in the park. This includes the general admission entry fee for two people, plus the convenience fees charged by the ticketing platform, and a small donation to the park's local preservation society. I really hope the weather stays clear for the event, as it's outdoors and they don't have a very good rain policy. Should be a great time though, with over twelve bands performing.",
  });

  // Add more transactions specifically for Jan-Feb 2026
  const jan2026Start = new Date(2026, 0, 1);
  const feb2026End = new Date(2026, 1, 28);

  // Weekly groceries in Jan-Feb
  for (let week = 0; week < 8; week++) {
    const date = toYmd(addDays(jan2026Start, week * 7 + Math.floor(rand() * 3)));
    if (date > toYmd(feb2026End)) continue;
    const merchant = ["Whole Foods", "Trader Joe's", "Safeway", "Costco"][Math.floor(rand() * 4)]!;
    addTxn({
      date,
      amountCents: -Math.floor((80 + rand() * 120) * 100),
      categoryId: "cat_expense_groceries",
      merchant,
      notes: "Weekly groceries",
    });
  }

  // Dining out 2-3 times per week in Jan-Feb
  for (let i = 0; i < 20; i++) {
    const dayOffset = Math.floor(rand() * 58);
    const date = toYmd(addDays(jan2026Start, dayOffset));
    const merchant = ["Starbucks", "Chipotle", "Panera", "Local Cafe", "Sushi Place", "Pizza Hut"][Math.floor(rand() * 6)]!;
    addTxn({
      date,
      amountCents: -Math.floor((12 + rand() * 45) * 100),
      categoryId: "cat_expense_dining",
      merchant,
    });
  }

  // Entertainment/subscriptions in Jan-Feb
  for (let m = 0; m < 2; m++) {
    const monthStart = addMonths(jan2026Start, m);
    addTxn({
      date: toYmd(addDays(monthStart, 1)),
      amountCents: -1599,
      categoryId: "cat_expense_subscriptions",
      merchant: "Netflix",
      notes: "Monthly subscription",
    });
    addTxn({
      date: toYmd(addDays(monthStart, 1)),
      amountCents: -1099,
      categoryId: "cat_expense_subscriptions",
      merchant: "Spotify",
      notes: "Monthly subscription",
    });
    addTxn({
      date: toYmd(addDays(monthStart, 15)),
      amountCents: -1499,
      categoryId: "cat_expense_subscriptions",
      merchant: "HBO Max",
      notes: "Monthly subscription",
    });
  }

  // Transport expenses in Jan-Feb
  for (let i = 0; i < 12; i++) {
    const dayOffset = Math.floor(rand() * 58);
    const date = toYmd(addDays(jan2026Start, dayOffset));
    const isUber = rand() < 0.6;
    addTxn({
      date,
      amountCents: -Math.floor((isUber ? 15 + rand() * 35 : 40 + rand() * 20) * 100),
      categoryId: "cat_expense_transport",
      merchant: isUber ? (rand() < 0.5 ? "Uber" : "Lyft") : "Shell Gas",
      notes: isUber ? undefined : "Gas fill-up",
    });
  }

  // Health expenses
  addTxn({
    date: "2026-01-10",
    amountCents: -3500,
    categoryId: "cat_expense_health",
    merchant: "CVS Pharmacy",
    notes: "Prescription",
  });
  addTxn({
    date: "2026-02-05",
    amountCents: -15000,
    categoryId: "cat_expense_health",
    merchant: "Dr. Smith",
    notes: "Copay",
  });
  addTxn({
    date: "2026-02-20",
    amountCents: -8500,
    categoryId: "cat_expense_health",
    merchant: "Gym Membership",
    notes: "Monthly fee",
  });

  // Sort by date desc then created
  txns.sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));

  // Seed an overall monthly budget for each month present in the mock transaction set.
  const months = Array.from(new Set(txns.map((t) => monthKey(t.date)))).sort();
  const budgetsByMonth: Record<string, number> = {};
  for (const m of months) budgetsByMonth[m] = 350_000; // $3,500

  globalThis.__budgetMockDb = { categories, transactions: txns, budgetsByMonth };
  return globalThis.__budgetMockDb;
}

export function mockGetOverallBudget(month: string): Budget | null {
  const db = getMockDb();
  const cents = db.budgetsByMonth[month];
  if (typeof cents !== "number") return null;
  return { month, categoryId: "", budgetCents: cents };
}

export function mockUpsertOverallBudget(payload: { month: string; budgetCents: number }): Budget {
  const db = getMockDb();
  db.budgetsByMonth[payload.month] = payload.budgetCents;
  return { month: payload.month, categoryId: "", budgetCents: payload.budgetCents };
}

export function mockDeleteOverallBudget(month: string): { ok: true } {
  const db = getMockDb();
  delete db.budgetsByMonth[month];
  return { ok: true as const };
}

export function mockFilterTransactions(params: GetTransactionsParams) {
  const db = getMockDb();
  const q = normalizeQuery(params.q);
  const categoryIdSet = params.categoryId?.length ? new Set(params.categoryId) : undefined;

  // UX: treat min/max as absolute amounts (so "min $10" matches both +$10 and -$10).
  const minAbs = params.minAmountCents;
  const maxAbs = params.maxAmountCents;

  return db.transactions.filter((t) => {
    if (!isWithinRange(t.date, params.from, params.to)) return false;
    if (categoryIdSet && !categoryIdSet.has(t.categoryId)) return false;
    if (typeof minAbs === "number" && Math.abs(t.amountCents) < Math.abs(minAbs)) return false;
    if (typeof maxAbs === "number" && Math.abs(t.amountCents) > Math.abs(maxAbs)) return false;

    if (q) {
      const hay = `${t.merchant ?? ""} ${t.notes ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function mockDashboardSummary(params: GetDashboardParams) {
  const txns = mockFilterTransactions(params);
  let income = 0;
  let expenseAbs = 0;
  for (const t of txns) {
    if (t.amountCents >= 0) income += t.amountCents;
    else expenseAbs += Math.abs(t.amountCents);
  }
  const net = income - expenseAbs;
  const savingsRate = income > 0 ? clamp(net / income, 0, 1) : 0;
  return { incomeCents: income, expenseCents: expenseAbs, netCents: net, savingsRate };
}

export function mockDashboardCharts(params: GetDashboardParams) {
  const db = getMockDb();
  const categoriesById = new Map(db.categories.map((c) => [c.id, c]));
  const txns = mockFilterTransactions(params);

  const interval = trendIntervalForRange(params.from, params.to);
  const byPeriod = new Map<string, { income: number; expenseAbs: number }>();
  const byCategoryExpense = new Map<string, number>();
  const byMonthCategoryExpense = new Map<string, Map<string, number>>();

  for (const t of txns) {
    const period = interval === "day" ? t.date : monthKey(t.date);
    const agg = byPeriod.get(period) ?? { income: 0, expenseAbs: 0 };
    if (t.amountCents >= 0) agg.income += t.amountCents;
    else agg.expenseAbs += Math.abs(t.amountCents);
    byPeriod.set(period, agg);

    if (t.amountCents < 0) {
      byCategoryExpense.set(t.categoryId, (byCategoryExpense.get(t.categoryId) ?? 0) + Math.abs(t.amountCents));

      const m = monthKey(t.date);
      const row = byMonthCategoryExpense.get(m) ?? new Map<string, number>();
      row.set(t.categoryId, (row.get(t.categoryId) ?? 0) + Math.abs(t.amountCents));
      byMonthCategoryExpense.set(m, row);
    }
  }

  const monthlyTrend = (() => {
    if (!params.from || !params.to) {
      return Array.from(byPeriod.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => ({ month, incomeCents: v.income, expenseCents: v.expenseAbs }));
    }

    const startRaw = parseISO(params.from!);
    const endRaw = parseISO(params.to!);
    if (!isValid(startRaw) || !isValid(endRaw)) {
      return Array.from(byPeriod.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => ({ month, incomeCents: v.income, expenseCents: v.expenseAbs }));
    }

    const start = interval === "day" ? startRaw : startOfMonth(startRaw);
    const end = interval === "day" ? endRaw : startOfMonth(endRaw);
    const result: { month: string; incomeCents: number; expenseCents: number }[] = [];

    for (let d = start; d <= end; d = interval === "day" ? addDays(d, 1) : addMonths(d, 1)) {
      const key = interval === "day" ? toYmd(d) : monthKey(toYmd(d));
      const v = byPeriod.get(key) ?? { income: 0, expenseAbs: 0 };
      result.push({ month: key, incomeCents: v.income, expenseCents: v.expenseAbs });
    }
    return result;
  })();

  const categoryBreakdown = Array.from(byCategoryExpense.entries())
    .map(([categoryId, totalCents]) => ({
      categoryId,
      categoryName: categoriesById.get(categoryId)?.name ?? "Unknown",
      totalCents,
    }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 10);

  const categoryShare = Array.from(byCategoryExpense.entries())
    .map(([categoryId, totalCents]) => ({
      categoryId,
      categoryName: categoriesById.get(categoryId)?.name ?? "Unknown",
      totalCents,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  const months = monthRange(params.from, params.to, txns.at(-1)?.date, txns.at(0)?.date);
  const topIds = categoryShare.slice(0, 8).map((c) => c.categoryId);
  const categoryMonthly = {
    months,
    series: topIds.map((categoryId) => {
      const categoryName = categoriesById.get(categoryId)?.name ?? "Unknown";
      const totalCents = byCategoryExpense.get(categoryId) ?? 0;
      const valuesCents = months.map((m) => byMonthCategoryExpense.get(m)?.get(categoryId) ?? 0);
      return { categoryId, categoryName, totalCents, valuesCents };
    }),
  };

  return { trendInterval: interval, monthlyTrend, categoryBreakdown, categoryShare, categoryMonthly };
}

export function mockInsertTransaction(input: Omit<Transaction, "id" | "createdAt" | "updatedAt">) {
  const db = getMockDb();
  const createdAt = nowIso();
  const t: Transaction = {
    id: makeId("txn", db.transactions.length + 1),
    ...input,
    createdAt,
    updatedAt: createdAt,
  };
  db.transactions.unshift(t);
  db.transactions.sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
  return t;
}

export function mockUpdateTransaction(id: string, patch: Partial<Omit<Transaction, "id" | "createdAt" | "updatedAt">>) {
  const db = getMockDb();
  const idx = db.transactions.findIndex((t) => t.id === id);
  if (idx < 0) throw new Error("Transaction not found");
  const existing = db.transactions[idx]!;
  const updatedAt = nowIso();
  const next: Transaction = { ...existing, ...patch, updatedAt };
  db.transactions[idx] = next;
  db.transactions.sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
  return next;
}

export function mockDeleteTransaction(id: string) {
  const db = getMockDb();
  const idx = db.transactions.findIndex((t) => t.id === id);
  if (idx >= 0) db.transactions.splice(idx, 1);
  return { ok: true as const };
}

export function mockInsertCategory(input: Omit<Category, "id">) {
  const db = getMockDb();
  const id = `cat_${input.kind}_${String(db.categories.length + 1).padStart(3, "0")}`;
  const c: Category = { id, ...input };
  db.categories.push(c);
  return c;
}

export function mockUpdateCategory(id: string, patch: Partial<Omit<Category, "id">>) {
  const db = getMockDb();
  const idx = db.categories.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Category not found");
  const existing = db.categories[idx]!;
  const next: Category = { ...existing, ...patch, id };
  db.categories[idx] = next;
  return next;
}

export function mockDeleteCategory(id: string, opts: { reassignToCategoryId: string }) {
  const db = getMockDb();
  const categoryId = id;
  const reassignToCategoryId = opts.reassignToCategoryId;

  if (!categoryId) throw new Error("Category id is required");
  if (!reassignToCategoryId) throw new Error("reassignToCategoryId is required");
  if (reassignToCategoryId === categoryId) throw new Error("reassignToCategoryId cannot equal category id");

  const src = db.categories.find((c) => c.id === categoryId);
  if (!src) throw new Error("Category not found");
  const dst = db.categories.find((c) => c.id === reassignToCategoryId);
  if (!dst) throw new Error("Reassign target not found");
  if (src.kind !== dst.kind) throw new Error("Reassign target kind mismatch");

  // Reassign transactions.
  for (const t of db.transactions) {
    if (t.categoryId === categoryId) t.categoryId = reassignToCategoryId;
  }

  // Clear parent pointers for children.
  for (const c of db.categories) {
    if (c.parentId === categoryId) c.parentId = null;
  }

  const idx = db.categories.findIndex((c) => c.id === categoryId);
  if (idx >= 0) db.categories.splice(idx, 1);
  return { ok: true as const };
}


