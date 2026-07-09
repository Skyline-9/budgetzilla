# Budgetzilla Electric-Blue UI Redesign - Parallel Implementation Plan

> **For agentic workers:** This plan is optimized for MAXIMUM PARALLELISM. Phase 1 (Foundation) runs alone. Phase 2 shards touch DISJOINT file sets and run CONCURRENTLY. Phase 3 verifies once. **DO NOT commit, stage, push, or run `git` write operations.** Leave every change in the working tree. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace Budgetzilla's "AI slop" visual language with a single electric-blue brand system, green/red money-only semantics, Space Grotesk + Inter typography, decoration removal, and an additive cinematic Recap Hero.

**Architecture:** Design-token-first. Phase 1 changes shared design tokens (`index.css`, `tailwind.config.cjs`, fonts, `theme/palette.ts`, new `theme/chartPalette.ts`) so most surfaces re-skin automatically. Phase 2 shards each own a disjoint set of component files and edit only those. Phase 3 runs the single build/test/typecheck pass and a visual check.

**Tech Stack:** React 18, Vite 7, TypeScript 5.7, Tailwind CSS v4, Radix UI, ECharts 5 (`echarts-for-react`), `motion` (Framer Motion), `lucide-react`, Vitest 4. Local-first (sql.js / OPFS), runs offline.

## Global Constraints

- **NO GIT WRITES.** No `git add`, `git commit`, `git stage`, `git push`, `git reset`, `git checkout`. All changes stay uncommitted/unstaged in the working tree. The human handles version control.
- **Brand accent:** electric blue `#2F80FF` = `hsl(217 100% 59%)`. The only interactive/brand hue.
- **Money semantics only:** green = income/positive, red = expense/negative. No other accent hues anywhere.
- **Offline-first fonts:** self-host via `@fontsource-variable/*`. Never link the Google Fonts CDN.
- **Both themes must pass:** dark and light.
- **Motion:** purposeful only; honor `prefers-reduced-motion`; no ambient/infinite loops.
- **Package manager:** `npm`, run from `webapp/`.
- **Verification is centralized in Phase 3** to avoid parallel build contention. Phase 2 shard workers MUST NOT run `npm run build`, `npm run typecheck`, or `npx vitest` (those write shared caches: `tsconfig.tsbuildinfo`, `dist/`). Only Phase 1 and Phase 3 run builds/tests.
- **Do not touch unrelated files.** OUT of scope: `AiChatWidget.tsx` (its `animate-pulse-slow` / `shadow-glow-accent`), page-architecture consolidation, and the user category color picker (`getCategoryColorOptions` / `--palette-category-colors` stays).
- **`MetricCard.tsx` was edited externally before** — read the current working-tree content before editing.

---

## Dependency Graph & Sharding

```
Phase 1: FOUNDATION (must complete before Phase 2)
  package.json, main.tsx, index.css, tailwind.config.cjs,
  theme/palette.ts, theme/chartPalette.ts (+ test)

Phase 2: SHARDS (all run in parallel; each owns disjoint files)
  S1 MetricCard      -> components/dashboard/MetricCard.tsx
  S2 CashFlowCard    -> components/dashboard/CashFlowCard.tsx
  S3 BudgetCard      -> components/dashboard/BudgetCard.tsx
  S4 Sidebar         -> components/layout/Sidebar.tsx, SidebarNavItem.tsx
  S5 Charts          -> components/dashboard/DashboardCharts.tsx   (uses chartPalette.ts from Phase 1)
  S6 Misc-decoration -> components/layout/AppShell.tsx, components/transactions/TransactionsTable.tsx,
                        pages/Settings.tsx, components/dashboard/QuickInsights.tsx
  S7 Recap (Phase 2) -> components/recap/useRecapStats.ts (+ test), components/recap/RecapHero.tsx,
                        pages/Dashboard.tsx

Phase 3: VERIFY (single worker)
  npx vitest run && npm run typecheck && npm run build  (+ visual check, both themes)
```

