import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { ConfirmDialogProvider } from "@/hooks/useConfirmDialog";
import { ScreenReaderAnnouncerProvider } from "@/components/ui/screen-reader-announcer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { CategoriesPage } from "@/pages/Categories";
import { DashboardPage } from "@/pages/Dashboard";
import { SettingsPage } from "@/pages/Settings";
import { TransactionsPage } from "@/pages/Transactions";


function AppInner() {
  const { theme } = useTheme();

  return (
    <QueryProvider>
      <ConfirmDialogProvider>
        <ScreenReaderAnnouncerProvider>
          <TooltipProvider delayDuration={120}>
            <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
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


