import React from "react";
import { Minus, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
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
    <div className="group/stat flex items-center justify-between gap-8">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-muted-foreground/60">
          {label}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <div className={cn("font-display text-3xl font-bold tracking-tight tabular-nums", valueColor)}>
            <AnimatedMoneyCents cents={cents} />
          </div>
          {showSavingsRate !== undefined && (
            <div className="rounded-full bg-income/10 px-2 py-0.5 text-[10px] font-bold text-income">
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
          <div className="text-[11px] font-medium text-muted-foreground/50">
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
    <Card
      hoverEffect="all"
      className={cn(
        "group relative overflow-hidden p-6 md:p-7",
        className,
      )}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 mb-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="h-4 w-4" />
          </span>
          <span>Cash Flow Summary</span>
        </div>
        
        <div className="divide-y divide-border/20">
          <div className="py-3">
            <CashFlowStat label="Income" cents={incomeCents} delta={incomeDelta} tone="income" />
          </div>
          <div className="py-3">
            <CashFlowStat label="Expenses" cents={expenseCents} delta={expenseDelta} tone="expense" />
          </div>
          <div className="py-3 pb-0">
            <CashFlowStat
              label="Net"
              cents={netCents}
              delta={netDelta}
              tone="neutral"
              showSavingsRate={savingsRate}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

