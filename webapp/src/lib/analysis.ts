import { differenceInCalendarDays, getDay, isValid, parseISO } from "date-fns";
import type { Transaction } from "@/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function avg(values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return 0;
  return clean.reduce((acc, v) => acc + v, 0) / clean.length;
}

export function calculatePareto<T extends { totalCents: number }>(
  items: T[],
  opts?: { targetPercent?: number },
): {
  totalCents: number;
  categoriesFor80Percent: number;
  items: Array<T & { cumulativePercent: number }>;
} {
  const target = opts?.targetPercent ?? 0.8;
  const sorted = [...items].sort((a, b) => (b.totalCents ?? 0) - (a.totalCents ?? 0));
  const totalCents = sorted.reduce((acc, i) => acc + Math.max(0, i.totalCents ?? 0), 0);

  if (!sorted.length || totalCents <= 0) {
    return {
      totalCents,
      categoriesFor80Percent: 0,
      items: sorted.map((i) => ({ ...i, cumulativePercent: 0 })),
    };
  }

  let running = 0;
  const withCumulative = sorted.map((i) => {
    running += Math.max(0, i.totalCents ?? 0);
    return { ...i, cumulativePercent: running / totalCents };
  });

  const idx = withCumulative.findIndex((i) => i.cumulativePercent >= target);
  const categoriesFor80Percent = idx === -1 ? withCumulative.length : idx + 1;
  return { totalCents, categoriesFor80Percent, items: withCumulative };
}

export function detectAnomalies(
  amounts: number[],
  threshold = 2,
): Array<{ amount: number; zScore: number; isAnomaly: boolean }> {
  const clean = amounts.filter((a) => Number.isFinite(a));
  if (!clean.length) return amounts.map((amount) => ({ amount, zScore: 0, isAnomaly: false }));

  const mean = avg(clean);
  const variance = clean.reduce((acc, x) => acc + (x - mean) ** 2, 0) / clean.length;
  const std = Math.sqrt(variance);

  return amounts.map((amount) => {
    if (!Number.isFinite(amount) || std === 0) return { amount, zScore: 0, isAnomaly: false };
    const zScore = (amount - mean) / std;
    return { amount, zScore, isAnomaly: Math.abs(zScore) >= threshold };
  });
}

export function analyzeDayOfWeek(transactions: Transaction[]): {
  byDay: number[]; // 0=Sun ... 6=Sat, cents
  peakDay: number;
  peakDayName: string;
} {
  const byDay = [0, 0, 0, 0, 0, 0, 0];

  for (const t of transactions) {
    const amount = Number(t.amountCents);
    if (!Number.isFinite(amount) || amount >= 0) continue; // spend only

    const d = parseISO(t.date);
    if (!isValid(d)) continue;
    const day = getDay(d);
    byDay[day] += -amount;
  }

  let peakDay = 0;
  let peakValue = byDay[0] ?? 0;
  for (let i = 1; i < 7; i++) {
    if ((byDay[i] ?? 0) > peakValue) {
      peakValue = byDay[i] ?? 0;
      peakDay = i;
    }
  }

  return { byDay, peakDay, peakDayName: DAY_NAMES[peakDay]! };
}

export function forecastMonthEnd(
  currentSpendCents: number,
  dayOfMonth: number,
  opts?: { daysInMonth?: number },
): { projected: number; dailyAverage: number; confidence: "high" | "medium" | "low" } {
  const spend = Math.max(0, Number.isFinite(currentSpendCents) ? currentSpendCents : 0);
  const dom = Math.max(1, Math.floor(Number.isFinite(dayOfMonth) ? dayOfMonth : 1));
  const dim = Math.max(dom, Math.floor(opts?.daysInMonth ?? 30));

  const dailyAverage = spend / dom;
  const projected = dailyAverage * dim;

  const confidence = dom >= 14 ? "high" : dom >= 7 ? "medium" : "low";
  return {
    projected: Math.round(projected),
    dailyAverage: Math.round(dailyAverage),
    confidence,
  };
}

export function calculateTrend(
  recent: number[],
  prior: number[],
): { percentChange: number; direction: "up" | "down" | "stable" } {
  const recentAvg = avg(recent);
  const priorAvg = avg(prior);

  if (priorAvg <= 0) {
    if (recentAvg <= 0) return { percentChange: 0, direction: "stable" };
    return { percentChange: 100, direction: "up" };
  }

  const percentChange = ((recentAvg - priorAvg) / priorAvg) * 100;
  const direction = Math.abs(percentChange) < 0.5 ? "stable" : percentChange > 0 ? "up" : "down";
  return { percentChange, direction };
}

