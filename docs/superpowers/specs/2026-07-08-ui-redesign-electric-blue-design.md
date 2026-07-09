# Budgetzilla UI Redesign: Electric-Blue Fintech-Cinematic

**Date:** 2026-07-08
**Status:** Approved design, pending implementation plan
**Supersedes (partially):** `docs/src/content/docs/reference/redesign-plan.md` (Apple-blue `#0071e3`, decoration-preserving). This spec keeps that plan's reductive intent but replaces its color, typography, and decoration decisions.

## 1. Problem & North Star

The current UI "feels like AI slop." Concretely, three things fight each other:

1. **Two design languages at once.** An Apple-cinematic decoration layer (animated grid background, dotted overlays, wave dividers, colored corner "light leaks") sits on top of a dense fintech dashboard. Neither wins.
2. **A rainbow accent system.** `--primary` is Netflix red, `--hero` is purple, `--expense` is magenta/pink, plus green income, amber warm, cyan neutral glows, and two multi-hue chart palettes. There is no single brand color, so nothing reads as intentional.
3. **Ambient motion without meaning.** A 45s looping background drift and idle pulses add movement that carries no information.

**North Star:** a Robinhood/Netflix hybrid: one disciplined electric-blue brand color, green/red reserved strictly for money direction, data as the hero, decoration subtracted, and motion that is purposeful only. Both themes are first-class: dark is a deep cinematic charcoal, light is a clean near-white.

### Design Principles

- **One brand color.** Electric blue is the only interactive/brand color. Everything clickable or "on-brand" is blue.
- **Semantic color is money-only.** Green = positive/income, red = negative/expense. Never decorative.
- **Data is the hero.** Remove anything that competes with the numbers and charts.
- **Purposeful motion.** Count-ups, chart draw-in, hover feedback. No ambient loops. Always honor `prefers-reduced-motion`.
- **Both themes first-class.** Redesign light into a clean near-white surface, not an afterthought.

## 2. Color System

### 2.1 Brand / Interactive

- **Electric blue** `#2F80FF` ≈ `hsl(217 100% 59%)`.
- Applies to: `--primary`, `--ring` (focus), links, active nav item, selection highlights, primary buttons, primary progress fills, chart highlight, default sparkline stroke.
- Replaces the current Netflix-red `--primary` (`357 92% 56%`) in **both** themes.
- `--primary-foreground`: white (`0 0% 100%`).

### 2.2 Semantic (money direction only)

| Token | Role | Light | Dark |
|-------|------|-------|------|
| `--income` | positive / income | `160 84% 28%` (keep) | `160 71% 45%` (retune from pale `67%` for legibility on charcoal) |
| `--expense` | negative / expense | `0 72% 51%` (true red, aligned to danger) | `0 84% 65%` |
| `--danger` | destructive / over-budget | `0 72% 51%` (keep) | `0 84% 65%` (align to expense) |
| `--warning` / `--caution` | budget approaching-limit only | keep amber | keep amber |

`--expense` moves from today's magenta/pink (`330°` / `327°`) to red. Rationale: with brand no longer red, red is freed for the universal "money out / negative" meaning. Net values remain green-or-red by sign.

### 2.3 Removed / Neutralized

- **Delete** `--hero` (purple) and its `--hero-foreground`. The "north star" budget card becomes a neutral surface with a blue accent.
- **Delete** the multi-hue glow palette: `--glow-income`, `--glow-expense`, `--glow-hero`, `--glow-warm`, `--glow-neutral` and the `.tint-*` classes that consume them.
- **Delete** `--palette-chart-categorical` (10-color rainbow) and `--palette-chart-tableau` (8-color). Replace with the ramps in 2.4.
- `--warm` is retained only if still referenced for the savings-rate badge; that badge should instead use a neutral or income tint (see 5.2). Remove the warm **background** glow entirely.

### 2.4 Chart Palette (hybrid neutral + highlight)

- **Categorical (e.g., spend-by-category):** default every slice/bar to a **neutral gray** ramp; highlight the focused or largest item in brand blue. This is the "hybrid neutral + highlight" model.
  - `--chart-neutral`: mid gray keyed off `--muted-foreground`.
  - `--chart-highlight`: brand blue `#2F80FF`.
