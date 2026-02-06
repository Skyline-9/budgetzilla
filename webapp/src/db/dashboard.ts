import {
  addDays,
  addMonths,
  format,
  parseISO,
  startOfMonth,
  startOfToday
} from "date-fns";
import { execSQL } from "./sqlite";
import { getCategories } from "./categories";
import type {
  DashboardSummary,
  DashboardCharts,
  MonthlyTrendPoint,
  CategoryBreakdownItem,
  CategoryMonthlySeries,
  TrendInterval,
} from "@/types";

export type DashboardParams = {
  from?: string;
  to?: string;
  q?: string;
  categoryId?: string[];
  minAmountCents?: number;
  maxAmountCents?: number;
};

function buildWhereClause(params: DashboardParams): { clause: string; values: (string | number)[] } {
  const conditions: string[] = ["deleted = 0"];
  const values: (string | number)[] = [];

  if (params.from) {
    conditions.push("date >= ?");
    values.push(params.from);
  }
  if (params.to) {
    conditions.push("date <= ?");
    values.push(params.to);
  }
  if (params.q) {
    conditions.push("(merchant LIKE ? OR notes LIKE ?)");
    const pattern = `%${params.q}%`;
    values.push(pattern, pattern);
  }
  if (params.categoryId && params.categoryId.length > 0) {
    const placeholders = params.categoryId.map(() => "?").join(", ");
    conditions.push(`category_id IN (${placeholders})`);
    values.push(...params.categoryId);
  }
  if (params.minAmountCents !== undefined) {
    conditions.push("amount_cents >= ?");
    values.push(params.minAmountCents);
  }
  if (params.maxAmountCents !== undefined) {
    conditions.push("amount_cents <= ?");
    values.push(params.maxAmountCents);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

/**
 * Get dashboard summary (income, expense, net, savings rate).
 */
export async function getDashboardSummary(params: DashboardParams = {}): Promise<DashboardSummary> {
  const { clause, values } = buildWhereClause(params);

  const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END), 0) as expense
    FROM transactions
    ${clause}
  `;

  const rows = await execSQL(sql, values) as [[number, number]];
  const [income, expense] = rows[0] ?? [0, 0];
  const net = income - expense;
  const savingsRate = income > 0 ? net / income : 0;

  return {
    incomeCents: income,
    expenseCents: expense,
    netCents: net,
    savingsRate: Math.max(0, Math.min(1, savingsRate)),
  };
}

/**
 * Get monthly trend data.
 */
async function getMonthlyTrend(params: DashboardParams): Promise<MonthlyTrendPoint[]> {
  const { clause, values } = buildWhereClause(params);

  const sql = `
    SELECT
      SUBSTR(date, 1, 7) as month,
      COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END), 0) as expense
    FROM transactions
    ${clause}
    GROUP BY SUBSTR(date, 1, 7)
    ORDER BY month
  `;

  const rows = await execSQL(sql, values) as [string, number, number][];

  const results = rows.map(([month, income, expense]) => ({
    month,
    incomeCents: income,
    expenseCents: expense,
  }));

  // Fill gaps if from/to are provided
  if (params.from && params.to) {
    const start = startOfMonth(parseISO(params.from));
    const end = startOfMonth(parseISO(params.to));
    const filled: MonthlyTrendPoint[] = [];

    for (let d = start; d <= end; d = addMonths(d, 1)) {
      const monthStr = format(d, "yyyy-MM");
      const existing = results.find((r) => r.month === monthStr);
      if (existing) {
        filled.push(existing);
      } else {
        filled.push({ month: monthStr, incomeCents: 0, expenseCents: 0 });
      }
    }
    return filled;
  }

  return results;
}

/**
 * Get daily trend data.
 */
async function getDailyTrend(params: DashboardParams): Promise<MonthlyTrendPoint[]> {
  const { clause, values } = buildWhereClause(params);

  const sql = `
    SELECT
      date as month,
      COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END), 0) as expense
    FROM transactions
    ${clause}
    GROUP BY date
    ORDER BY date
  `;

  const rows = await execSQL(sql, values) as [string, number, number][];

  const results = rows.map(([month, income, expense]) => ({
    month,
    incomeCents: income,
    expenseCents: expense,
  }));

  // Fill gaps if from/to are provided
  if (params.from && params.to) {
    const start = parseISO(params.from);
    const end = parseISO(params.to);
    const filled: MonthlyTrendPoint[] = [];

    for (let d = start; d <= end; d = addDays(d, 1)) {
      const dayStr = format(d, "yyyy-MM-dd");
      const existing = results.find((r) => r.month === dayStr);
      if (existing) {
        filled.push(existing);
      } else {
        filled.push({ month: dayStr, incomeCents: 0, expenseCents: 0 });
      }
    }
    return filled;
  }

  return results;
}

/**
 * Get expense breakdown by category.
 */
async function getCategoryBreakdown(params: DashboardParams, limit = 10): Promise<CategoryBreakdownItem[]> {
  const categories = await getCategories();
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  const { clause, values } = buildWhereClause(params);

  // Only expenses (negative amounts)
  const expenseClause = clause
    ? `${clause} AND amount_cents < 0`
    : "WHERE deleted = 0 AND amount_cents < 0";

  const sql = `
    SELECT
      category_id,
      SUM(ABS(amount_cents)) as total
    FROM transactions
    ${expenseClause}
    GROUP BY category_id
    ORDER BY total DESC
    LIMIT ?
  `;

  const rows = await execSQL(sql, [...values, limit]) as [string, number][];

  return rows.map(([categoryId, total]) => ({
    categoryId,
    categoryName: categoryMap.get(categoryId) ?? "Unknown",
    totalCents: total,
  }));
}

/**
 * Get category share (for donut chart) - all expenses.
 */
async function getCategoryShare(params: DashboardParams): Promise<CategoryBreakdownItem[]> {
  return getCategoryBreakdown(params, 100);
}

/**
 * Get category monthly trends (for stacked bar chart).
 */
async function getCategoryMonthly(params: DashboardParams, topN = 5): Promise<{
  months: string[];
  series: CategoryMonthlySeries[];
}> {
  const categories = await getCategories();
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  // First, get the top N categories by total expense
  const topCategories = await getCategoryBreakdown(params, topN);
  const topCategoryIds = topCategories.map(c => c.categoryId);

  if (topCategoryIds.length === 0) {
    return { months: [], series: [] };
  }

  const { clause, values } = buildWhereClause(params);

  // Get monthly breakdown for top categories
  const categoryPlaceholders = topCategoryIds.map(() => "?").join(", ");
  const expenseClause = clause
    ? `${clause} AND amount_cents < 0 AND category_id IN (${categoryPlaceholders})`
    : `WHERE deleted = 0 AND amount_cents < 0 AND category_id IN (${categoryPlaceholders})`;

  const sql = `
    SELECT
      SUBSTR(date, 1, 7) as month,
      category_id,
      SUM(ABS(amount_cents)) as total
    FROM transactions
    ${expenseClause}
    GROUP BY SUBSTR(date, 1, 7), category_id
    ORDER BY month
  `;

  const rows = await execSQL(sql, [...values, ...topCategoryIds]) as [string, string, number][];

  // Get unique months
  const monthsSet = new Set<string>();
  rows.forEach(([month]) => monthsSet.add(month));
  const months = Array.from(monthsSet).sort();

  // Build series for each category
  const series: CategoryMonthlySeries[] = topCategories.map(cat => {
    const valuesCents = months.map(month => {
      const row = rows.find(r => r[0] === month && r[1] === cat.categoryId);
      return row ? row[2] : 0;
    });

    return {
      categoryId: cat.categoryId,
      categoryName: categoryMap.get(cat.categoryId) ?? "Unknown",
      totalCents: cat.totalCents,
      valuesCents,
    };
  });

  return { months, series };
}

/**
 * Determine the appropriate trend interval based on date range.
 */
function determineTrendInterval(params: DashboardParams): TrendInterval {
  if (!params.from || !params.to) {
    return "month";
  }

  const from = new Date(params.from);
  const to = new Date(params.to);
  const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

  // Use daily for ranges <= 62 days (roughly 2 months)
  return days <= 62 ? "day" : "month";
}

/**
 * Get all dashboard chart data.
 */
export async function getDashboardCharts(params: DashboardParams = {}): Promise<DashboardCharts> {
  const trendInterval = determineTrendInterval(params);

  const [monthlyTrend, categoryBreakdown, categoryShare, categoryMonthly] = await Promise.all([
    trendInterval === "day" ? getDailyTrend(params) : getMonthlyTrend(params),
    getCategoryBreakdown(params, 10),
    getCategoryShare(params),
    getCategoryMonthly(params, 5),
  ]);

  return {
    trendInterval,
    monthlyTrend,
    categoryBreakdown,
    categoryShare,
    categoryMonthly,
  };
}
