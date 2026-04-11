import React from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";

export function ScrollToTop() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-20 right-4 z-40 flex h-10 w-10 items-center justify-center",
        "rounded-full bg-card/90 shadow-lg border border-border/60 backdrop-blur-sm",
        "transition-all duration-200 hover:bg-card hover:scale-110",
        "sm:hidden",
      )}
      aria-label="Scroll to top"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}