No two shards share a file. `index.css` and `tailwind.config.cjs` are edited only in Phase 1.

---

## Parallel Execution Orchestration (droid exec)

Run from repo root `/Users/Richard.Luo4/Developer/budgetzilla`. Model: `claude-opus-4-8`, reasoning `high`.

Each worker is told: read this plan, implement ONLY its section, no git writes, no build/test.

```bash
PLAN="docs/superpowers/plans/2026-07-08-ui-redesign-electric-blue.md"
WEBAPP="/Users/Richard.Luo4/Developer/budgetzilla/webapp"
COMMON="Read $PLAN. NO git add/commit/push/reset. Do NOT run npm build, npm run typecheck, or vitest."

# Phase 1 - Foundation (blocking)
droid exec --cwd "$WEBAPP" --auto medium -m claude-opus-4-8 -r high \
  "$COMMON Implement ONLY the 'Phase 1: Foundation' section fully, including npm install of the fonts. You MAY run the Phase 1 verification commands. Print DONE-F when finished."

# Phase 2 - Shards (parallel)
for S in \
  "S1: MetricCard" \
  "S2: CashFlowCard" \
  "S3: BudgetCard" \
  "S4: Sidebar" \
  "S5: Charts" \
  "S6: Misc-decoration" \
  "S7: Recap"; do
  droid exec --cwd "$WEBAPP" --auto low -m claude-opus-4-8 -r high \
    "$COMMON Implement ONLY the shard section titled 'Shard $S'. Edit only that shard's files. Print DONE when finished." \
    > "/tmp/bz-shard-${S%%:*}.log" 2>&1 &
done
wait

# Phase 3 - Verify (blocking)
droid exec --cwd "$WEBAPP" --auto medium -m claude-opus-4-8 -r high \
  "$COMMON Implement ONLY the 'Phase 3: Verify' section. Run the tests, typecheck, and build; report pass/fail and any errors. Print DONE-V when finished."
```

Alternative (in-session): dispatch S1-S7 as parallel `worker` subagents in a single message after Phase 1 completes.

---

## Phase 1: Foundation

**Files:** `webapp/package.json`, `webapp/src/main.tsx`, `webapp/src/index.css`, `webapp/tailwind.config.cjs`, `webapp/src/theme/palette.ts`, `webapp/src/theme/chartPalette.ts` (new), `webapp/src/theme/chartPalette.test.ts` (new).

**Produces (consumed by shards):**
- Tailwind classes `font-sans`, `font-display`; CSS vars `--font-sans`, `--font-display`.
- Retuned tokens: `--primary`, `--hero` (blue), `--expense`, `--danger` (red), `--income`.
- Removed decoration utilities and rainbow palette vars.
- `theme/chartPalette.ts` exports: `type ChartTheme = "dark" | "light"`, `CHART_HIGHLIGHT`, `categoricalHighlightColors(count, highlightIndex, theme)`, `blueRamp(count)`, `chartSeriesColors(theme)`.

- [ ] **F1: Install fonts.** From `webapp/`: `npm install @fontsource-variable/inter @fontsource-variable/space-grotesk`

- [ ] **F2: Import fonts in `main.tsx`.** Change:
```ts
import { App } from "./App";
import { DatabaseProvider } from "./providers/DatabaseProvider";
import "./index.css";
```
to:
```ts
import { App } from "./App";
import { DatabaseProvider } from "./providers/DatabaseProvider";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./index.css";
```

- [ ] **F3: Font vars + body/headings in `index.css`.** Inside `@layer base { :root { ... } }`, right after `--titlebar-height: 0px;`, add:
```css
    --font-sans: "Inter Variable", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --font-display: "Space Grotesk Variable", var(--font-sans);
```
Replace the `body` rule:
```css
  body {
    @apply bg-background text-foreground;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    text-rendering: geometricPrecision;
  }
```
with:
```css
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-sans);
    text-rendering: geometricPrecision;
  }

  h1, h2, h3 {
    font-family: var(--font-display);
  }
```

