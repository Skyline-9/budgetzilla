import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import dotsOverlayUrl from "@/assets/dashboard/dots-overlay.svg";

export type MetricDelta = {
  label: string; // e.g. "vs prior month"
  valueText: string; // e.g. "+$120"
  subText?: string; // e.g. "(+3.2%)"
  intent: "positive" | "negative" | "neutral";
};

function useAutoScaleText({
  minFontSizePx = 14,
  deps = [],
}: {
  minFontSizePx?: number;
  deps?: React.DependencyList;
}) {
  const textRef = React.useRef<HTMLSpanElement | null>(null);
  const maxFontSizePxRef = React.useRef<number | null>(null);
  const appliedFontSizePxRef = React.useRef<number | null>(null);
  const [fontSizePx, setFontSizePx] = React.useState<number | null>(null);

  const setApplied = React.useCallback((next: number | null) => {
    if (appliedFontSizePxRef.current === next) return;
    appliedFontSizePxRef.current = next;
    setFontSizePx(next);
  }, []);

  const recompute = React.useCallback(() => {
    const el = textRef.current;
    const container = el?.parentElement;
    if (!el || !container) return;

    // Avoid divisions by zero and noisy recomputes on hidden elements.
    const availableWidthPx = container.clientWidth;
    if (!availableWidthPx) return;

    // Ensure we have the baseline (unscaled) font size captured.
    const computedFontSizePx = Number.parseFloat(window.getComputedStyle(el).fontSize || "0");
    if (!computedFontSizePx) return;
    if (maxFontSizePxRef.current == null) maxFontSizePxRef.current = computedFontSizePx;

    const maxFontSizePx = maxFontSizePxRef.current;
    const renderedTextWidthPx = el.getBoundingClientRect().width;
    if (!renderedTextWidthPx) return;

    // Predict whether the text would fit at the baseline (max) font size.
    const predictedWidthAtMaxPx = renderedTextWidthPx * (maxFontSizePx / computedFontSizePx);

    // Small buffer to avoid jitter from sub-pixel rounding.
    const jitterBufferPx = 1;

    if (predictedWidthAtMaxPx <= availableWidthPx + jitterBufferPx) {
      // Fits at max size: use the CSS-defined font size (no inline override).
      setApplied(null);
      return;
    }

    // Scale down proportionally to fit.
    const nextFontSizePx = Math.floor((availableWidthPx * computedFontSizePx) / renderedTextWidthPx);
    const clampedPx = Math.max(minFontSizePx, Math.min(maxFontSizePx, nextFontSizePx));
    setApplied(clampedPx);
  }, [minFontSizePx, setApplied]);

  React.useLayoutEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recompute, ...deps]);

  React.useLayoutEffect(() => {
    const el = textRef.current;
    const container = el?.parentElement;
    if (!container) return;

    const ro = new ResizeObserver(() => recompute());
    ro.observe(container);
    return () => ro.disconnect();
  }, [recompute]);

  return {
    ref: textRef,
    style: fontSizePx != null ? ({ fontSize: `${fontSizePx}px` } as const) : undefined,
  };
}

