function avg(values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return 0;
  return clean.reduce((acc, v) => acc + v, 0) / clean.length;
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
