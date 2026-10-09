"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type KPICardTone =
  | "emerald"
  | "blue"
  | "amber"
  | "violet"
  | "orange"
  | "slate"
  | "rose";

const toneIconClass: Record<KPICardTone, string> = {
  emerald:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-300",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
  amber:
    "bg-amber-50 text-amber-600 dark:bg-amber-500/25 dark:text-amber-300",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-violet-500/25 dark:text-violet-300",
  orange:
    "bg-orange-50 text-orange-600 dark:bg-orange-500/25 dark:text-orange-300",
  slate:
    "bg-slate-100 text-slate-600 dark:bg-slate-500/25 dark:text-slate-200",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/25 dark:text-rose-300",
};

/**
 * Full-card wash: pastel fill in light; matching tinted fill in dark
 * (same “colored tile” energy as light mode, not a thin neon frame).
 */
const toneSurfaceClass: Record<KPICardTone, string> = {
  emerald:
    "border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-background shadow-sm dark:border-emerald-400/40 dark:from-emerald-500/25 dark:via-emerald-950/55 dark:to-card",
  blue:
    "border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-background shadow-sm dark:border-blue-400/40 dark:from-blue-500/25 dark:via-blue-950/55 dark:to-card",
  amber:
    "border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 via-white to-background shadow-sm dark:border-amber-400/40 dark:from-amber-500/25 dark:via-amber-950/55 dark:to-card",
  violet:
    "border-2 border-violet-200 bg-gradient-to-br from-violet-50/80 via-white to-background shadow-sm dark:border-violet-400/40 dark:from-violet-500/25 dark:via-violet-950/55 dark:to-card",
  orange:
    "border-2 border-orange-200 bg-gradient-to-br from-orange-50/80 via-white to-background shadow-sm dark:border-orange-400/40 dark:from-orange-500/25 dark:via-orange-950/55 dark:to-card",
  slate:
    "border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 via-white to-background shadow-sm dark:border-slate-400/35 dark:from-slate-500/20 dark:via-slate-900/60 dark:to-card",
  rose:
    "border-2 border-rose-200 bg-gradient-to-br from-rose-50/80 via-white to-background shadow-sm dark:border-rose-400/40 dark:from-rose-500/25 dark:via-rose-950/55 dark:to-card",
};

/** Clickable filter chips (Parties): inactive = white card, light gray border. */
const toneFilterIdleClass: Record<KPICardTone, string> = {
  emerald: "border border-neutral-200 bg-white shadow-none dark:border-border dark:bg-card",
  blue: "border border-neutral-200 bg-white shadow-none dark:border-border dark:bg-card",
  amber: "border border-neutral-200 bg-white shadow-none dark:border-border dark:bg-card",
  violet: "border border-neutral-200 bg-white shadow-none dark:border-border dark:bg-card",
  orange: "border border-neutral-200 bg-white shadow-none dark:border-border dark:bg-card",
  slate: "border border-neutral-200 bg-white shadow-none dark:border-border dark:bg-card",
  rose: "border border-neutral-200 bg-white shadow-none dark:border-border dark:bg-card",
};

/** Active filter: pale fill + solid tone border (MyBillBook-style). */
const toneFilterActiveClass: Record<KPICardTone, string> = {
  emerald:
    "border border-emerald-500 bg-emerald-50 shadow-none dark:border-emerald-500 dark:bg-emerald-950/25",
  blue: "border border-blue-500 bg-blue-50 shadow-none dark:border-blue-500 dark:bg-blue-950/25",
  amber: "border border-amber-500 bg-amber-50 shadow-none dark:border-amber-500 dark:bg-amber-950/25",
  violet:
    "border border-violet-500 bg-violet-50 shadow-none dark:border-violet-500 dark:bg-violet-950/25",
  orange:
    "border border-orange-500 bg-orange-50 shadow-none dark:border-orange-500 dark:bg-orange-950/25",
  slate: "border border-slate-500 bg-slate-50 shadow-none dark:border-slate-500 dark:bg-slate-900/25",
  rose: "border border-rose-500 bg-rose-50 shadow-none dark:border-rose-500 dark:bg-rose-950/25",
};

