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
