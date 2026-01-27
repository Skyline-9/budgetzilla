import React from "react";
import { Database, Download, FileSpreadsheet, Moon, Palette, Sun, Trash2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_MODE } from "@/api/config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useTheme } from "@/providers/ThemeProvider";
import { getCurrency, setCurrency } from "@/lib/format";
import { downloadXLSX, downloadTransactionsCSV } from "@/services/export";
import { importCashewCSV } from "@/services/importCashew";
import { clearAllData } from "@/db/schema";
import { cn } from "@/lib/cn";

type CardTint = "neutral" | "income" | "expense" | "accent" | "hero" | "warm";

function Card({
  title,
  icon,
  children,
  className,
  tint = "neutral",
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tint?: CardTint;
}) {
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
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/85 p-5",
        "corner-glow",
        tintClass,
        "transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:bg-card/90 hover:shadow-lift",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        {icon ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-background/40 ring-1 ring-border/60 text-muted-foreground">
            {icon}
          </span>
        ) : null}
        <span>{title}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const { confirm } = useConfirmDialog();
  const [currency, setCurrencyState] = React.useState(() => getCurrency());
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportXLSX = async () => {
    setIsExporting(true);
    try {
      downloadXLSX();
      toast.success("Export complete");
    } catch (e) {
      toast.error("Export failed");
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      downloadTransactionsCSV();
      toast.success("Export complete");
    } catch (e) {
      toast.error("Export failed");
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await importCashewCSV(file, {
        commit: true,
        skipDuplicates: true,
        preserveExtras: false,
      });

      if (result.errors.length > 0) {
        toast.warning(`Imported with ${result.errors.length} error(s)`);
      } else {
        toast.success(
          `Imported ${result.transactionsCreated} transactions, ${result.categoriesCreated} categories`
        );
      }
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      console.error(err);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearData = async () => {
    const ok = await confirm({
      title: "Clear all data",
      description:
        "This will permanently delete all transactions, categories, and budgets. This action cannot be undone.",
      confirmText: "Clear everything",
      variant: "destructive",
    });

    if (!ok) return;

    try {
      await clearAllData();
      await queryClient.invalidateQueries();
      toast.success("All data cleared");
    } catch (e) {
      toast.error("Failed to clear data");
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">Settings</div>
        <div className="text-sm text-muted-foreground text-balance">
          Manage preferences, import/export data, and configure your budget app.
        </div>
      </section>

      {/* Appearance section */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Appearance</h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Theme" icon={<Palette className="h-4 w-4" />} tint="hero">
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/20 px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/40">
                  {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </div>
                <div>
                  <div className="text-sm font-medium">{theme === "dark" ? "Dark mode" : "Light mode"}</div>
                  <div className="text-xs text-muted-foreground">Toggle between themes</div>
                </div>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={() => toggleTheme()} />
            </div>
          </Card>

          <Card title="Currency" icon={<span className="text-sm">$</span>} tint="warm">
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Display currency for all amounts.
              </div>
              <div className="space-y-1.5">
                <Label>Display currency</Label>
                <Select
                  value={currency}
                  onValueChange={(v) => {
                    setCurrencyState(v);
                    setCurrency(v);
                    toast.success("Currency saved");
                  }}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                    <SelectItem value="CAD">CAD ($)</SelectItem>
                    <SelectItem value="AUD">AUD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Data section */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Data</h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Export" icon={<Download className="h-4 w-4" />} tint="income">
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Download your data as Excel or CSV files.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportXLSX}
                  disabled={isExporting}
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                  Export Excel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={isExporting}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Import" icon={<Upload className="h-4 w-4" />} tint="accent">
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Import transactions from Cashew CSV format.
                <HelpTooltip content="Supports Cashew app export format with columns: date, amount, title, category, etc." />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleImportClick}
                disabled={isImporting}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                {isImporting ? "Importing..." : "Import CSV"}
              </Button>
            </div>
          </Card>

          <Card title="Storage" icon={<Database className="h-4 w-4" />} className="xl:col-span-2">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/20 px-3 py-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  API mode
                  <HelpTooltip content="'local' uses browser SQLite, 'mock' uses sample data, 'real' connects to a backend server." />
                </div>
                <div className="mt-1 text-sm font-semibold tracking-tight">{API_MODE}</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/20 px-3 py-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Storage engine
                  <HelpTooltip content="Data is stored locally in your browser using SQLite compiled to WebAssembly, persisted via IndexedDB." />
                </div>
                <div className="mt-1 text-sm font-semibold tracking-tight">Browser SQLite (WASM)</div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Danger zone */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-destructive uppercase tracking-wide">Danger zone</h2>
        <Card title="Clear data" icon={<Trash2 className="h-4 w-4" />} tint="expense">
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Permanently delete all transactions, categories, and budgets. This cannot be undone.
            </div>
            <Button variant="destructive" size="sm" onClick={handleClearData}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Clear all data
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
