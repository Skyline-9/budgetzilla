import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { ConfirmDialogProvider } from "@/hooks/useConfirmDialog";
import { ScreenReaderAnnouncerProvider } from "@/components/ui/screen-reader-announcer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useQueryClient } from "@tanstack/react-query";
import { isTauri } from "@/db/sqlite";
import { hasPlaidCompanionSession, plaidCompanion, startDesktopPlaidCompanion } from "@/services/plaidCompanion";
import { syncPlaidItemsOnOpen } from "@/services/plaidImport";

const DashboardPage = React.lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.DashboardPage })));
const TransactionsPage = React.lazy(() => import("@/pages/Transactions").then(m => ({ default: m.TransactionsPage })));
const CategoriesPage = React.lazy(() => import("@/pages/Categories").then(m => ({ default: m.CategoriesPage })));
const SettingsPage = React.lazy(() => import("@/pages/Settings").then(m => ({ default: m.SettingsPage })));

function PlaidStartupSync() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (isTauri()) await startDesktopPlaidCompanion();
      else if (!hasPlaidCompanionSession()) return;

      const items = await plaidCompanion.listItems();
      await syncPlaidItemsOnOpen(items.filter(item => item.status === "healthy").map(item => item.itemId));
      if (!cancelled) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["transactions"] }),
          queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] }),
        ]);
      }
    })().catch(() => {
      // Plaid is optional; a stopped companion or missing session must not block app startup.
    });
    return () => { cancelled = true; };
  }, [queryClient]);

  return null;
}


function AppInner() {
  const { theme } = useTheme();

  return (
    <QueryProvider>
      <PlaidStartupSync />
      <ConfirmDialogProvider>
        <ScreenReaderAnnouncerProvider>
          <TooltipProvider delayDuration={120}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ErrorBoundary>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                </Routes>
              </ErrorBoundary>
              <WelcomeModal />
            </BrowserRouter>

            <Toaster
              theme={theme}
              richColors
              position="top-right"
              toastOptions={{
                classNames: {
                  toast: "bg-card text-card-foreground border border-border shadow-soft-lg rounded-xl",
                  success: "border-primary/35 bg-primary/10",
                },
              }}
            />
          </TooltipProvider>
        </ScreenReaderAnnouncerProvider>
      </ConfirmDialogProvider>
    </QueryProvider>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}


