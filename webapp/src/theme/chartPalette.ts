export type ChartTheme = "dark" | "light";

export const CHART_HIGHLIGHT = "#2F80FF";

const NEUTRAL_DARK = "#64748b";
const NEUTRAL_LIGHT = "#94a3b8";

const BLUE_RAMP = ["#2F80FF", "#5B9BFF", "#85B6FF", "#AFD0FF", "#D6E6FF"];

const SERIES = {
  dark: {
    income: { line: "#22c55e", area: "rgba(34,197,94,0.10)" },
    expense: { line: "#f87171", area: "rgba(248,113,113,0.10)" },
  },
  light: {
    income: { line: "#16a34a", area: "rgba(22,163,74,0.10)" },
    expense: { line: "#dc2626", area: "rgba(220,38,38,0.10)" },
  },
} as const;

export function categoricalHighlightColors(
  count: number,
  highlightIndex: number,
  theme: ChartTheme,
): string[] {
  const neutral = theme === "dark" ? NEUTRAL_DARK : NEUTRAL_LIGHT;
  return Array.from({ length: count }, (_, i) =>
    i === highlightIndex ? CHART_HIGHLIGHT : neutral,
  );
}

export function blueRamp(count: number): string[] {
  return Array.from({ length: count }, (_, i) => BLUE_RAMP[i % BLUE_RAMP.length]);
}

export function chartSeriesColors(theme: ChartTheme) {
  return SERIES[theme];
}
