import * as React from "react";
import { cn } from "@/lib/cn";
import { Calendar } from "lucide-react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    if (type === "date") {
      return (
        <div className="group relative">
          <input
            ref={ref}
            type={type}
            className={cn(
              "flex h-9 w-full rounded-2xl border border-input bg-card/85 px-3 py-1 text-sm md:text-base",
              "placeholder:text-muted-foreground/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring/40 transition",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "pr-10", // Space for icon
              className,
            )}
            {...props}
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-hover:text-foreground">
            <Calendar className="h-4 w-4" />
          </div>
        </div>
      );
    }

    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-9 w-full rounded-2xl border border-input bg-card/85 px-3 py-1 text-sm",
          "placeholder:text-muted-foreground/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring/40 transition",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