- **Single-hue blue ramp** (when a true multi-series categorical view is unavoidable): `#2F80FF, #5B9BFF, #85B6FF, #AFD0FF, #D6E6FF` (light→ordered by magnitude).
- **Flow series (income vs expense over time):** income = green, expense = red. No other hues.

### 2.5 Surfaces & Background

- **Dark:** keep deep charcoal (`--background: 240 7% 7%`, `--card: 240 7% 10%`). Blue accent pops against it.
- **Light:** clean near-white. Keep `--background` near `210 35% 98%` but **remove** the warm amber radial glow from `.surface-gradient`. Light surfaces get subtle shadow + hairline border for separation, no texture.

## 3. Typography

### 3.1 Faces

- **Display:** **Space Grotesk** — headings (h1-h3), KPI/money values, card titles. Weights 500 / 600 / 700. Distinctive fintech character (Robinhood-adjacent).
- **Body / UI:** **Inter** — labels, tables, body copy, captions. (App currently uses `system-ui`; switch to Inter.)

### 3.2 Loading (offline-first)

Budgetzilla is local-first and works offline (OPFS). Do **not** depend on the Google Fonts CDN. Self-host:

- `@fontsource-variable/inter`
- `@fontsource/space-grotesk` (weights 500/600/700)

Import in `main.tsx`. Expose CSS variables and wire into Tailwind:

```css
/* index.css @layer base :root */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-display: "Space Grotesk", var(--font-sans);
```

```js
// tailwind.config.cjs theme.extend.fontFamily
fontFamily: {
  sans: ["var(--font-sans)"],
  display: ["var(--font-display)"],
}
```

`body` uses `--font-sans`. Headings, KPI values, and card titles use `font-display`.

### 3.3 Type Scale

| Role | Face | Size | Weight | Notes |
|------|------|------|--------|-------|
| Display XL (recap hero) | Space Grotesk | 48-56px | 600 | recap surface only |
| Display L (net worth / primary KPI) | Space Grotesk | 36-40px | 600 | tabular-nums |
| H1 (page title) | Space Grotesk | 28px | 600 | |
| H2 (section) | Space Grotesk | 20px | 600 | |
| Card title / KPI value | Space Grotesk | 16-18px | 600 | tabular-nums for money |
| Body | Inter | 14-15px | 400 | |
| Label / caption | Inter | 12-13px | 500 | **normal case** |
| Eyebrow (sparing) | Inter | 11-12px | 600 | uppercase, tracking `0.08em`, used rarely |

### 3.4 Micro-caps Cleanup

The pervasive `uppercase tracking-[0.2em]` / `[0.12em]` labels are a primary "slop" signal. Convert most labels to normal-case Inter at comfortable tracking. Reserve uppercase eyebrows for at most one label per card/section.

## 4. Decoration Removal & Motion Policy

### 4.1 Remove

- `grid-drift` animated background and its keyframes (the 45s loop in `.surface-gradient`).
- `dots-overlay.svg` usage on cards (`MetricCard`, `BudgetCard`).
- `divider-wave.svg` (`BudgetCard`).
- `.corner-glow`, `.corner-glow-hero`, `.corner-glow-hover` colored light-leaks and the `.tint-*` classes.

### 4.2 Replace With

- Flat card surfaces + one subtle shadow (`--shadow-soft`, `--shadow-lift`).
- Hairline borders (`--border`) only where separation is genuinely needed.

### 4.3 Keep

- `AnimatedNumber` / `AnimatedMoneyCents` count-ups.
- Chart draw-in on load.
- Subtle hover lift (`hover:-translate-y-0.5`).
- Over-budget alert: keep as a **meaningful** signal but tone down (single subtle pulse or static red ring rather than an infinite loop).

### 4.4 Reduced Motion

All motion sits behind `prefers-reduced-motion: no-preference`. With reduced motion, values render at final state, charts draw statically, no hover translate.

## 5. Component Changes

### 5.1 MetricCard (`components/dashboard/MetricCard.tsx`)

- Remove `corner-glow`/`corner-glow-hero`, `showDots`/dots overlay, and all `tone`-driven `.tint-*` classes.
- Neutral card surface; sparkline stroke = brand blue; deltas keep green (positive) / red (negative) / muted (neutral).
- Keep the `useAutoScaleText` value autoscaling and tabular-nums.
- Title label → normal-case Inter (drop `uppercase tracking-[0.12em]`), optionally one uppercase eyebrow.