- [ ] **F4: Tailwind `fontFamily`.** In `webapp/tailwind.config.cjs`, inside `theme.extend`, after the `borderRadius` block add:
```js
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"]
      },
```

- [ ] **F5: Retune `:root` (light) tokens in `index.css`.**
`--primary: 357 92% 56%;` → `--primary: 217 100% 59%;`
`--expense: 330 81% 45%;` → `--expense: 0 72% 51%;`
`--hero: 262 83% 55%;` → `--hero: 217 100% 59%;`
(Leave `--danger: 0 72% 51%;` unchanged in `:root`.)

- [ ] **F6: Retune `.dark` tokens in `index.css`.**
`--primary: 357 92% 56%;` → `--primary: 217 100% 59%;`
`--income: 160 71% 67%;` → `--income: 160 71% 45%;`
`--expense: 327 73% 90%;` → `--expense: 0 84% 65%;`
`--hero: 258 94% 85%;` → `--hero: 217 100% 66%;`
`--danger: 0 93% 81%;` → `--danger: 0 84% 65%;`

- [ ] **F7: Remove the animated background utilities in `index.css`.** Delete the entire `.surface-gradient { ... }` rule, its `@media (min-width: 1024px) { @media (prefers-reduced-motion: no-preference) { .surface-gradient { animation: grid-drift ... } } }` block, and the `@keyframes grid-drift { ... }` block.

- [ ] **F8: Remove tint + corner-glow utilities in `index.css`.** Delete `.tint-neutral`, `.tint-income`, `.tint-expense`, `.tint-accent`, `.tint-hero`, `.tint-warm`, `.corner-glow`, `.corner-glow::before`, `.corner-glow-hero`, `.corner-glow-hero::before`, `.corner-glow-hover`, `.corner-glow-hover::before`, and `.corner-glow-hover:hover::before, .corner-glow-hover:focus-visible::before`, plus the leading `/* Tint classes ... */` comment. Keep the `.text-balance` rule.

- [ ] **F9: Remove rainbow palette CSS vars in `index.css`.** In BOTH `:root` and `.dark`, delete these lines (and now-empty `/* Glow palette ... */` / `/* Chart + picker palettes */` comments):
```css
    --glow-neutral: 56, 189, 248;
    --glow-income: 52, 211, 153;
    --glow-expense: 244, 114, 182;
    --glow-accent: 246, 40, 50;
    --glow-hero: 167, 139, 250;
    --glow-warm: 251, 146, 60;
```
```css
    --palette-chart-categorical: #60a5fa, #a78bfa, #34d399, #fb7185, #fbbf24, #22d3ee, #c084fc, #f472b6, #93c5fd, #86efac;
    --palette-chart-tableau: #4E79A7, #F28E2B, #E15759, #76B7B2, #59A14F, #EDC948, #B07AA1, #FF9DA7;
```
KEEP `--palette-category-colors: ...;` in both blocks.

- [ ] **F10: Prune `theme/palette.ts`.** Delete `export type GlowKind`, `DEFAULT_GLOW`, `getGlowRgbTriplet`, `DEFAULT_CHART_CATEGORICAL`, `getChartCategoricalPalette`, `DEFAULT_CHART_TABLEAU`, `getChartTableauPalette`. Keep `readCssVar`, `readCssList`, `DEFAULT_CATEGORY_COLORS`, `getCategoryColorOptions`.

- [ ] **F11: Create `webapp/src/theme/chartPalette.ts`:**
```ts
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
```

- [ ] **F12: Create `webapp/src/theme/chartPalette.test.ts`:**
```ts
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
```

- [ ] **F13: Phase 1 verification.** From `webapp/`: `npx vitest run src/theme/chartPalette.test.ts && npm run typecheck && npm run build`. All must pass. Print `DONE-F`.

---

