import React from "react";
import { Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { AnimatedMoneyCents } from "@/components/motion/AnimatedNumber";
import type { MetricDelta } from "./MetricCard";

type CashFlowStatProps = {
  label: string;
  cents: number;
  delta?: MetricDelta;
  tone: "income" | "expense" | "neutral";
  showSavingsRate?: number;
};

function CashFlowStat({ label, cents, delta, tone, showSavingsRate }: CashFlowStatProps) {
  const valueColor = {
    income: "text-income",
    expense: "text-expense",
    neutral: cents >= 0 ? "text-income" : "text-expense",
  }[tone];

  return (
    <div className="group/stat flex items-center justify-between gap-8 py-2">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
          {label}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <div className={cn("text-3xl font-bold tracking-tighter tabular-nums", valueColor)}>
            <AnimatedMoneyCents cents={cents} />
          </div>
          {showSavingsRate !== undefined && (
            <div className="rounded-full bg-warm/10 px-2 py-0.5 text-[10px] font-bold text-warm uppercase tracking-wider">
              {Math.round(showSavingsRate * 100)}% Saved
            </div>
          )}
        </div>
      </div>

      {delta && (
        <div className="text-right">
          <div
            className={cn(
              "flex items-center justify-end gap-1 text-sm font-bold tabular-nums",
              delta.intent === "positive" && "text-income",
              delta.intent === "negative" && "text-danger",
              delta.intent === "neutral" && "text-muted-foreground",
            )}
          >
            {delta.intent === "positive" ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : delta.intent === "negative" ? (
              <ArrowDownRight className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            {delta.valueText}
          </div>
          <div className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">
            {delta.label}
          </div>
        </div>
      )}
    </div>
  );
}

export function CashFlowSummary({
  incomeCents,
  expenseCents,
  netCents,
  incomeDelta,
  expenseDelta,
  netDelta,
  savingsRate,
  className,
}: {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  incomeDelta?: MetricDelta;
  expenseDelta?: MetricDelta;
  netDelta?: MetricDelta;
  savingsRate?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-center px-2 divide-y divide-border/10", className)}>
      <CashFlowStat label="Income" cents={incomeCents} delta={incomeDelta} tone="income" />
      <CashFlowStat label="Expenses" cents={expenseCents} delta={expenseDelta} tone="expense" />
      <CashFlowStat
        label="Net"
        cents={netCents}
        delta={netDelta}
        tone="neutral"
        showSavingsRate={savingsRate}
      />
    </div>
  );
}
