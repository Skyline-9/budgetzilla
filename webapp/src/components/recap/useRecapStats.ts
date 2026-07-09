import { formatCents } from "@/lib/format";

export type RecapStat = {
  label: string;
  value: string;
  tone: "neutral" | "income" | "expense";
};

export function buildRecapStats(input: {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  topCategoryName: string | null;
  topCategoryCents: number;
}): RecapStat[] {
  const stats: RecapStat[] = [
    { label: "Income", value: formatCents(input.incomeCents), tone: "income" },
    { label: "Expenses", value: formatCents(input.expenseCents), tone: "expense" },
    {
      label: "Net",
      value: formatCents(input.netCents),
      tone: input.netCents >= 0 ? "income" : "expense",
    },
  ];
  if (input.topCategoryName) {
    stats.push({
      label: "Top category",
      value: `${input.topCategoryName} · ${formatCents(input.topCategoryCents)}`,
      tone: "neutral",
    });
  }
  return stats;
}