## Shard S1: MetricCard

**Files:** `webapp/src/components/dashboard/MetricCard.tsx` only. **No git writes, no build.**

- [ ] **S1.1** Read the current file first (it was edited externally before).
- [ ] **S1.2** Delete the import `import dotsOverlayUrl from "@/assets/dashboard/dots-overlay.svg";`
- [ ] **S1.3** Delete the dots overlay block:
```tsx
      {showDots && (
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.04]">
          <img src={dotsOverlayUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
```
- [ ] **S1.4** Replace the root `<div>` class list:
```tsx
      className={cn(
        "group relative overflow-hidden rounded-xl sm:rounded-squircle bg-card/85",
        variant === "hero" ? "corner-glow-hero shadow-surface-elevated" : "corner-glow shadow-surface",
        tone === "income" && "tint-income",
        tone === "expense" && "tint-expense",
        tone === "accent" && "tint-accent",
        tone === "neutral" && "tint-neutral",
        tone === "hero" && "tint-hero",
        tone === "warm" && "tint-warm",
        variant === "hero" ? "p-6 md:p-7 hover:-translate-y-1" : "p-5 hover:-translate-y-0.5",
        "transition-all duration-200 ease-out",
        "hover:bg-card/90 hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
```
with:
```tsx
      className={cn(
        "group relative overflow-hidden rounded-xl sm:rounded-squircle border border-border/60 bg-card/85",
        variant === "hero" ? "shadow-surface-elevated" : "shadow-surface",
        variant === "hero" ? "p-6 md:p-7 hover:-translate-y-1" : "p-5 hover:-translate-y-0.5",
        "transition-all duration-200 ease-out",
        "hover:bg-card/90 hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
```
- [ ] **S1.5** Normal-case the eyebrow label:
```tsx
              "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80",
              variant === "hero" && "text-xs text-foreground/70",
```
→
```tsx
              "text-xs font-semibold text-muted-foreground/80",
              variant === "hero" && "text-foreground/70",
```
- [ ] **S1.6** Neutralize the icon chip tone classes:
```tsx
                  "bg-background/40 text-muted-foreground",
                  tone === "income" && "bg-income/10 text-income",
                  tone === "expense" && "bg-expense/10 text-expense",
                  tone === "accent" && "bg-primary/10 text-primary",
                  tone === "hero" && "bg-hero/10 text-hero",
                  tone === "warm" && "bg-warm/10 text-warm",
```
→
```tsx
                  "bg-background/40 text-muted-foreground",
```
- [ ] **S1.7** Display font on the value: change `"mt-2 font-semibold tracking-tight tabular-nums",` → `"mt-2 font-display font-semibold tracking-tight tabular-nums",`
- [ ] **S1.8** Blue sparkline wrapper:
```tsx
        <div
          className={cn(
            "-mr-3 flex shrink-0 self-center flex-col items-end gap-2",
            tone === "income" && "text-income",
            tone === "expense" && "text-expense",
            tone === "accent" && "text-primary",
            tone === "hero" && "text-hero",
          )}
        >
```
→
```tsx
        <div className="-mr-3 flex shrink-0 self-center flex-col items-end gap-2 text-primary">
```
- [ ] **S1.9** Neutralize the savings badge:
```tsx
              <div className="rounded-lg bg-warm/10 px-1.5 py-0.5 text-[10px] font-bold text-warm uppercase tracking-wider">
```
→
```tsx
              <div className="rounded-lg bg-income/10 px-1.5 py-0.5 text-[10px] font-bold text-income">
```
Print `DONE`.

---

## Shard S2: CashFlowCard

**Files:** `webapp/src/components/dashboard/CashFlowCard.tsx` only. **No git writes, no build.**

