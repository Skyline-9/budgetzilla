import React, { useEffect, useState, useId } from "react";
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Keyboard,
  Lightbulb,
  Receipt,
  Settings,
  Tags,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import dotsOverlayUrl from "@/assets/dashboard/dots-overlay.svg";

// Platform detection for showing appropriate shortcuts
function useIsMac() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);
  return isMac;
}

// Color theme types for semantic section coloring (60-30-10 rule)
type SectionTheme = "hero" | "feature" | "reference" | "tips";

// Section theme styles - using semantic colors per Toptal/Elementor guidelines
const SECTION_THEMES: Record<SectionTheme, {
  iconBg: string;
  iconRing: string;
  iconText: string;
  accentText: string;
  tint?: string;
}> = {
  hero: {
    iconBg: "bg-hero/15",
    iconRing: "ring-hero/40",
    iconText: "text-hero",
    accentText: "text-hero",
    tint: "tint-hero",
  },
  feature: {
    // Softer neutral/slate instead of jarring red
    iconBg: "bg-foreground/8",
    iconRing: "ring-foreground/15",
    iconText: "text-foreground/70",
    accentText: "text-foreground/60",
  },
  reference: {
    iconBg: "bg-info/15",
    iconRing: "ring-info/40",
    iconText: "text-info",
    accentText: "text-info",
  },
  tips: {
    iconBg: "bg-warm/15",
    iconRing: "ring-warm/40",
    iconText: "text-warm",
    accentText: "text-warm",
  },
};