export type BudgetTip = {
  id: string;
  type: "warning" | "caution" | "success" | "info";
  title: string;
  message: string;
  priority: number;
};

export type BudgetTipParams = {
  summary: { incomeCents: number; expenseCents: number; savingsRate: number };
  trend?: { direction: "up" | "down" | "stable"; percentChange: number } | null;
  forecast?: { projected: number } | null;
  budgetCents?: number | null;
  topCategory?: { name: string; sharePct: number } | null;
  recurringTotalCents?: number;
  weekendAnalysis?: { ratio: number; weekendAvgCents: number; weekdayAvgCents: number } | null;
};

export function generateBudgetTips(params: BudgetTipParams): BudgetTip[] {
  const tips: BudgetTip[] = [];
  const { summary, trend, forecast, budgetCents, topCategory, recurringTotalCents, weekendAnalysis } = params;

  // Priority 10: Spending exceeds income
  if (summary.savingsRate < 0) {
    tips.push({
      id: "negative-savings",
      type: "warning",
      title: "Overspending",
      message: "Spending exceeds income this period. Review expenses to find areas to cut back.",
      priority: 10,
    });
  }

  // Priority 9: On track to exceed budget
  if (forecast && budgetCents && budgetCents > 0 && forecast.projected > budgetCents * 1.1) {
    const overBy = forecast.projected - budgetCents;
    const overByDollars = Math.round(overBy / 100);
    tips.push({
      id: "over-budget-forecast",
      type: "warning",
      title: "Budget Alert",
      message: `Projected to exceed budget by $${overByDollars}. Consider reducing discretionary spending.`,
      priority: 9,
    });
  }

  // Priority 8: Spending trending up significantly
  if (trend && trend.direction === "up" && trend.percentChange >= 20) {
    tips.push({
      id: "spending-trending-up",
      type: "caution",
      title: "Spending Up",
      message: `Spending is up ${Math.round(trend.percentChange)}% vs prior period. Watch for lifestyle creep.`,
      priority: 8,
    });
  }

  // Priority 7: Low savings rate (but not negative)
  if (summary.savingsRate >= 0 && summary.savingsRate < 0.1 && summary.incomeCents > 0) {
    tips.push({
      id: "low-savings-rate",
      type: "caution",
      title: "Low Savings",
      message: "Savings rate is below 10%. Financial experts recommend saving at least 20% of income.",
      priority: 7,
    });
  }

  // Priority 6: Top category dominates spending
  if (topCategory && topCategory.sharePct > 50) {
    tips.push({
      id: "category-concentration",
      type: "info",
      title: "Concentrated Spending",
      message: `${Math.round(topCategory.sharePct)}% of spending is in ${topCategory.name}. Diversifying may reduce risk.`,
      priority: 6,
    });
  }

  // Priority 5: High recurring/subscription spend
  if (recurringTotalCents && summary.incomeCents > 0) {
    const recurringRatio = recurringTotalCents / summary.incomeCents;
    if (recurringRatio > 0.3) {
      tips.push({
        id: "high-subscriptions",
        type: "caution",
        title: "Subscription Load",
        message: `Recurring payments are ${Math.round(recurringRatio * 100)}% of income. Review subscriptions for unused services.`,
        priority: 5,
      });
    }
  }

  // Priority 4: Weekend spending significantly higher
  if (weekendAnalysis && weekendAnalysis.ratio > 1.4 && weekendAnalysis.weekdayAvgCents > 0) {
    const pctHigher = Math.round((weekendAnalysis.ratio - 1) * 100);
    tips.push({
      id: "weekend-spending",
      type: "info",
      title: "Weekend Pattern",
      message: `Weekend spending is ${pctHigher}% higher than weekdays. Planning weekend activities may help.`,
      priority: 4,
    });
  }

  // Priority 3: Good savings rate (positive feedback)
  if (summary.savingsRate >= 0.2 && summary.incomeCents > 0) {
    tips.push({
      id: "good-savings",
      type: "success",
      title: "On Track",
      message: `Great job! You're saving ${Math.round(summary.savingsRate * 100)}% of your income.`,
      priority: 3,
    });
  }

  // Priority 2: Spending trending down (positive)
  if (trend && trend.direction === "down" && trend.percentChange <= -10) {
    tips.push({
      id: "spending-down",
      type: "success",
      title: "Spending Down",
      message: `Spending is down ${Math.round(Math.abs(trend.percentChange))}% vs prior period. Keep it up!`,
      priority: 2,
    });
  }

  return tips.sort((a, b) => b.priority - a.priority);
}

