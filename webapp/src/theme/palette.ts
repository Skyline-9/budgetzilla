type CssVarName = `--${string}`;

function canReadDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function readCssVar(name: CssVarName): string | undefined {
  if (!canReadDom()) return undefined;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || undefined;
}

export function readCssList(name: CssVarName): string[] {
  const raw = readCssVar(name);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const DEFAULT_CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#84cc16",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
] as const;

export function getCategoryColorOptions(): string[] {
  const list = readCssList("--palette-category-colors");
  return list.length ? list : [...DEFAULT_CATEGORY_COLORS];
}