- [ ] **S2.1** Label → normal case:
```tsx
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
          {label}
        </div>
```
→
```tsx
        <div className="text-xs font-semibold text-muted-foreground/60">
          {label}
        </div>
```
- [ ] **S2.2** Value → display font:
```tsx
          <div className={cn("text-3xl font-bold tracking-tighter tabular-nums", valueColor)}>
```
→
```tsx
          <div className={cn("font-display text-3xl font-bold tracking-tight tabular-nums", valueColor)}>
```
- [ ] **S2.3** Savings badge → income tint, no caps:
```tsx
            <div className="rounded-full bg-warm/10 px-2 py-0.5 text-[10px] font-bold text-warm uppercase tracking-wider">
```
→
```tsx
            <div className="rounded-full bg-income/10 px-2 py-0.5 text-[10px] font-bold text-income">
```
- [ ] **S2.4** Delta caption → normal case:
```tsx
          <div className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">
            {delta.label}
          </div>
```
→
```tsx
          <div className="text-[11px] font-medium text-muted-foreground/50">
            {delta.label}
          </div>
```
Print `DONE`.

---

## Shard S3: BudgetCard

**Files:** `webapp/src/components/dashboard/BudgetCard.tsx` only. **No git writes, no build.**

- [ ] **S3.1** Delete imports:
```tsx
import dividerWaveUrl from "@/assets/dashboard/divider-wave.svg";
import dotsOverlayUrl from "@/assets/dashboard/dots-overlay.svg";
```
- [ ] **S3.2** Replace the `motion.div` opener (remove infinite pulse, glow, tint; add border):
```tsx
    <motion.div
      role="region"
      aria-label="Budget tracking card"
      animate={overspent ? { scale: [1, 1.01, 1] } : {}}
      transition={overspent ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
      className={cn(
        "group relative overflow-hidden rounded-xl sm:rounded-squircle bg-card/85",
        "p-6 md:p-7 corner-glow-hero tint-hero shadow-surface-elevated",
        "transition-all duration-300 ease-out hover:-translate-y-1",
        "hover:bg-card/90 hover:shadow-surface-elevated",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        overspent && "ring-2 ring-danger/20",
        className,
      )}
    >
```
with:
```tsx
    <motion.div
      role="region"
      aria-label="Budget tracking card"
      className={cn(
        "group relative overflow-hidden rounded-xl sm:rounded-squircle border border-border/60 bg-card/85",
        "p-6 md:p-7 shadow-surface-elevated",
        "transition-all duration-300 ease-out hover:-translate-y-1",
        "hover:bg-card/90 hover:shadow-surface-elevated",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        overspent && "ring-2 ring-danger/40",
        className,
      )}
    >
```
- [ ] **S3.3** Delete the dots + wave overlay elements:
```tsx
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12] dark:opacity-[0.08]">
        <img src={dotsOverlayUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div aria-hidden className="pointer-events-none absolute bottom-10 left-0 right-0 opacity-60 dark:opacity-50">
        <img src={dividerWaveUrl} alt="" className="w-full" />
      </div>
```
- [ ] **S3.4** Icon chip → blue:
```tsx
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-hero/10 text-hero">
```
→
```tsx
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-primary/10 text-primary">
```
- [ ] **S3.5** Remaining amount → display font + blue/red:
```tsx
                className={cn(
                  "mt-1 text-4xl font-semibold tracking-tight tabular-nums",
                  overspent ? "text-warning" : "text-hero",
                )}
```
→
```tsx
                className={cn(
                  "mt-1 font-display text-4xl font-semibold tracking-tight tabular-nums",
                  overspent ? "text-danger" : "text-primary",
                )}
```
- [ ] **S3.6** Progress fill on-track → blue:
```tsx
                className={cn("h-full rounded-full", overspent ? "bg-danger" : ratio >= 0.75 ? "bg-warning" : "bg-hero")}
```
→
```tsx
                className={cn("h-full rounded-full", overspent ? "bg-danger" : ratio >= 0.75 ? "bg-warning" : "bg-primary")}
```
Print `DONE`.

---

## Shard S4: Sidebar