function Sparkline({
  values: rawValues,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const width = 108;
  const height = 28;

  // Filter out any non-numeric values to avoid NaN in path
  const values = rawValues.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));

  // Create smooth curve using cubic bezier spline
  const tension = 0.3;
  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Simple control points to avoid excessive curvature outside bounds
    const cp1x = p1.x + (p2.x - p1.x) * tension;
    const cp1y = p1.y;
    const cp2x = p2.x - (p2.x - p1.x) * tension;
    const cp2y = p2.y;

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }

  return (
    <svg
      className={cn("h-7 w-[108px]", className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={d}
      />
    </svg>
  );
}

export function MetricCard({
  title,
  value,
  valueSubtle,
  delta,
  sparkline,
  savingsRate,
  tone = "neutral",
  variant = "default",
  emoji,
  icon,
  showDots = false,
  helpContent,
  className,
}: {
  title: string;
  value: React.ReactNode;
  valueSubtle?: React.ReactNode;
  delta?: MetricDelta;
  sparkline?: number[];
  savingsRate?: number;
  tone?: "income" | "expense" | "neutral" | "accent" | "hero" | "warm";
  variant?: "default" | "hero";
  emoji?: string;
  icon?: React.ReactNode;
  showDots?: boolean;
  helpContent?: React.ReactNode;
  className?: string;
}) {
  const valueText = useAutoScaleText({ deps: [value] });

  return (
    <div
      role="region"
      aria-label={`${title} metric card`}
      className={cn(
        "group relative overflow-hidden rounded-squircle bg-card/85",
        variant === "hero" ? "corner-glow-hero shadow-surface-elevated" : "corner-glow shadow-surface",
        tone === "income" && "tint-income",
        tone === "expense" && "tint-expense",
        tone === "accent" && "tint-accent",
        tone === "neutral" && "tint-neutral",
        tone === "hero" && "tint-hero",
        tone === "warm" && "tint-warm",
        variant === "hero" ? "p-6 md:p-7 hover:-translate-y-1" : "p-5 hover:-translate-y-0.5",
        "transition-all duration-300 ease-out",
        "hover:bg-card/90 hover:shadow-surface-elevated",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {showDots && (
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.04]">
          <img src={dotsOverlayUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="relative z-10 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div
            className={cn(
              "flex items-center gap-2",
              "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80",
              variant === "hero" && "text-xs text-foreground/70",
            )}
          >
            {icon ? (
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-xl",
                  "bg-background/40 text-muted-foreground",
                  tone === "income" && "bg-income/10 text-income",
                  tone === "expense" && "bg-expense/10 text-expense",
                  tone === "accent" && "bg-primary/10 text-primary",
                  tone === "hero" && "bg-hero/10 text-hero",
                  tone === "warm" && "bg-warm/10 text-warm",
                )}
              >
                {icon}
              </span>
            ) : emoji ? (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-xl bg-background/40 text-[13px]">
                {emoji}
              </span>
            ) : null}
            <span>{title}</span>
            {helpContent && <HelpTooltip content={helpContent} />}
          </div>
          <div
            className={cn(
              "mt-2 font-semibold tracking-tight tabular-nums",
              variant === "hero" ? "text-4xl sm:text-5xl" : "text-3xl",
            )}
          >
            <span
              ref={valueText.ref}
              className="inline-block whitespace-nowrap"
              style={valueText.style}
            >
              {value}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {valueSubtle ? (
              <div className={cn("text-xs text-foreground/50", variant === "hero" && "text-sm text-foreground/60")}>
                {valueSubtle}
              </div>
            ) : null}
            {savingsRate !== undefined && (
              <div className="rounded-lg bg-warm/10 px-1.5 py-0.5 text-[10px] font-bold text-warm uppercase tracking-wider">
                {Math.round(savingsRate * 100)}% Saved
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            "-mr-3 flex shrink-0 self-center flex-col items-end gap-2",
            tone === "income" && "text-income",
            tone === "expense" && "text-expense",
            tone === "accent" && "text-primary",
            tone === "hero" && "text-hero",
          )}
        >
          {sparkline?.length ? <Sparkline values={sparkline} className="opacity-60" /> : null}
        </div>
      </div>

      {delta ? (
        <div className={cn("mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", variant === "hero" && "text-sm")}>
          <span className="text-muted-foreground/70">{delta.label}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold tabular-nums",
              delta.intent === "positive" && "text-income",
              delta.intent === "negative" && "text-danger",
              delta.intent === "neutral" && "text-muted-foreground",
            )}
          >
            {delta.intent === "positive" && <TrendingUp className="h-3 w-3" aria-hidden />}
            {delta.intent === "negative" && <TrendingDown className="h-3 w-3" aria-hidden />}
            {delta.intent === "neutral" && <Minus className="h-3 w-3" aria-hidden />}
            {delta.valueText}
          </span>
          {delta.subText ? (
            <span className="text-muted-foreground/60 tabular-nums">{delta.subText}</span>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 text-xs text-muted-foreground/40">—</div>
      )}
    </div>
  );
}

