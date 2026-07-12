import React from "react";
import { 
  Cloud, 
  CloudOff, 
  Cpu,
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
  ChevronRight,
  ArrowRight,
  Receipt,
  Tags,
  Target,
  Lightbulb
} from "lucide-react";
import { isWebGpuAvailable, ensureModelLoaded, isModelLoaded, type ModelStatus } from "@/services/webgpuInference";
import type { InferenceBackend } from "@/services/localAiParser";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GOOGLE_CLIENT_ID } from "@/api/config";
import { useDriveStatusQuery, useSmartSyncMutation, driveQk } from "@/api/queries";
import { connect as connectDrive } from "@/services/driveSync";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useTheme } from "@/providers/ThemeProvider";
import { getCurrency, setCurrency } from "@/lib/format";
import { clearAllData } from "@/db/schema";
import { cn } from "@/lib/cn";

interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

function SettingsCard({
  title,
  description,
  children,
  className,
}: SettingsCardProps) {
  return (
    <div className={cn("space-y-3.5", className)}>
      <div className="px-1">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/25 backdrop-blur-md shadow-soft divide-y divide-border/20">
        {children}
      </div>
    </div>
  );
}

interface SettingsRowProps {
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconTextColor?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

function SettingsRow({
  icon,
  iconBgColor = "bg-primary/10",
  iconTextColor = "text-primary",
  title,
  description,
  children,
  className,
}: SettingsRowProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/5", className)}>
      <div className="flex items-start gap-4">
        {icon && (
          <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", iconBgColor, iconTextColor)}>
            {icon}
          </div>
        )}
        <div className="space-y-0.5">
          <div className="text-sm font-medium tracking-tight">{title}</div>
          {description && <div className="text-xs text-muted-foreground max-w-md">{description}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
        {children}
      </div>
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
    <SettingsCard title="Cloud Sync" description="Keep your data backed up securely and synced across devices.">
      <SettingsRow
        icon={isConnected ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
        iconBgColor={isConnected ? "bg-emerald-500/10" : "bg-muted/30"}
        iconTextColor={isConnected ? "text-emerald-500" : "text-muted-foreground"}
        title="Google Drive Sync"
        description={
          isLoading
            ? "Checking connection status..."
            : isConnected
              ? `Connected. Last synced: ${lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never"}`
              : "Not connected. Connect to back up your local database securely."
        }
      >
        <div className="flex items-center gap-2">
          {!isConnected ? (
            <Button
              variant="secondary"
              size="sm"
              className="h-9 px-4"
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
                className="h-9 px-4"
                onClick={handleSync}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("mr-1.5 h-4 w-4", isSyncing && "animate-spin")} />
                Sync
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-muted-foreground hover:text-foreground"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
      </SettingsRow>
    </SettingsCard>
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

  const [inferenceBackend, setInferenceBackendState] = React.useState<InferenceBackend>(() => {
    if (!isWebGpuAvailable()) return "ollama";
    return (localStorage.getItem("inferenceBackend") as InferenceBackend) || "webgpu";
  });
  const [modelStatus, setModelStatus] = React.useState<ModelStatus>(() =>
    isModelLoaded() ? "ready" : "idle",
  );
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const webGpuSupported = React.useMemo(() => isWebGpuAvailable(), []);

  const handleBackendChange = (value: string) => {
    const backend = value as InferenceBackend;
    setInferenceBackendState(backend);
    localStorage.setItem("inferenceBackend", backend);
    toast.success(`AI backend set to ${backend === "webgpu" ? "In-Browser (WebGPU)" : "Ollama"}`);
  };

  const handlePreDownload = async () => {
    setModelStatus("downloading");
    try {
      await ensureModelLoaded((pct) => setDownloadProgress(pct));
      setModelStatus("ready");
      toast.success("AI model downloaded and ready");
    } catch (e) {
      setModelStatus("error");
      toast.error("Failed to download AI model");
      console.error(e);
    }
  };

  const handleExportXLSX = async () => {
    setIsExporting(true);
    try {
      const { downloadXLSX } = await import("@/services/export");
      await downloadXLSX();
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
      const { downloadTransactionsCSV } = await import("@/services/export");
      await downloadTransactionsCSV();
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
      const { importCashewCSV } = await import("@/services/importCashew");
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
      const { importXLSX } = await import("@/services/importXLSX");
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
      const { importSpreadsheetCSV } = await import("@/services/importSpreadsheet");
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

  // Local navigation and Intersection Observer
  const [activeSection, setActiveSection] = React.useState("preferences");

  React.useEffect(() => {
    const sections = ["preferences", "sync", "ai", "data", "help"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  };

  const navItems = [
    { id: "preferences", label: "Preferences", icon: <Palette className="h-4 w-4" /> },
    { id: "sync", label: "Cloud Sync", icon: <Cloud className="h-4 w-4" /> },
    { id: "ai", label: "AI Engine", icon: <Cpu className="h-4 w-4" /> },
    { id: "data", label: "Data & Backup", icon: <Database className="h-4 w-4" /> },
    { id: "help", label: "Help & Support", icon: <HelpCircle className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-8 pb-20">
      <header className="space-y-1.5">
        <div className="text-2xl font-semibold tracking-tight">Settings</div>
        <div className="text-sm text-muted-foreground text-balance">
          Manage your preferences, local database, and cloud synchronization.
        </div>
      </header>

      {/* Mobile Sticky Pills Navigation */}
      <nav className="md:hidden flex overflow-x-auto gap-2 pb-4 scrollbar-none sticky top-0 bg-background/80 backdrop-blur-md z-10 py-3 border-b border-border/20 -mx-3 px-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200",
              activeSection === item.id
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-[1.02]"
                : "bg-card/40 border border-border/40 text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Desktop Split Layout */}
      <div className="flex flex-col md:flex-row md:items-start gap-8 lg:gap-12">
        {/* Sticky Local Nav Sidebar (desktop only) */}
        <aside className="hidden md:block sticky top-24 shrink-0 w-48 lg:w-56 space-y-1.5">
          <div className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-3 mb-2">Sections</div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 text-left",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  activeSection === item.id
                    ? "bg-primary/10 text-primary border-l-2 border-primary pl-2 shadow-sm shadow-primary/5 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/10 pl-3"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Settings Sections Container */}
        <div className="flex-1 max-w-3xl space-y-12">
          {/* Section: Preferences */}
          <section id="preferences" className="scroll-mt-28">
            <SettingsCard title="Preferences" description="Customize how Budgetzilla looks and formats information.">
              {/* Theme Row */}
              <SettingsRow
                icon={theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                iconBgColor="bg-amber-500/10"
                iconTextColor="text-amber-500"
                title="Appearance"
                description={theme === "dark" ? "Dark mode (OLED-ready deep blacks)" : "Light mode (Clean, bright interface)"}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{theme === "dark" ? "Dark" : "Light"}</span>
                  <Switch checked={theme === "dark"} onCheckedChange={() => toggleTheme()} />
                </div>
              </SettingsRow>
              
              {/* Currency Row */}
              <SettingsRow
                icon={<span className="text-sm font-bold">$</span>}
                iconBgColor="bg-emerald-500/10"
                iconTextColor="text-emerald-500"
                title="Currency"
                description="Display currency for all amounts across the app."
              >
                <Select
                  value={currency}
                  onValueChange={(v) => {
                    setCurrencyState(v);
                    setCurrency(v);
                    toast.success("Currency saved");
                  }}
                >
                  <SelectTrigger className="w-36 h-9 bg-background/40">
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
              </SettingsRow>
            </SettingsCard>
          </section>

          {/* Section: Cloud Sync */}
          <section id="sync" className="scroll-mt-28">
            <GoogleDriveSyncCard />
          </section>

          {/* Section: AI Engine */}
          <section id="ai" className="scroll-mt-28">
            <SettingsCard title="AI Engine" description="Configure how receipt scanning and other intelligence features are processed.">
              <SettingsRow
                icon={<Cpu className="h-4 w-4" />}
                iconBgColor="bg-violet-500/10"
                iconTextColor="text-violet-500"
                title="Inference Backend"
                description="Choose how AI features like receipt scanning are powered."
              >
                <Select value={inferenceBackend} onValueChange={handleBackendChange}>
                  <SelectTrigger className="w-56 h-9 bg-background/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webgpu" disabled={!webGpuSupported}>
                      In-Browser (WebGPU) {!webGpuSupported && "— not supported"}
                    </SelectItem>
                    <SelectItem value="ollama">Ollama (External Local)</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>

              {/* WebGPU Status and download progress row */}
              {inferenceBackend === "webgpu" && (
                <div className="px-5 py-4 bg-muted/5 border-t border-border/10 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium tracking-tight">Gemma 4 E2B Model</div>
                      <div className="text-xs text-muted-foreground">
                        ~1.2 GB file. Runs entirely in your browser using your GPU. Cached after downloading.
                      </div>
                    </div>
                    <div>
                      {modelStatus === "ready" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Ready
                        </span>
                      ) : modelStatus === "downloading" ? (
                        <span className="text-xs font-semibold text-primary">{downloadProgress}%</span>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 px-3"
                          onClick={handlePreDownload}
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Download Model
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {modelStatus === "downloading" && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border/40" role="progressbar" aria-valuenow={downloadProgress} aria-valuemin={0} aria-valuemax={100}>
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Ollama Configuration fields row */}
              {inferenceBackend === "ollama" && (
                <div className="px-5 py-5 bg-muted/5 border-t border-border/10">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Ollama Server URL</Label>
                      <Input
                        className="h-9 bg-background/20 border-border/40"
                        defaultValue={localStorage.getItem("ollamaUrl") || "http://localhost:11434"}
                        onBlur={(e) => {
                          localStorage.setItem("ollamaUrl", e.target.value);
                          toast.success("Ollama URL saved");
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Model Name</Label>
                      <Input
                        className="h-9 bg-background/20 border-border/40"
                        defaultValue={localStorage.getItem("ollamaModel") || "gemma4"}
                        onBlur={(e) => {
                          localStorage.setItem("ollamaModel", e.target.value);
                          toast.success("Model saved");
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </SettingsCard>
          </section>

          {/* Section: Data & Backup */}
          <section id="data" className="scroll-mt-28">
            <SettingsCard title="Data & Backup" description="Import data from other apps, export your transactions, or reset the app.">
              {/* Export Row */}
              <SettingsRow
                icon={<Download className="h-4 w-4" />}
                iconBgColor="bg-blue-500/10"
                iconTextColor="text-blue-500"
                title="Export Data"
                description="Download your full transaction history to your device."
              >
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" className="h-8 px-3" onClick={handleExportXLSX} disabled={isExporting}>
                    <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Excel
                  </Button>
                  <Button variant="secondary" size="sm" className="h-8 px-3" onClick={handleExportCSV} disabled={isExporting}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
                  </Button>
                </div>
              </SettingsRow>

              {/* Import Row */}
              <SettingsRow
                icon={<Upload className="h-4 w-4" />}
                iconBgColor="bg-indigo-500/10"
                iconTextColor="text-indigo-500"
                title="Import Data"
                description="Import historical transactions from Excel or Cashew format."
              >
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                <input ref={xlsxInputRef} type="file" accept=".xlsx" onChange={handleXLSXFileChange} className="hidden" />
                <input ref={spreadsheetInputRef} type="file" accept=".csv" onChange={handleSpreadsheetFileChange} className="hidden" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" className="h-8 px-3" onClick={handleImportXLSXClick} disabled={isImportingXLSX}>
                    Excel
                  </Button>
                  <Button variant="secondary" size="sm" className="h-8 px-3" onClick={handleImportClick} disabled={isImporting}>
                    Cashew
                  </Button>
                </div>
              </SettingsRow>

              {/* Danger Zone Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-destructive/5 bg-destructive/[0.01]">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium tracking-tight text-destructive">Danger Zone: Reset App</div>
                    <div className="text-xs text-muted-foreground max-w-md">
                      Permanently delete all transactions, budgets, and categories. This cannot be undone.
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                  <Button variant="destructive" size="sm" className="h-8 px-4" onClick={handleClearData}>
                    Clear All Data
                  </Button>
                </div>
              </div>
            </SettingsCard>
          </section>

          {/* Section: Help & Support */}
          <section id="help" className="space-y-6 scroll-mt-28">
            <SettingsCard title="Help & Support" description="Learn how to use Budgetzilla or read our best tips.">
              <div className="p-5 space-y-6">
                {/* Learning topics */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Guides</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <HelpTopicCard title="Transactions" description="Log & manage spending." icon={<Receipt className="h-4 w-4" />} />
                    <HelpTopicCard title="Categories" description="Organize your money." icon={<Tags className="h-4 w-4" />} />
                    <HelpTopicCard title="Budgets" description="Stay on track easily." icon={<Target className="h-4 w-4" />} />
                  </div>
                </div>

                <hr className="border-border/30" />

                {/* Tips */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <span>Quick Tips</span>
                  </div>
                  
                  <div className="space-y-3.5 pl-1">
                    <div className="flex gap-3 text-xs">
                      <div className="h-5 w-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 font-semibold text-[10px]">1</div>
                      <div className="text-muted-foreground mt-0.5 leading-snug">
                        <strong className="text-foreground">Hierarchical Categories:</strong> Drag and drop categories in the categories manager to organize them hierarchically.
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <div className="h-5 w-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 font-semibold text-[10px]">2</div>
                      <div className="text-muted-foreground mt-0.5 leading-snug">
                        <strong className="text-foreground">AI Intelligence:</strong> Ask questions about your financial history in natural language via the AI Chat sidebar.
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <div className="h-5 w-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 font-semibold text-[10px]">3</div>
                      <div className="text-muted-foreground mt-0.5 leading-snug">
                        <strong className="text-foreground">Automatic Sync:</strong> Enable Google Drive Sync to automatically sync data across all your client devices.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SettingsCard>
          </section>
        </div>
      </div>
    </div>
  );
}

function HelpTopicCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "group relative flex items-center justify-between p-4 rounded-xl text-left transition-all duration-200",
        "border border-border/40 bg-card/25 hover:bg-card/45 hover:border-border/60 hover:-translate-y-0.5 shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 w-full"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center transition-transform group-hover:scale-105 shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-semibold tracking-tight truncate">{title}</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 shrink-0" />
    </button>
  );
}
