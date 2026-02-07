import React from "react";
import { Cloud, CloudOff, Database, Download, FileSpreadsheet, Moon, Palette, RefreshCw, Sun, Trash2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_MODE, GOOGLE_CLIENT_ID } from "@/api/config";
import { useDriveStatusQuery, useSmartSyncMutation, driveQk } from "@/api/queries";
import { connect as connectDrive } from "@/services/driveSync";
import { api } from "@/api";
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
import { importXLSX } from "@/services/importXLSX";
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

function GoogleDriveSyncCard() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useDriveStatusQuery();
  const { mutate: syncNow, isPending: isSyncing } = useSmartSyncMutation();
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  const handleConnect = async () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error("Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID environment variable.");
      return;
    }
    setIsConnecting(true);
    try {
      await connectDrive(GOOGLE_CLIENT_ID);
      await queryClient.invalidateQueries({ queryKey: driveQk.status() });
      toast.success("Connected to Google Drive");
      // Automatically trigger a sync after connecting
      handleSync();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect");
      console.error(e);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await api.disconnectDrive();
      await queryClient.invalidateQueries({ queryKey: driveQk.status() });
      toast.success("Disconnected from Google Drive");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disconnect");
      console.error(e);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = () => {
    syncNow(undefined, {
      onSuccess: () => {
        toast.success("Sync complete");
      },
    });
  };

  const isConnected = status?.connected ?? false;
  const lastSyncAt = status?.last_sync_at;

  return (
    <Card
      title="Google Drive"
      icon={isConnected ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
      tint={isConnected ? "income" : "neutral"}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-muted-foreground/40"
            )}
          />
          <span className={isConnected ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
            {isLoading ? "Checking..." : isConnected ? "Connected" : "Not connected"}
          </span>
        </div>

        {isConnected && lastSyncAt && (
          <div className="text-xs text-muted-foreground">
            Last synced: {new Date(lastSyncAt).toLocaleString()}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isConnected ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleConnect}
              disabled={isConnecting || isLoading}
            >
              <Cloud className="mr-1.5 h-4 w-4" />
              {isConnecting ? "Connecting..." : "Connect Google Drive"}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("mr-1.5 h-4 w-4", isSyncing && "animate-spin")} />
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                <CloudOff className="mr-1.5 h-4 w-4" />
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const { confirm } = useConfirmDialog();
  const [currency, setCurrencyState] = React.useState(() => getCurrency());
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isImportingXLSX, setIsImportingXLSX] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const xlsxInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleImportXLSXClick = () => {
    xlsxInputRef.current?.click();
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

  const handleXLSXFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingXLSX(true);
    try {
      const result = await importXLSX(file);

      if (result.errors.length > 0) {
        toast.warning(`XLSX Import: ${result.errors.length} error(s). ${result.transactionsImported} transactions, ${result.categoriesImported} categories imported.`);
      } else {
        toast.success(
          `Successfully imported ${result.transactionsImported} transactions, ${result.categoriesImported} categories, and ${result.budgetsImported} budget entries.`
        );
      }
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "XLSX Import failed");
      console.error(err);
    } finally {
      setIsImportingXLSX(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
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
          Manage preferences, import/export data, and configure your Budgetzilla app.
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
                Import data from Excel or Cashew CSV format.
                <HelpTooltip content="Supports native Budgetzilla XLSX export and Cashew app export format." />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={xlsxInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleXLSXFileChange}
                className="hidden"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleImportXLSXClick}
                  disabled={isImportingXLSX}
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                  {isImportingXLSX ? "Importing..." : "Import Excel"}
                </Button>
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

      {/* Cloud Sync section */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Cloud Sync</h2>
        <GoogleDriveSyncCard />
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