const toneFilterHoverClass: Record<KPICardTone, string> = {
  emerald: "hover:border-emerald-400 hover:bg-emerald-50/80",
  blue: "hover:border-blue-400 hover:bg-blue-50/80",
  amber: "hover:border-amber-400 hover:bg-amber-50/80",
  violet: "hover:border-violet-400 hover:bg-violet-50/80",
  orange: "hover:border-orange-400 hover:bg-orange-50/80",
  slate: "hover:border-slate-400 hover:bg-slate-50/80",
  rose: "hover:border-rose-400 hover:bg-rose-50/80",
};

/** Title color on active filter card. */
const toneFilterActiveTitleClass: Record<KPICardTone, string> = {
  emerald: "text-emerald-700 dark:text-emerald-400",
  blue: "text-blue-700 dark:text-blue-400",
  amber: "text-amber-700 dark:text-amber-400",
  violet: "text-violet-700 dark:text-violet-400",
  orange: "text-orange-700 dark:text-orange-400",
  slate: "text-slate-700 dark:text-slate-300",
  rose: "text-rose-700 dark:text-rose-400",
};

/** Title color on idle filter card (colored label like reference). */
const toneFilterIdleTitleClass: Record<KPICardTone, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
  violet: "text-violet-600 dark:text-violet-400",
  orange: "text-orange-600 dark:text-orange-400",
  slate: "text-muted-foreground",
  rose: "text-rose-600 dark:text-rose-400",
};

