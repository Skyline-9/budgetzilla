import React from "react";
import { 
  Cloud, 
  CloudOff, 
  Database, 
  Download, 
  FileSpreadsheet, 
  Moon, 
  Palette, 
  RefreshCw, 
  Sun, 
  Trash2, 
  Upload,
  HelpCircle,
  BookOpen,
  ChevronRight,
  ArrowRight,
  Receipt,
  Tags,
  Target,
  Activity,
  Lightbulb,
  Keyboard,
  ShieldCheck,
  Smartphone,
  Info
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_MODE, GOOGLE_CLIENT_ID } from "@/api/config";
import { useDriveStatusQuery, useSmartSyncMutation, driveQk } from "@/api/queries";
import { connect as connectDrive } from "@/services/driveSync";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useTheme } from "@/providers/ThemeProvider";
import { getCurrency, setCurrency } from "@/lib/format";
import { downloadXLSX, downloadTransactionsCSV } from "@/services/export";
import { importCashewCSV } from "@/services/importCashew";
import { importXLSX } from "@/services/importXLSX";
import { importSpreadsheetCSV } from "@/services/importSpreadsheet";
import { clearAllData } from "@/db/schema";
import { cn } from "@/lib/cn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        "group relative overflow-hidden rounded-squircle bg-card/85 p-6 shadow-surface",
        "corner-glow",
        tintClass,
        "transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-card/90 hover:shadow-surface-elevated",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight uppercase tracking-[0.12em] text-muted-foreground/80">
        {icon ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-background/40 text-muted-foreground">
            {icon}
          </span>
        ) : null}
        <span>{title}</span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

