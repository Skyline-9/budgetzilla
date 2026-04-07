import React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useDeleteOverallBudgetMutation, useUpsertOverallBudgetMutation } from "@/api/queries";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMonthKey } from "@/lib/format";
import { parseMoneyToCents } from "@/lib/urlState";

const schema = z.object({
  budget: z
    .string()
    .min(1, "Budget is required")
    .refine((v) => {
      const cents = parseMoneyToCents(v);
      return cents !== undefined && cents >= 0;
    }, "Enter a non-negative amount"),
});

type Values = z.infer<typeof schema>;

function centsToInput(v: number) {
  const s = (v / 100).toFixed(2);
  return s.endsWith(".00") ? s.slice(0, -3) : s;
}

export function BudgetDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string; // YYYY-MM
  initialBudgetCents?: number | null;
}) {
  const { open, onOpenChange, month, initialBudgetCents } = props;
  const upsert = useUpsertOverallBudgetMutation();
  const del = useDeleteOverallBudgetMutation();
  const { confirm } = useConfirmDialog();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      budget: initialBudgetCents != null ? centsToInput(initialBudgetCents) : "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset({
      budget: initialBudgetCents != null ? centsToInput(initialBudgetCents) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, month, initialBudgetCents]);

  const submitting = upsert.isPending || del.isPending;

  async function onSubmit(v: Values) {
    const cents = parseMoneyToCents(v.budget);
    if (cents === undefined) return;
    await upsert.mutateAsync({ month, budgetCents: cents });
    onOpenChange(false);
  }

  async function onDelete() {
    const confirmed = await confirm({
      title: "Delete budget",
      description: `Are you sure you want to delete the budget for ${formatMonthKey(month)}? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;
    await del.mutateAsync(month);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Monthly Limit</DialogTitle>
          <DialogDescription>
            Your monthly budget is persistent and applies to every month.
          </DialogDescription>
        </DialogHeader>

        <form className="mt-6 space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 px-1">
                Monthly Spending Goal
              </Label>

              <div className="space-y-2">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground/40 transition-colors group-focus-within:text-primary/60">
                    $
                  </div>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    className="pl-10 h-12 text-xl font-bold rounded-xl bg-muted/30 border-none shadow-inner focus-visible:ring-2 focus-visible:ring-primary/20 transition-all tabular-nums"
                    {...form.register("budget", {
                      onChange: (e) => {
                        const val = e.target.value;
                        // Allow numbers and a single decimal point
                        const cleaned = val.replace(/[^0-9.]/g, "");
                        const parts = cleaned.split(".");
                        if (parts.length > 2) {
                          e.target.value = parts[0] + "." + parts.slice(1).join("");
                        } else {
                          e.target.value = cleaned;
                        }
                      },
                    })}
                  />
                </div>
                {form.formState.errors.budget?.message ? (
                  <div className="text-xs text-danger font-semibold px-1">{form.formState.errors.budget.message}</div>
                ) : (
                  <p className="text-[11px] text-muted-foreground/50 leading-relaxed px-1">
                    Budgetzilla will track your spending against this limit every month automatically.
                  </p>
                )}
              </div>
            </div>
          </div>


          <DialogFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:gap-0">
            <div>
              {initialBudgetCents != null ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-danger hover:text-danger hover:bg-danger/5 rounded-full px-6"
                  disabled={submitting}
                  onClick={onDelete}
                >
                  Remove limit
                </Button>
              ) : null}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="rounded-full px-8"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-full px-8 shadow-lg shadow-primary/20" disabled={submitting}>
                Save Limit
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}