// Section data for ToC and content with semantic color themes
const SECTIONS = [
  { id: "getting-started", title: "Getting Started", icon: Zap, theme: "hero" as SectionTheme },
  { id: "dashboard", title: "Dashboard", icon: BarChart3, theme: "feature" as SectionTheme },
  { id: "transactions", title: "Transactions", icon: Receipt, theme: "feature" as SectionTheme },
  { id: "categories", title: "Categories", icon: Tags, theme: "feature" as SectionTheme },
  { id: "settings", title: "Settings", icon: Settings, theme: "feature" as SectionTheme },
  { id: "shortcuts", title: "Keyboard Shortcuts", icon: Keyboard, theme: "reference" as SectionTheme },
  { id: "tips", title: "Tips & Best Practices", icon: Lightbulb, theme: "tips" as SectionTheme },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

// Collapsible Section component with ARIA support and semantic coloring
function Section({
  id,
  title,
  icon,
  children,
  theme = "feature",
  className,
  defaultOpen = true,
  showGlow = false,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  theme?: SectionTheme;
  className?: string;
  defaultOpen?: boolean;
  showGlow?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const headingId = useId();
  const themeStyles = SECTION_THEMES[theme];

  return (
    <section
      id={id}
      role="region"
      aria-labelledby={headingId}
      className={cn(
        "rounded-3xl border border-border/60 bg-card/90 shadow-soft-lg scroll-mt-20",
        showGlow && "corner-glow-hero",
        showGlow && themeStyles.tint,
        className
      )}
    >
      <button
        id={headingId}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={cn(
          "flex w-full items-center justify-between gap-3 p-6 text-left",
          "text-lg font-semibold tracking-tight",
          "hover:bg-muted/30 transition-colors rounded-t-3xl",
          !isOpen && "rounded-b-3xl",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-xl ring-1",
            themeStyles.iconBg,
            themeStyles.iconRing,
            themeStyles.iconText
          )}>
            {icon}
          </span>
          {title}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        id={contentId}
        role="region"
        aria-hidden={!isOpen}
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-4 px-6 pb-6 text-sm text-foreground/90">
          {children}
        </div>
      </div>
    </section>
  );
}

// Feature component with theme-aware accent color
function Feature({
  title,
  description,
  accentColor = "text-primary"
}: {
  title: string;
  description: string;
  accentColor?: string;
}) {
  return (
    <div className="flex gap-3">
      <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0", accentColor)} aria-hidden />
      <div>
        <div className="font-semibold text-foreground">{title}</div>
        <div className="mt-1 text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

// Shortcut component with improved kbd contrast (WCAG compliance)
function Shortcut({ macKey, winKey, description }: { macKey: string; winKey: string; description: string }) {
  const isMac = useIsMac();
  const key = isMac ? macKey : winKey;
  const keys = key.split(" + ");

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-muted-foreground">{description}</div>
      <div className="flex shrink-0 items-center gap-1.5">
        {keys.map((k, idx) => (
          <React.Fragment key={`${k}:${idx}`}>
            {idx > 0 && <span className="text-muted-foreground/70 text-xs">+</span>}
            <kbd
              className={cn(
                "inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold",
                // Improved contrast: darker background, higher contrast text
                "border border-border bg-muted/80 text-foreground/80",
                "dark:bg-muted/60 dark:text-foreground/90"
              )}
            >
              {k}
            </kbd>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Table of Contents component with semantic colors
function TableOfContents({ activeSection }: { activeSection: SectionId | null }) {
  return (
    <nav aria-label="Table of contents" className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        On this page
      </div>
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        const themeStyles = SECTION_THEMES[section.theme];

        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              "hover:bg-muted/50",
              isActive
                ? cn(
                  // Use info (blue) for active state - distinct from primary red
                  "bg-info/10 text-info font-medium",
                  "dark:bg-info/15"
                )
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "location" : undefined}
          >
            <Icon className={cn("h-4 w-4", isActive && "text-info")} />
            {section.title}
          </a>
        );
      })}
    </nav>
  );
}

// Back to top button with improved visibility
function BackToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!show) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "inline-flex h-10 w-10 items-center justify-center",
        // Improved visibility: accent border, stronger background
        "rounded-full border-2 border-info/50 bg-card shadow-lg backdrop-blur-sm",
        "text-info hover:text-info hover:bg-info/10 hover:border-info",
        "transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info",
        "animate-in fade-in slide-in-from-bottom-4"
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

// Hook to track active section based on scroll position
function useActiveSection(): SectionId | null {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as SectionId);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return activeSection;
}

export function HelpPage() {
  const activeSection = useActiveSection();

  return (
    <div className="relative">
      {/* Main layout with sidebar */}
      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_220px] lg:gap-8">
        {/* Main content */}
        <div className="space-y-6">
          <header>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Help & Documentation</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">How to use Budgetzilla</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you need to know to track your finances effectively
            </p>
          </header>

          {/* Mobile ToC - collapsible */}
          <details className="lg:hidden rounded-2xl border border-border/60 bg-card/90 p-4">
            <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold">
              <span>Jump to section</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </summary>
            <div className="mt-3 border-t border-border/60 pt-3">
              <TableOfContents activeSection={activeSection} />
            </div>
          </details>

          {/* Getting Started - Hero theme (purple) */}
          <Section
            id="getting-started"
            title="Getting Started"
            icon={<Zap className="h-4 w-4" />}
            theme="hero"
            showGlow
            className="relative overflow-hidden"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.10] dark:opacity-[0.08]">
              <img src={dotsOverlayUrl} alt="" className="h-full w-full object-cover scale-80" />
            </div>
            <p className="relative z-10">
              Budgetzilla is a personal finance app designed for speed and simplicity. Track income and expenses,
              organize with categories, set budgets, and visualize your spending patterns.
            </p>
            <div className="relative z-10 space-y-3">
              <Feature
                title="1. Create Categories"
                description="Start by setting up income and expense categories. Categories can be nested (e.g., Food → Restaurants → Fast Food)."
                accentColor="text-hero"
              />
              <Feature
                title="2. Add Transactions"
                description="Use Quick Add on the Transactions page or press N anywhere. Transactions are automatically signed based on category type."
                accentColor="text-hero"
              />
              <Feature
                title="3. Set Budgets"
                description="On the Dashboard, set monthly budgets for expense categories. Track progress and get adjusted budgets based on spending."
                accentColor="text-hero"
              />
              <Feature
                title="4. Review Insights"
                description="View charts, trends, and category breakdowns on the Dashboard. Filter transactions by date, category, or amount."
                accentColor="text-hero"
              />
            </div>
          </Section>

          {/* Dashboard - Feature theme (primary/red) */}
          <Section id="dashboard" title="Dashboard" icon={<BarChart3 className="h-4 w-4" />} theme="feature">
            <p>
              Your financial overview at a glance. The Dashboard shows key metrics, budget status, and visual insights.
            </p>
            <div className="space-y-3">
              <Feature
                title="Summary Cards"
                description="Track income, expenses, net cash flow, and savings rate. Hover over cards to see sparklines showing trends."
              />
              <Feature
                title="Budget Card"
                description="Monitor monthly spending against your budget. Adjusted budget accounts for partial months and shows projected spend."
              />
              <Feature
                title="Charts"
                description="Daily/monthly trends, category rankings, and historical spending patterns. Click categories to filter transactions."
              />
            </div>
            <div className="rounded-2xl bg-muted/40 p-3 ring-1 ring-border/60">
              <div className="text-xs font-semibold text-foreground/70">Quick Actions</div>
              <div className="mt-2 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-foreground/60" aria-hidden />
                  <span className="text-foreground/80">Click "Set" or "Edit" on Budget Card to configure monthly budgets</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-foreground/60" aria-hidden />
                  <span className="text-foreground/80">Click chart categories to jump to filtered transactions</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Transactions - Feature theme */}
          <Section id="transactions" title="Transactions" icon={<Receipt className="h-4 w-4" />} theme="feature">
            <p>
              Fast entry and review of all your financial transactions. Search, filter, sort, and edit with ease.
            </p>
            <div className="space-y-3">
              <Feature
                title="Quick Add"
                description="Add transactions instantly without leaving the page. Amount is automatically signed based on category (expenses negative, income positive)."
              />
              <Feature
                title="Filters"
                description="Built into the table: filter by category, date range, or amount (min/max). Active filters show as removable chips."
              />
              <Feature
                title="Search"
                description="Use the search shortcut or / to search merchant names and notes. Search works across the entire app."
              />
              <Feature
                title="Table Actions"
                description="Click any row to edit. Use the actions menu (⋯) to duplicate or delete transactions."
              />
            </div>
            <div className="rounded-2xl bg-muted/40 p-3 ring-1 ring-border/60">
              <div className="text-xs font-semibold text-foreground/70">Quick Add Tips</div>
              <div className="mt-2 space-y-2 text-xs text-foreground/80">
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50" aria-hidden>•</span>
                  <span>Press Enter to submit, Esc to clear</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50" aria-hidden>•</span>
                  <span>Toggle "Keep values" to retain category after adding</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50" aria-hidden>•</span>
                  <span>No need to add - or + signs, category determines if it's income or expense</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Categories - Feature theme */}
          <Section id="categories" title="Categories" icon={<Tags className="h-4 w-4" />} theme="feature">
            <p>
              Organize transactions with hierarchical categories. Create income and expense categories,
              customize colors, and nest them for detailed tracking.
            </p>
            <div className="space-y-3">
              <Feature
                title="Create & Organize"
                description="Add categories with the + button. Drag to reorder, or make a category a child of another by clicking the parent dropdown."
              />
              <Feature
                title="Hierarchical Structure"
                description="Nest categories up to any depth (e.g., Transportation → Car → Gas). Parent categories roll up child spending."
              />
              <Feature
                title="Color Coding"
                description="Assign colors to help identify categories at a glance. Colors appear in charts and transaction lists."
              />
              <Feature
                title="Active/Inactive"
                description="Toggle categories inactive to hide them from dropdowns without losing historical data."
              />
            </div>
            <div className="rounded-2xl bg-muted/40 p-3 ring-1 ring-border/60">
              <div className="text-xs font-semibold text-foreground/70">Selection & Editing</div>
              <div className="mt-2 space-y-2 text-xs text-foreground/80">
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50" aria-hidden>•</span>
                  <span>Select multiple with Shift+Click (range) or modifier+Click (toggle)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50" aria-hidden>•</span>
                  <span>Use arrow keys to navigate, Enter to open inspector, Space to toggle selection</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50" aria-hidden>•</span>
                  <span>Bulk actions: reorder, set parent, toggle active status, or delete multiple at once</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Settings - Feature theme */}
          <Section id="settings" title="Settings" icon={<Settings className="h-4 w-4" />} theme="feature">
            <p>
              Customize your experience with theme, API mode, and data management.
            </p>
            <div className="space-y-3">
              <Feature
                title="Theme"
                description="Choose between light, dark, or system-adaptive theme. Changes apply immediately."
              />
              <Feature
                title="API Mode"
                description="Toggle between local SQLite storage (default) and mock data for testing."
              />
              <Feature
                title="Data Management"
                description="Export your data as JSON for backup or analysis. Use reset to clear all data and start fresh."
              />
            </div>
          </Section>

          {/* Keyboard Shortcuts - Reference theme (blue) */}
          <Section id="shortcuts" title="Keyboard Shortcuts" icon={<Keyboard className="h-4 w-4" />} theme="reference">
            <p>Speed up your workflow with keyboard shortcuts. These work from anywhere in the app:</p>
            <div className="space-y-2">
              <Shortcut macKey="⌘ + K" winKey="Ctrl + K" description="Focus global search" />
              <Shortcut macKey="/" winKey="/" description="Quick search (when not typing)" />
              <Shortcut macKey="N" winKey="N" description="Add transaction (when not typing)" />
              <Shortcut macKey="Enter" winKey="Enter" description="Submit Quick Add / open table row" />
              <Shortcut macKey="Esc" winKey="Esc" description="Clear Quick Add / close dialogs" />
            </div>
            <div className="mt-4 rounded-2xl bg-info/5 p-3 ring-1 ring-info/20">
              <div className="text-xs font-semibold text-info">Categories Shortcuts</div>
              <div className="mt-2 space-y-2">
                <Shortcut macKey="↑ / ↓" winKey="↑ / ↓" description="Navigate rows" />
                <Shortcut macKey="Space" winKey="Space" description="Toggle selection" />
                <Shortcut macKey="Shift + Click" winKey="Shift + Click" description="Range select" />
                <Shortcut macKey="⌘ + Click" winKey="Ctrl + Click" description="Toggle selection" />
              </div>
            </div>
          </Section>

          {/* Tips & Best Practices - Tips theme (orange/warm) */}
          <Section id="tips" title="Tips & Best Practices" icon={<Lightbulb className="h-4 w-4" />} theme="tips">
            <div className="space-y-3">
              <Feature
                title="Set Realistic Budgets"
                description="Start with your actual spending patterns, then gradually adjust. The adjusted budget feature helps with partial months."
                accentColor="text-warm"
              />
              <Feature
                title="Use Category Hierarchy"
                description="Group related expenses (e.g., all food categories under 'Food') to see both detailed and summary views."
                accentColor="text-warm"
              />
              <Feature
                title="Regular Reviews"
                description="Check your Dashboard weekly. Review charts to spot trends and adjust spending or budgets accordingly."
                accentColor="text-warm"
              />
              <Feature
                title="Add Notes"
                description="Use the notes field for transactions that need context. Makes reviewing much easier later."
                accentColor="text-warm"
              />
              <Feature
                title="Date Filters"
                description="Use the date picker in the topbar to focus on specific periods. Great for monthly reviews or tax prep."
                accentColor="text-warm"
              />
            </div>
          </Section>

          {/* Quick Links */}
          <section
            aria-labelledby="quick-links-heading"
            className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-soft-lg"
          >
            <h2 id="quick-links-heading" className="text-sm font-semibold tracking-tight">Ready to start?</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/dashboard">
                <Button variant="default">
                  <BarChart3 className="h-4 w-4" aria-hidden />
                  Go to Dashboard
                </Button>
              </Link>
              <Link to="/transactions">
                <Button variant="secondary">
                  <Receipt className="h-4 w-4" aria-hidden />
                  Add Transactions
                </Button>
              </Link>
              <Link to="/categories">
                <Button variant="secondary">
                  <Tags className="h-4 w-4" aria-hidden />
                  Setup Categories
                </Button>
              </Link>
            </div>
          </section>
        </div>

        {/* Desktop sidebar ToC */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <TableOfContents activeSection={activeSection} />
          </div>
        </aside>
      </div>

      {/* Back to top button */}
      <BackToTopButton />
    </div>
  );
}