### 5.2 CashFlowCard (`components/dashboard/CashFlowCard.tsx`)

- Replace `text-[10px] uppercase tracking-[0.2em]` labels with clean normal-case Inter labels.
- Income = green, Expenses = red, Net = green-or-red by sign (semantics unchanged).
- Savings-rate badge: swap `bg-warm/10 text-warm` for a neutral or income-tinted treatment.

### 5.3 BudgetCard (`components/dashboard/BudgetCard.tsx`)

- Remove `tint-hero`, `corner-glow-hero`, dots overlay, and wave divider.
- Neutral elevated surface with blue accent for the "north star" role.
- Progress bar states: blue (on track / neutral) → amber (`--caution`/`--warning` at approaching limit) → red (`--danger` over budget).
- Over-budget: static red ring + at most one subtle pulse (see 4.3), not an infinite `scale` loop.

### 5.4 Sidebar (`components/layout/Sidebar.tsx`, `SidebarNavItem.tsx`)

- Remove per-item rainbow icon tints (`text-blue-500`, `text-emerald-500`, `text-orange-500`, `text-slate-500`).
- Icons use a single muted foreground color; the **active** item uses brand blue (text + subtle blue background).

### 5.5 Charts (`components/dashboard/DashboardCharts.tsx`, `QuickInsights.tsx`)

- Apply the 2.4 palette: categorical → neutral gray with blue highlight; income/expense flow series → green/red.
- Remove references to the rainbow categorical/tableau palettes.
- Axis/label/gridline colors keyed off `--muted-foreground` / `--border` for both themes.

## 6. Additive Cinematic Recap Hero (Phase 2)

A separate, opt-in **Period Recap** surface (e.g., a monthly wrap-up) is where the Apple-style scroll storytelling belongs — **not** the daily dashboard.

- New `RecapHero` component with its own entry point (a "View recap" action; the exact route is chosen during the implementation plan).
- Scroll-progress sequentially reveals a handful of key stats (total in/out, net, top category, biggest change) at Display XL scale on a full-bleed charcoal/near-white backdrop.
- Uses the same token system (blue brand, green/red semantics, Space Grotesk display). No new colors.
- Fully skippable and behind `prefers-reduced-motion` (reduced motion → static stacked summary).
- **Additive only:** does not alter dashboard data flow; reads the same dashboard aggregates.

## 7. Scope, Non-Goals, Files

### Files Touched (core redesign)

- `webapp/src/index.css` — token updates (2.1-2.5, 3.2), remove decoration utilities (4.1).
- `webapp/tailwind.config.cjs` — `fontFamily`, prune glow shadow/palette tokens.
- `webapp/src/main.tsx` — font imports; `package.json` — add `@fontsource-variable/inter`, `@fontsource/space-grotesk`.
- `webapp/src/components/dashboard/MetricCard.tsx`
- `webapp/src/components/dashboard/CashFlowCard.tsx`
- `webapp/src/components/dashboard/BudgetCard.tsx`
- `webapp/src/components/layout/Sidebar.tsx`, `SidebarNavItem.tsx`
- `webapp/src/components/dashboard/DashboardCharts.tsx`, `QuickInsights.tsx`

### New (additive)

- `webapp/src/components/recap/RecapHero.tsx` (+ entry point/route).

### Non-Goals

- Page-architecture consolidation from the older redesign plan (keep the current 4-page structure).
- Data-model / API changes.
- No app-code committed until the implementation plan is approved (only this design doc is committed now).

## 8. Success Criteria

- A single brand color (electric blue) is the only interactive/brand hue; green/red appear only on money direction.
- No animated background, dotted overlays, wave dividers, or colored corner glows remain.
- Headings and money values render in Space Grotesk; body/labels in Inter; fonts load offline.
- Micro-caps `tracking-[0.2em]` labels are gone except sparing eyebrows.
- Charts use neutral+blue-highlight (categorical) and green/red (flows) in both themes.
- Light and dark themes both look intentional and clean; light drops the warm glow.
- The cinematic treatment exists only in the additive Recap Hero, not the daily dashboard.
- `prefers-reduced-motion` is honored everywhere.
