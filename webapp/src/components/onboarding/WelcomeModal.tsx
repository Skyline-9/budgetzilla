import React from "react";
import { Target, TrendingUp, PieChart, Lightbulb, Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "budget-app-onboarding-complete";

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-hero/10 text-hero ring-1 ring-hero/30">
        {icon}
      </div>
      <div>
        <div className="font-semibold text-foreground/90">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

export function WelcomeModal() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      setOpen(true);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to Budget</DialogTitle>
          <DialogDescription>
            Your personal finance dashboard. Here's a quick overview of what you can do.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <FeatureItem
            icon={<Target className="h-5 w-5" />}
            title="Track Your Budget"
            description="Set monthly budgets and see your spending progress at a glance. The budget card shows remaining funds and alerts you when approaching limits."
          />
          <FeatureItem
            icon={<TrendingUp className="h-5 w-5" />}
            title="Monitor Trends"
            description="View income vs expenses over time. Sparklines on each metric card show recent trends."
          />
          <FeatureItem
            icon={<PieChart className="h-5 w-5" />}
            title="Categorize Spending"
            description="Click any category in charts to filter transactions. Organize expenses into custom categories."
          />
          <FeatureItem
            icon={<Lightbulb className="h-5 w-5" />}
            title="Quick Insights"
            description="AI-powered insights highlight spending patterns, projections, and anomalies."
          />
        </div>

        <div className="mt-4 rounded-2xl border border-border/60 bg-background/30 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <span>Keyboard Shortcuts</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="rounded border border-border/60 bg-background/40 px-1.5 py-0.5 text-xs font-semibold">N</kbd>
              <span>Add transaction</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded border border-border/60 bg-background/40 px-1.5 py-0.5 text-xs font-semibold">Cmd+K</kbd>
              <span>Search</span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button onClick={handleComplete} className="w-full sm:w-auto">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