**Files:** `webapp/src/components/layout/Sidebar.tsx`, `webapp/src/components/layout/SidebarNavItem.tsx`. **No git writes, no build.**

- [ ] **S4.1** In `Sidebar.tsx`, delete the four `iconClassName` lines from the `SidebarNavItem` usages:
```tsx
          iconClassName="text-blue-500"
```
```tsx
          iconClassName="text-emerald-500"
```
```tsx
          iconClassName="text-orange-500"
```
```tsx
          iconClassName="text-slate-500"
```
- [ ] **S4.2** In `SidebarNavItem.tsx`, add a blue active-icon class. Replace:
```tsx
      <span
        className={cn(
          "opacity-70 group-hover:opacity-100 [&>svg]:h-5 [&>svg]:w-5 transition-opacity",
          iconClassName,
          collapsed ? "grid h-full w-full place-items-center" : "inline-flex items-center justify-center",
          "[&>svg]:block",
        )}
      >
```
with:
```tsx
      <span
        className={cn(
          "opacity-70 group-hover:opacity-100 [&>svg]:h-5 [&>svg]:w-5 transition-opacity",
          iconClassName,
          isCurrentlyActive && "text-primary opacity-100",
          collapsed ? "grid h-full w-full place-items-center" : "inline-flex items-center justify-center",
          "[&>svg]:block",
        )}
      >
```
(`isCurrentlyActive` already exists at the top of the component. Leave the `iconClassName` prop in the signature.)
Print `DONE`.

---

## Shard S5: Charts

**Files:** `webapp/src/components/dashboard/DashboardCharts.tsx` only. Depends on `theme/chartPalette.ts` (Phase 1). **No git writes, no build.**

- [ ] **S5.1** Replace the import:
```tsx
import { getChartCategoricalPalette, getChartTableauPalette, getGlowRgbTriplet } from "@/theme/palette";
```
with:
```tsx
import { categoricalHighlightColors, blueRamp, chartSeriesColors, CHART_HIGHLIGHT } from "@/theme/chartPalette";
```
- [ ] **S5.2** Replace the palette/color memos:
```tsx
  const chartCategoricalPalette = React.useMemo(() => getChartCategoricalPalette(), [theme]);
  const chartTableauPalette = React.useMemo(() => getChartTableauPalette(), [theme]);

  const incomeRgb = React.useMemo(() => getGlowRgbTriplet("income"), [theme]);
  const expenseRgb = React.useMemo(() => getGlowRgbTriplet("expense"), [theme]);
  const incomeColor = `rgb(${incomeRgb})`;
  const expenseColor = `rgb(${expenseRgb})`;
  const incomeArea = `rgba(${incomeRgb},0.10)`;
  const expenseArea = `rgba(${expenseRgb},0.10)`;
```
with:
```tsx
  const chartTheme = theme === "dark" ? "dark" : "light";
  const series = React.useMemo(() => chartSeriesColors(chartTheme), [chartTheme]);
  const incomeColor = series.income.line;
  const expenseColor = series.expense.line;
  const incomeArea = series.income.area;
  const expenseArea = series.expense.area;
```
- [ ] **S5.3** In the trend tooltip formatter, replace:
```tsx
color: ${netCents >= 0 ? "rgb(52, 211, 153)" : "rgb(244, 114, 182)"}
```
with:
```tsx
color: ${netCents >= 0 ? incomeColor : expenseColor}
```
- [ ] **S5.4** In `categoryBreakdownOption`, add before its `return {`:
```tsx
    const breakdownColors = categoricalHighlightColors(seriesData.length, seriesData.length - 1, chartTheme);
```
Replace the bar color callback:
```tsx
            color: (params: any) => {
              return chartCategoricalPalette[params.dataIndex % chartCategoricalPalette.length];
            },
```
with:
```tsx
            color: (params: any) => breakdownColors[params.dataIndex] ?? CHART_HIGHLIGHT,
```
Update that memo dep array: `}, [allowAnimation, baseText, chartCategoricalPalette, charts.categoryBreakdown, theme]);` → `}, [allowAnimation, baseText, chartTheme, charts.categoryBreakdown, theme]);`
- [ ] **S5.5** In `categoryMonthlyOption`, replace `const palette = chartTableauPalette;` with `const palette = blueRamp(finalSeries.length);` and update its dep array: `}, [allowAnimation, baseText, chartTableauPalette, charts.categoryMonthly, theme]);` → `}, [allowAnimation, baseText, chartTheme, charts.categoryMonthly, theme]);`
- [ ] **S5.6** In `categoryRankItems`, replace `const palette = chartCategoricalPalette.slice(0, 6);` with `const palette = categoricalHighlightColors(result.length, 0, chartTheme);` and update its dep array: `}, [categories, chartCategoricalPalette, charts.categoryShare]);` → `}, [categories, chartTheme, charts.categoryShare]);`
Print `DONE`.