export function analyzeWeekendSpending(transactions: Transaction[]): {
  weekdayAvgCents: number;
  weekendAvgCents: number;
  weekdayTotalCents: number;
  weekendTotalCents: number;
  weekdayCount: number;
  weekendCount: number;
  ratio: number;
} {
  let weekdayTotal = 0;
  let weekendTotal = 0;
  let weekdayCount = 0;
  let weekendCount = 0;

  for (const t of transactions) {
    const amount = Number(t.amountCents);
    if (!Number.isFinite(amount) || amount >= 0) continue;

    const d = parseISO(t.date);
    if (!isValid(d)) continue;

    const day = getDay(d);
    const absAmount = Math.abs(amount);

    if (day === 0 || day === 6) {
      weekendTotal += absAmount;
      weekendCount++;
    } else {
      weekdayTotal += absAmount;
      weekdayCount++;
    }
  }

  const weekdayAvg = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
  const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;
  const ratio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 0;

  return {
    weekdayAvgCents: Math.round(weekdayAvg),
    weekendAvgCents: Math.round(weekendAvg),
    weekdayTotalCents: weekdayTotal,
    weekendTotalCents: weekendTotal,
    weekdayCount,
    weekendCount,
    ratio,
  };
}

export function findRecurringTransactions(
  transactions: Transaction[],
  opts?: { minCount?: number; amountBucketCents?: number },
): Array<{
  merchant: string;
  count: number;
  avgAmountCents: number;
  avgIntervalDays: number | null;
  isLikelySubscription: boolean;
}> {
  const minCount = opts?.minCount ?? 3;
  const bucketCents = Math.max(1, Math.floor(opts?.amountBucketCents ?? 100));

  const byMerchant = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amountCents >= 0) continue; // expenses only
    const merchant = (t.merchant ?? "").trim();
    if (!merchant) continue;
    const key = merchant.toLowerCase();
    const arr = byMerchant.get(key);
    if (arr) arr.push(t);
    else byMerchant.set(key, [t]);
  }

  const out: Array<{
    merchant: string;
    count: number;
    avgAmountCents: number;
    avgIntervalDays: number | null;
    isLikelySubscription: boolean;
  }> = [];

  for (const [_key, txs] of byMerchant) {
    if (txs.length < minCount) continue;

    // Bucket by amount (approx) to avoid mixing multiple recurring payments for the same merchant.
    const byBucket = new Map<number, Transaction[]>();
    for (const t of txs) {
      const absCents = Math.abs(t.amountCents);
      const bucket = Math.round(absCents / bucketCents) * bucketCents;
      const arr = byBucket.get(bucket);
      if (arr) arr.push(t);
      else byBucket.set(bucket, [t]);
    }

    const clusters = [...byBucket.values()].sort((a, b) => b.length - a.length);
    const best = clusters[0];
    if (!best || best.length < minCount) continue;

    const merchantDisplay = (best.find((t) => (t.merchant ?? "").trim())?.merchant ?? "").trim();
    const amounts = best.map((t) => Math.abs(t.amountCents));
    const avgAmountCents = Math.round(avg(amounts));

    const dates = best
      .map((t) => parseISO(t.date))
      .filter((d) => isValid(d))
      .sort((a, b) => a.getTime() - b.getTime());

    let avgIntervalDays: number | null = null;
    if (dates.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) {
        intervals.push(Math.abs(differenceInCalendarDays(dates[i]!, dates[i - 1]!)));
      }
      avgIntervalDays = Math.round(avg(intervals));
    }

    const isLikelySubscription =
      avgIntervalDays != null ? avgIntervalDays >= 26 && avgIntervalDays <= 34 : false;

    out.push({
      merchant: merchantDisplay || "Unknown merchant",
      count: best.length,
      avgAmountCents,
      avgIntervalDays,
      isLikelySubscription,
    });
  }

  return out.sort((a, b) => {
    if (a.isLikelySubscription !== b.isLikelySubscription) return a.isLikelySubscription ? -1 : 1;
    if (a.count !== b.count) return b.count - a.count;
    return b.avgAmountCents - a.avgAmountCents;
  });
}