const toneHoverClass: Record<KPICardTone, string> = {
  emerald:
    "hover:border-emerald-400 hover:bg-emerald-200/80 dark:hover:border-emerald-400/55 dark:hover:from-emerald-500/30",
  blue: "hover:border-blue-400 hover:bg-blue-200/80 dark:hover:border-blue-400/55 dark:hover:from-blue-500/30",
  amber:
    "hover:border-amber-400 hover:bg-amber-200/80 dark:hover:border-amber-400/55 dark:hover:from-amber-500/30",
  violet:
    "hover:border-violet-400 hover:bg-violet-200/80 dark:hover:border-violet-400/55 dark:hover:from-violet-500/30",
  orange:
    "hover:border-orange-400 hover:bg-orange-200/80 dark:hover:border-orange-400/55 dark:hover:from-orange-500/30",
  slate:
    "hover:border-slate-400 hover:bg-slate-200/80 dark:hover:border-slate-400/50 dark:hover:from-slate-500/25",
  rose: "hover:border-rose-400 hover:bg-rose-200/80 dark:hover:border-rose-400/55 dark:hover:from-rose-500/30",
};

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  /** e.g. "All branches" under the metric (competitor-style scope). */
  footerNote?: string;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean; label?: string };
  className?: string;
  tone?: KPICardTone;
  variant?: "default" | "featured";
  /** Shorter card for dense dashboards (e.g. Parties filters). */
  size?: "default" | "compact";
  /** White card + colored icon only (modern SaaS dashboards). */
  surface?: "default" | "minimal";
  /** Shown instead of value when `isEmpty` is true. */
  emptyLabel?: string;
  isEmpty?: boolean;
  /** Hint shown under empty label (e.g. "Revenue will appear after first invoice"). */
  emptyHint?: string;
  /** When set, the whole card is a button (e.g. filter KPIs on Parties). */
  onClick?: () => void;
  /** Highlight when this filter/card is active. */
  active?: boolean;
  /** White card + tone hover border without click (e.g. ledger summary). */
  decorativeHover?: boolean;
  /** Extra classes on the title (e.g. `whitespace-nowrap`). */
  titleClassName?: string;
  /** Extra classes on the value (e.g. smaller currency on narrow mobile tiles). */
  valueClassName?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  footerNote,
  icon: Icon,
  trend,
  className,
  tone,
  variant = "default",
  size = "default",
  surface = "default",
  emptyLabel,
  isEmpty = false,
  emptyHint,
  onClick,
  active,
  decorativeHover = false,
  titleClassName,
  valueClassName,
}: KPICardProps) {
  const isFeatured = variant === "featured";
  const isCompact = size === "compact";
  const interactive = Boolean(onClick);
  const isFilterChip = Boolean(tone) && (interactive || decorativeHover);
  const isMinimal = surface === "minimal";
  const showTrend =
    Boolean(trend) &&
    trend!.value > 0 &&
    !isEmpty &&
    !(typeof value === "number" && value === 0);

  const card = (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col translate-y-0 transform-gpu backface-hidden will-change-transform",
        "transition-[box-shadow,border-color,background-color] duration-200",
        interactive ? "cursor-pointer" : "cursor-default",
        isFilterChip && !active && toneFilterIdleClass[tone!],
        isFilterChip && active && toneFilterActiveClass[tone!],
        isFilterChip && !active && (interactive || decorativeHover) && toneFilterHoverClass[tone!],
        !isFilterChip && tone && isMinimal && "border border-border/60 bg-card shadow-sm min-h-[5.75rem] sm:min-h-[6rem]",
        !isFilterChip && tone && !isMinimal && !active && toneSurfaceClass[tone],
        !isFilterChip && interactive && tone && !isMinimal && !active && toneHoverClass[tone],
        !isFilterChip && interactive && "hover:shadow-md",
        /* Non-clickable tiles: default cursor, no lift — avoids looking actionable */
        !interactive && !decorativeHover && !isMinimal && "hover:shadow-sm",
        isMinimal && !interactive && "hover:shadow-sm",
        !tone && interactive && "hover:shadow-md dark:hover:shadow-md",
        !tone && !interactive && "hover:shadow-sm dark:hover:shadow-sm",
        isFeatured &&
          !tone &&
          "border-emerald-200/70 shadow-sm dark:border-emerald-900/60",
        active &&
          !tone &&
          "border-2 border-primary/40 bg-primary/5 shadow-sm",
        className
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col justify-center",
          isCompact ? "p-2.5 sm:p-3.5" : "p-5 sm:p-6"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between",
            isCompact ? "gap-2" : "gap-3"
          )}
        >
          <div className={cn("min-w-0", isCompact ? "space-y-0" : "space-y-2")}>
            <p
              className={cn(
                "font-medium",
                isCompact ? "text-xs" : "text-sm",
                isFilterChip && active && tone && toneFilterActiveTitleClass[tone],
                isFilterChip && !active && tone && toneFilterIdleTitleClass[tone],
                !isFilterChip && "text-foreground/80 dark:text-foreground/90",
                titleClassName
              )}
            >
              {title}
            </p>
            <p
              className={cn(
                "font-bold tracking-tight",
                isEmpty && "text-sm font-medium text-foreground/75 dark:text-foreground/80",
                !isEmpty && (isFeatured ? "text-3xl" : isCompact ? "text-lg sm:text-xl" : "text-2xl"),
                isCompact && "min-h-[1.375rem] flex items-center",
                valueClassName
              )}
            >
              {isEmpty && emptyLabel ? emptyLabel : value}
            </p>
            {(subtitle || (trend && showTrend) || (isEmpty && emptyHint) || isCompact) && (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-1.5",
                  isCompact && "min-h-[1.125rem]"
                )}
              >
                {trend && showTrend && (
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      trend.isPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {trend.isPositive ? "↑" : "↓"} {trend.value}%
                    {trend.label ? ` ${trend.label}` : ""}
                  </span>
                )}
                {isEmpty && emptyHint && !showTrend && (
                  <span className="text-[11px] text-foreground/65 dark:text-foreground/70">{emptyHint}</span>
                )}
                {subtitle && (
                  <span className="text-xs text-foreground/75 dark:text-slate-300">
                    {subtitle}
                  </span>
                )}
              </div>
            )}
            {footerNote && (
              <p className="text-xs text-foreground/75 dark:text-slate-300 pt-0.5">{footerNote}</p>
            )}
          </div>
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg",
              isFeatured ? "h-12 w-12" : isCompact ? "h-7 w-7 sm:h-9 sm:w-9" : "h-11 w-11",
              tone
                ? toneIconClass[tone]
                : "bg-primary/10 text-primary"
            )}
          >
            <Icon
              className={
                isFeatured ? "h-6 w-6" : isCompact ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-5 w-5"
              }
            />
          </div>
        </div>
      </div>
    </Card>
  );

  if (!onClick) return card;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      aria-pressed={active}
    >
      {card}
    </button>
  );
}
