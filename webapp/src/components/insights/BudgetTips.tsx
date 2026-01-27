import React from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Lightbulb, TrendingUp } from "lucide-react";
import type { BudgetTip } from "@/lib/analysis";
import { cn } from "@/lib/cn";

const typeConfig = {
  warning: {
    icon: AlertTriangle,
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-600 dark:text-orange-400",
    iconColor: "text-orange-500",
  },
  caution: {
    icon: TrendingUp,
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    iconColor: "text-amber-500",
  },
  info: {
    icon: Info,
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
    iconColor: "text-blue-500",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    iconColor: "text-emerald-500",
  },
};

function TipCard({ tip }: { tip: BudgetTip }) {
  const config = typeConfig[tip.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3",
        config.bg,
        config.border,
      )}
    >
      <div className={cn("mt-0.5 shrink-0", config.iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-semibold", config.text)}>{tip.title}</div>
        <div className="mt-0.5 text-xs text-foreground/70 leading-relaxed">{tip.message}</div>
      </div>
    </div>
  );
}

export function BudgetTips({
  tips,
  maxTips = 3,
  className,
}: {
  tips: BudgetTip[];
  maxTips?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const hasMore = tips.length > maxTips;
  const visibleTips = expanded ? tips : tips.slice(0, maxTips);

  if (!tips.length) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/85 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight mb-3">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-background/40 ring-1 ring-border/60 text-muted-foreground">
          <Lightbulb className="h-4 w-4" />
        </span>
        <span>Quick Tips</span>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <>
                Show less
                <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                +{tips.length - maxTips} more
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTips.map((tip) => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>
    </div>
  );
}
