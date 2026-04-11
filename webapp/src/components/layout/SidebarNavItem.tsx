import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

export function SidebarNavItem({
  to,
  label,
  icon,
  iconClassName,
  collapsed,
  search,
  onClick,
  mdUp = true,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  iconClassName?: string;
  collapsed: boolean;
  search: string;
  onClick?: () => void;
  mdUp?: boolean;
}) {
  const location = useLocation();
  const isCurrentlyActive = location.pathname === to;

  const link = (
    <NavLink
      to={{ pathname: to, search }}
      aria-label={label}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "relative group rounded-squircle text-base transition-all duration-200 overflow-visible",
          collapsed
            ? "grid h-14 w-14 place-items-center self-center leading-none"
            : "flex items-center gap-4 px-4 py-3",
          "text-muted-foreground/70 hover:bg-primary/5 hover:text-foreground",
          // Use static bg-muted only when not on desktop (mobile) or collapsed — desktop expanded uses animated indicator
          isActive && (!mdUp || collapsed) && "bg-muted text-foreground font-bold shadow-sm",
          isActive && mdUp && !collapsed && "text-foreground font-bold",
          // Active indicator: subtle left bar in expanded mode (only on mobile), dot below icon in collapsed mode
          isActive &&
            !collapsed &&
            !mdUp &&
            "before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-r-full before:bg-primary",
          isActive &&
            collapsed &&
            "after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        )
      }
    >
      {/* Animated sliding active indicator — desktop expanded only */}
      {isCurrentlyActive && mdUp && !collapsed && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute inset-0 rounded-squircle bg-muted shadow-sm"
          style={{ zIndex: -1 }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        />
      )}
      <span
        className={cn(
          "opacity-70 group-hover:opacity-100 [&>svg]:h-5 [&>svg]:w-5 transition-opacity",
          iconClassName,
          collapsed ? "grid h-full w-full place-items-center" : "inline-flex items-center justify-center",
          "[&>svg]:block",
        )}
      >
        {icon}
      </span>
      {!collapsed && <span className="font-bold tracking-tight">{label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}


