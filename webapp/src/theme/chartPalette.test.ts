import { describe, it, expect } from "vitest";
import {
  categoricalHighlightColors,
  blueRamp,
  chartSeriesColors,
  CHART_HIGHLIGHT,
} from "./chartPalette";

describe("categoricalHighlightColors", () => {
  it("highlights only the given index and keeps the rest neutral", () => {
    const colors = categoricalHighlightColors(4, 2, "dark");
    expect(colors).toHaveLength(4);
    expect(colors[2]).toBe(CHART_HIGHLIGHT);
    expect(colors.filter((c) => c === CHART_HIGHLIGHT)).toHaveLength(1);
    expect(colors[0]).not.toBe(CHART_HIGHLIGHT);
  });
  it("uses a different neutral for light vs dark", () => {
    expect(categoricalHighlightColors(2, 0, "dark")[1]).not.toBe(
      categoricalHighlightColors(2, 0, "light")[1],
    );
  });
});

describe("blueRamp", () => {
  it("returns exactly count colors starting with the brand blue", () => {
    expect(blueRamp(1)).toEqual([CHART_HIGHLIGHT]);
    expect(blueRamp(3)).toHaveLength(3);
    expect(blueRamp(3)[0]).toBe(CHART_HIGHLIGHT);
  });
  it("cycles when count exceeds the ramp length", () => {
    const ramp = blueRamp(9);
    expect(ramp).toHaveLength(9);
    expect(ramp[0]).toBe(ramp[5]);
  });
});

describe("chartSeriesColors", () => {
  it("returns green income and red expense with area variants", () => {
    const dark = chartSeriesColors("dark");
    expect(dark.income.line).toMatch(/^#/);
    expect(dark.income.area).toContain("rgba(");
    expect(dark.income.line).not.toBe(dark.expense.line);
  });
});
