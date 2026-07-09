/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { buildRecapStats } from "./useRecapStats";

beforeAll(() => {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
  });
});

describe("buildRecapStats", () => {
  it("produces income, expense, net, and top-category rows", () => {
    const stats = buildRecapStats({
      incomeCents: 2854800,
      expenseCents: 1517021,
      netCents: 1337779,
      topCategoryName: "Rent",
      topCategoryCents: 500000,
    });
    const labels = stats.map((s) => s.label);
    expect(labels).toContain("Income");
    expect(labels).toContain("Expenses");
    expect(labels).toContain("Net");
    expect(labels).toContain("Top category");
    expect(stats.find((s) => s.label === "Net")?.tone).toBe("income");
  });
  it("marks a negative net as expense tone and omits top category when absent", () => {
    const stats = buildRecapStats({
      incomeCents: 100000,
      expenseCents: 250000,
      netCents: -150000,
      topCategoryName: null,
      topCategoryCents: 0,
    });
    expect(stats.find((s) => s.label === "Net")?.tone).toBe("expense");
    expect(stats.some((s) => s.label === "Top category")).toBe(false);
  });
});