// ... GoogleDriveSyncCard remains mostly same but uses refactored Card ...
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
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isConnected ? "bg-income animate-pulse" : "bg-muted-foreground/40"
            )}
          />
          <span className={isConnected ? "text-income font-semibold" : "text-muted-foreground"}>
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
              className="rounded-full px-4"
              onClick={handleConnect}
              disabled={isConnecting || isLoading}
            >
              <Cloud className="mr-1.5 h-4 w-4" />
              {isConnecting ? "Connecting..." : "Connect"}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full px-4"
                onClick={handleSync}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("mr-1.5 h-4 w-4", isSyncing && "animate-spin")} />
                Sync
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full px-4"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                Disconnect
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
  const [isImportingSpreadsheet, setIsImportingSpreadsheet] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const xlsxInputRef = React.useRef<HTMLInputElement>(null);
  const spreadsheetInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleImportSpreadsheetClick = () => {
    spreadsheetInputRef.current?.click();
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
        toast.warning(`XLSX Import: ${result.errors.length} error(s).`);
      } else {
        toast.success(
          `Successfully imported ${result.transactionsImported} transactions.`
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

  const handleSpreadsheetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingSpreadsheet(true);
    try {
      const result = await importSpreadsheetCSV(file, {
        commit: true,
        skipDuplicates: true,
      });

      if (result.errors.length > 0) {
        toast.warning(`Spreadsheet Import: ${result.errors.length} error(s).`);
      } else {
        toast.success(
          `Successfully imported ${result.transactionsCreated} transactions.`
        );
      }
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Spreadsheet Import failed");
      console.error(err);
    } finally {
      setIsImportingSpreadsheet(false);
      if (spreadsheetInputRef.current) spreadsheetInputRef.current.value = "";
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
    <div className="space-y-10 pb-20">
      <header className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">Settings</div>
        <div className="text-sm text-muted-foreground text-balance">
          Manage your preferences, data, and find help.
        </div>
      </header>

      <Tabs defaultValue="data" className="space-y-10">
        <TabsList className="bg-background/40 p-1.5 rounded-full border border-border/40 h-14">
          <TabsTrigger value="data" className="rounded-full px-8 h-full text-sm font-bold tracking-tight">Data & Sync</TabsTrigger>
          <TabsTrigger value="preferences" className="rounded-full px-8 h-full text-sm font-bold tracking-tight">Preferences</TabsTrigger>
          <TabsTrigger value="help" className="rounded-full px-8 h-full text-sm font-bold tracking-tight">Help & Support</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="space-y-10 outline-none">
          <section className="space-y-6">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Appearance</h2>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card title="Theme" icon={<Palette className="h-4 w-4" />} tint="hero">
                <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/20 px-4 py-4 transition-all hover:bg-background/30">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-background/40">
                      {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{theme === "dark" ? "Dark mode" : "Light mode"}</div>
                      <div className="text-xs text-muted-foreground">OLED-ready deep blacks</div>
                    </div>
                  </div>
                  <Switch checked={theme === "dark"} onCheckedChange={() => toggleTheme()} />
                </div>
              </Card>

              <Card title="Currency" icon={<span className="text-sm font-bold">$</span>} tint="warm">
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    Display currency for all amounts across the app.
                  </div>
                  <div className="space-y-2">
                    <Select
                      value={currency}
                      onValueChange={(v) => {
                        setCurrencyState(v);
                        setCurrency(v);
                        toast.success("Currency saved");
                      }}
                    >
                      <SelectTrigger className="max-w-xs rounded-xl bg-background/20 border-border/40">
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

          <section className="space-y-6">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Local AI (Ollama)</h2>
            <Card title="Vision Model" icon={<Database className="h-4 w-4" />} tint="accent">
              <div className="space-y-6">
                <div className="text-xs text-muted-foreground">
                  Configure your local Ollama instance for Analyzing receipts completely offline.
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Ollama URL</Label>
                    <Input 
                      className="rounded-xl bg-background/20 border-border/40"
                      defaultValue={localStorage.getItem("ollamaUrl") || "http://localhost:11434"} 
                      onBlur={(e) => {
                        localStorage.setItem("ollamaUrl", e.target.value);
                        toast.success("Ollama URL saved");
                      }} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Model Name</Label>
                    <Input 
                      className="rounded-xl bg-background/20 border-border/40"
                      defaultValue={localStorage.getItem("ollamaModel") || "gemma4"} 
                      onBlur={(e) => {
                        localStorage.setItem("ollamaModel", e.target.value);
                        toast.success("Model saved");
                      }} 
                    />
                  </div>
                </div>
              </div>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="data" className="space-y-10 outline-none">
          <section className="space-y-6">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cloud Sync</h2>
            <GoogleDriveSyncCard />
          </section>

          <section className="space-y-6">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Import & Export</h2>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card title="Export" icon={<Download className="h-4 w-4" />} tint="income">
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground">Download your transaction history.</div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" size="sm" className="rounded-full px-5" onClick={handleExportXLSX} disabled={isExporting}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                    </Button>
                    <Button variant="secondary" size="sm" className="rounded-full px-5" onClick={handleExportCSV} disabled={isExporting}>
                      <Download className="mr-2 h-4 w-4" /> CSV
                    </Button>
                  </div>
                </div>
              </Card>

              <Card title="Import" icon={<Upload className="h-4 w-4" />} tint="accent">
                <div className="space-y-4">
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                  <input ref={xlsxInputRef} type="file" accept=".xlsx" onChange={handleXLSXFileChange} className="hidden" />
                  <input ref={spreadsheetInputRef} type="file" accept=".csv" onChange={handleSpreadsheetFileChange} className="hidden" />
                  <div className="text-xs text-muted-foreground">Restore from backup or external sources.</div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" size="sm" className="rounded-full px-5" onClick={handleImportXLSXClick} disabled={isImportingXLSX}>
                      Excel
                    </Button>
                    <Button variant="secondary" size="sm" className="rounded-full px-5" onClick={handleImportClick} disabled={isImporting}>
                      Cashew
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xs font-bold text-destructive uppercase tracking-widest">Danger Zone</h2>
            <Card title="Reset App" icon={<Trash2 className="h-4 w-4" />} tint="expense">
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">Permanently wipe all local data. This action is irreversible.</div>
                <Button variant="destructive" size="sm" className="rounded-full px-6" onClick={handleClearData}>
                  <Trash2 className="mr-2 h-4 w-4" /> Clear All Data
                </Button>
              </div>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="help" className="space-y-10 outline-none">
          <section className="space-y-6">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Learning Budgetzilla</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <HelpTopicCard title="Transactions" description="How to log and manage spending." icon={<Receipt className="h-5 w-5" />} />
              <HelpTopicCard title="Categories" description="Organizing your money effectively." icon={<Tags className="h-5 w-5" />} />
              <HelpTopicCard title="Budgets" description="Setting targets and staying on track." icon={<Target className="h-5 w-5" />} />
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Quick Tips</h2>
            <Card title="Pro Features" icon={<Lightbulb className="h-4 w-4" />} tint="warm">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-warm/10 text-warm flex items-center justify-center shrink-0">1</div>
                  <span>Drag-and-drop categories to nest them for better organization.</span>
                </li>
                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-warm/10 text-warm flex items-center justify-center shrink-0">2</div>
                  <span>Use the AI Chat widget to ask questions about your spending in natural language.</span>
                </li>
                <li className="flex gap-3">
                  <div className="h-5 w-5 rounded-full bg-warm/10 text-warm flex items-center justify-center shrink-0">3</div>
                  <span>Sync with Google Drive to keep your data safe and accessible across devices.</span>
                </li>
              </ul>
            </Card>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HelpTopicCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-squircle bg-card/85 p-6 shadow-surface transition-all duration-300 hover:shadow-surface-elevated hover:-translate-y-1">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-transform group-hover:scale-110">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="mt-4 w-full justify-between rounded-xl">
        Learn more <ArrowRight className="h-3 w-3 opacity-50" />
      </Button>
    </div>
  );
}