---

## Shard S6: Misc-decoration

**Files:** `webapp/src/components/layout/AppShell.tsx`, `webapp/src/components/transactions/TransactionsTable.tsx`, `webapp/src/pages/Settings.tsx`, `webapp/src/components/dashboard/QuickInsights.tsx`. **No git writes, no build.**

- [ ] **S6.1** `AppShell.tsx`: `<div className="min-h-screen bg-background surface-gradient">` → `<div className="min-h-screen bg-background">`
- [ ] **S6.2** `TransactionsTable.tsx` (~line 474): `<div className="relative overflow-hidden rounded-squircle bg-card/85 shadow-surface corner-glow tint-neutral">` → `<div className="relative overflow-hidden rounded-squircle bg-card/85 shadow-surface">`
- [ ] **S6.3** `Settings.tsx` `Card` component: replace:
```tsx
  const tintClass = {
    neutral: "tint-neutral",
    income: "tint-income",
    expense: "tint-expense",
    accent: "tint-accent",
    hero: "tint-hero",
    warm: "tint-warm",
  }[tint];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-squircle bg-card/85 p-6 shadow-surface",
        "corner-glow",
        tintClass,
        "transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-card/90 hover:shadow-surface-elevated",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight uppercase tracking-[0.12em] text-muted-foreground/80">
```
with:
```tsx
  void tint;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-squircle bg-card/85 p-6 shadow-surface",
        "transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-card/90 hover:shadow-surface-elevated",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-muted-foreground/80">
```
(Keep the `tint` prop and `CardTint` type; do not touch call sites.)
- [ ] **S6.4** `QuickInsights.tsx`: remove the glow line:
```tsx
        "group relative overflow-hidden rounded-xl sm:rounded-2xl border border-border/60 bg-card/85 p-5",
        "corner-glow tint-neutral",
```
→
```tsx
        "group relative overflow-hidden rounded-xl sm:rounded-2xl border border-border/60 bg-card/85 p-5",
```
And normal-case the header:
```tsx
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
```
→
```tsx
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
```
Print `DONE`.

---

## Shard S7: Recap (Phase 2 additive)

**Files:** `webapp/src/components/recap/useRecapStats.ts` (new), `webapp/src/components/recap/useRecapStats.test.ts` (new), `webapp/src/components/recap/RecapHero.tsx` (new), `webapp/src/pages/Dashboard.tsx`. **No git writes, no build.**

- [ ] **S7.1** Create `webapp/src/components/recap/useRecapStats.ts`:
```ts
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
```
- [ ] **S7.2** Create `webapp/src/components/recap/useRecapStats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildRecapStats } from "./useRecapStats";

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
```
- [ ] **S7.3** Create `webapp/src/components/recap/RecapHero.tsx`:
```tsx
import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { RecapStat } from "./useRecapStats";

export function RecapHero({ stats, onClose }: { stats: RecapStat[]; onClose: () => void }) {
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toneClass = (tone: RecapStat["tone"]) =>
    tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : "text-foreground";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Period recap"
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Close recap"
        className="fixed right-6 top-6 z-10"
      >
        <X className="h-5 w-5" />
      </Button>

      <div className="mx-auto flex max-w-3xl flex-col gap-[40vh] px-6 py-[30vh]">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-primary">Your recap</h2>
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={reduce ? false : { opacity: 0, y: 40 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : Math.min(i * 0.05, 0.2) }}
          >
            <div className="text-sm font-medium text-muted-foreground">{s.label}</div>
            <div className={cn("font-display text-5xl font-bold tabular-nums sm:text-7xl", toneClass(s.tone))}>
              {s.value}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
```
- [ ] **S7.4** Wire the entry point in `webapp/src/pages/Dashboard.tsx`. FIRST read the file and identify the in-scope variables holding total income cents, total expense cents, net cents, and the sorted category share/breakdown array (the same data passed to `CashFlowSummary` and `DashboardChartsView`). Add imports:
```tsx
import { RecapHero } from "@/components/recap/RecapHero";
import { buildRecapStats } from "@/components/recap/useRecapStats";
```
Add state near the other hooks: `const [recapOpen, setRecapOpen] = React.useState(false);`
Add the memo (adapt field names to the file's actual data):
```tsx
  const recapStats = React.useMemo(() => {
    const top = charts?.categoryShare?.[0];
    return buildRecapStats({
      incomeCents: summary?.incomeCents ?? 0,
      expenseCents: summary?.expenseCents ?? 0,
      netCents: summary?.netCents ?? 0,
      topCategoryName: top?.categoryName ?? null,
      topCategoryCents: top?.totalCents ?? 0,
    });
  }, [summary, charts]);
```
Add a trigger `Button` in the dashboard header actions:
```tsx
        <Button variant="secondary" size="sm" onClick={() => setRecapOpen(true)}>
          View recap
        </Button>
```
Render at the end of the returned JSX: `{recapOpen && <RecapHero stats={recapStats} onClose={() => setRecapOpen(false)} />}`
Print `DONE`.

---

## Phase 3: Verify

**Single worker. No git writes.**

- [ ] **V1** From `webapp/`: `npx vitest run` — all tests pass (chartPalette, useRecapStats, existing date-picker).
- [ ] **V2** From `webapp/`: `npm run typecheck` — passes. If `Dashboard.tsx` references non-existent `summary`/`charts` fields, fix the `recapStats` memo to use the real field names surfaced by the file (do not invent fields).
- [ ] **V3** From `webapp/`: `npm run build` — passes.
- [ ] **V4** Visual (both themes): `npm run dev` → `http://localhost:5173/dashboard`. Confirm: blue brand accents, green income / red expense, no animated background / corner glow / dots / wave, Space Grotesk headings + money, neutral+blue charts, single-color sidebar icons with blue active state, and "View recap" opens the cinematic overlay. Report results. Print `DONE-V`.

---

## Self-Review

**Spec coverage:** brand blue (F5/F6, S3/S4), green/red semantics (F5/F6, S1-S3, S5), remove hero/glow/rainbow (F7/F8/F9/F10, S1/S3/S6), hybrid charts (F11, S5), surfaces/light glow (F5-F9, S6), typography (F1-F4, S1/S2/S3), decoration+motion (F7/F8, S3/S6), components (S1-S6), Recap Hero (S7), scope/non-goals (Global Constraints).

**Placeholder scan:** No TBD/TODO; all code steps include full code. S7.4 adapts to real `Dashboard.tsx` field names, guarded by reading the file first and by the Phase 3 build gate.

**Type consistency:** `chartPalette.ts` exports (F11) match S5 consumers. `RecapStat`/`buildRecapStats` (S7.1) match S7.2/S7.3/S7.4.

**Parallel safety:** every Phase 2 shard owns a disjoint file set; `index.css`/`tailwind.config.cjs` only in Phase 1; builds/tests only in Phase 1 and Phase 3.
