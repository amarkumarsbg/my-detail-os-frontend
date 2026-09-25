"use client";

import { useEffect, useState } from "react";
import { Clock3, Lock } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { useOrganizationStore } from "@/store/organization-store";
import { formatPaymentStatus, termLabelFromMonths } from "@/lib/subscription-export-lock";
import { formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import type { OrganizationEntitlement } from "@/types";

type RenewResult = {
  entitlement: OrganizationEntitlement;
  payment: { id: string; status: string };
};

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

/** Live countdown until `expiresAtIso` (null when no expiry date). */
function useExpiryCountdown(expiresAtIso: string | null | undefined): CountdownParts | null {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAtIso) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAtIso]);

  if (!expiresAtIso) return null;
  const end = Date.parse(expiresAtIso);
  if (!Number.isFinite(end)) return null;

  const msLeft = end - nowMs;
  const expired = msLeft <= 0;
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    expired,
  };
}

function CountdownUnit({
  value,
  label,
  urgent,
}: {
  value: string;
  label: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[2.75rem] flex-col items-center rounded-lg px-2 py-1.5 sm:min-w-[3.25rem] sm:px-2.5",
        urgent
          ? "bg-red-950/90 text-red-50 shadow-sm shadow-red-900/20"
          : "bg-zinc-950/90 text-amber-50 shadow-sm shadow-black/10"
      )}
    >
      <span className="font-mono text-sm font-semibold leading-none tracking-tight tabular-nums sm:text-base">
        {value}
      </span>
      <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-white/55">
        {label}
      </span>
    </div>
  );
}

function SubscriptionCountdownClock({
  parts,
  expiresAt,
}: {
  parts: CountdownParts;
  expiresAt: string | null;
}) {
  const urgent = parts.expired || parts.days < 3;
  return (
    <div
      className="flex items-center gap-1 sm:gap-1.5"
      title={expiresAt ? `Expires ${new Date(expiresAt).toLocaleString()}` : undefined}
      aria-live="polite"
      aria-label={
        parts.expired
          ? "Subscription overdue"
          : `Time left ${parts.days} days ${parts.hours} hours ${parts.minutes} minutes ${parts.seconds} seconds`
      }
    >
      <CountdownUnit value={String(parts.days)} label="Days" urgent={urgent} />
      <span
        className={cn(
          "pb-3 font-mono text-sm font-bold opacity-40",
          urgent ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-200"
        )}
        aria-hidden
      >
        :
      </span>
      <CountdownUnit value={pad2(parts.hours)} label="Hrs" urgent={urgent} />
      <span
        className={cn(
          "pb-3 font-mono text-sm font-bold opacity-40",
          urgent ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-200"
        )}
        aria-hidden
      >
        :
      </span>
      <CountdownUnit value={pad2(parts.minutes)} label="Min" urgent={urgent} />
      <span
        className={cn(
          "pb-3 font-mono text-sm font-bold opacity-40",
          urgent ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-200"
        )}
        aria-hidden
      >
        :
      </span>
      <CountdownUnit value={pad2(parts.seconds)} label="Sec" urgent={urgent} />
    </div>
  );
}

export function SubscriptionRenewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const setEntitlement = useOrganizationStore((s) => s.setEntitlement);
  const [submitting, setSubmitting] = useState(false);

  const sub = entitlement?.subscription;
  const termMonths = sub?.termMonths ?? 12;

  const submit = async () => {
    setSubmitting(true);
    try {
      const data = await apiPost<RenewResult>("/api/organization/subscription/renew", {
        method: "MANUAL",
        notes: "Renewal requested from studio Pay Now",
      });
      setEntitlement(data.entitlement);
      toast.success("Renewal request submitted", {
        description: "Payment status is Pending. Our team will verify and restore exports.",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit renewal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileSheetContentClasses, "sm:max-w-md")}>
        <DialogHeader className={dialogMobileSheetHeaderClasses}>
          <DialogTitle>Renew subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-6 py-4 text-sm">
          <p>
            Plan: <span className="font-medium">{sub?.planName ?? "—"}</span>
          </p>
          <p>
            Term: <span className="font-medium">{termLabelFromMonths(termMonths)}</span>
          </p>
          <p>
            Expires:{" "}
            <span className="font-medium">
              {sub?.expiresAt || sub?.currentPeriodEnd
                ? formatDate(sub.expiresAt ?? sub.currentPeriodEnd!)
                : "—"}
            </span>
          </p>
          <p>
            Payment status:{" "}
            <span className="font-medium">{formatPaymentStatus(sub?.paymentStatus)}</span>
          </p>
          <p className="text-muted-foreground">
            Submit Pay Now to create a pending renewal. After payment is verified, your expiry
            date extends and exports unlock automatically. Your business data is never deleted.
          </p>
        </div>
        <DialogFooter className="gap-2 border-t px-6 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Submitting…" : "Pay now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubscriptionRenewBanner() {
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const [renewOpen, setRenewOpen] = useState(false);

  useEffect(() => {
    const handler = () => setRenewOpen(true);
    window.addEventListener("subscription:open-renew", handler);
    return () => window.removeEventListener("subscription:open-renew", handler);
  }, []);

  const locked = entitlement?.subscription.exportLocked === true || entitlement?.canExportData === false;
  const days = entitlement?.subscription.daysRemaining;
  const expiresAt =
    entitlement?.subscription.expiresAt ?? entitlement?.subscription.currentPeriodEnd ?? null;
  const show =
    !!entitlement &&
    (locked || (typeof days === "number" && days <= 30));
  const countdown = useExpiryCountdown(show ? expiresAt : null);

  if (!show) {
    return <SubscriptionRenewDialog open={renewOpen} onOpenChange={setRenewOpen} />;
  }

  const expired = countdown?.expired ?? (days ?? 0) < 0;
  const urgent = expired || (typeof days === "number" && days < 3);

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden border-b",
          urgent
            ? "border-red-200/80 bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 dark:border-red-900/40 dark:from-red-950/50 dark:via-orange-950/35 dark:to-amber-950/30"
            : "border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50/90 to-yellow-50/70 dark:border-amber-900/40 dark:from-amber-950/45 dark:via-orange-950/30 dark:to-yellow-950/20"
        )}
      >
        {/* Soft accent wash */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-1",
            urgent ? "bg-red-500" : "bg-amber-500"
          )}
          aria-hidden
        />
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pl-5">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm",
                  urgent
                    ? "border-red-200 bg-white text-red-600 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
                    : "border-amber-200 bg-white text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                )}
              >
                {expired ? <Lock className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-sm font-semibold tracking-tight",
                      urgent
                        ? "text-red-950 dark:text-red-50"
                        : "text-amber-950 dark:text-amber-50"
                    )}
                  >
                    {expired ? "Subscription expired" : "Subscription ending soon"}
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      urgent
                        ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
                        : "bg-amber-100/90 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        urgent ? "animate-pulse bg-red-500" : "bg-amber-500"
                      )}
                      aria-hidden
                    />
                    {expired ? "Locked" : `${days} day${days === 1 ? "" : "s"} left`}
                  </span>
                </div>
                <p className="text-xs text-amber-900/70 dark:text-amber-100/60">
                  Exports stay locked until renewal. Your business data is never deleted.
                </p>
              </div>
            </div>

            {countdown && (
              <SubscriptionCountdownClock parts={countdown} expiresAt={expiresAt} />
            )}
          </div>

          <Button
            type="button"
            size="sm"
            className={cn(
              "h-9 shrink-0 rounded-lg px-4 font-semibold shadow-sm transition-transform active:scale-[0.98]",
              urgent
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-amber-600 text-white hover:bg-amber-700"
            )}
            onClick={() => setRenewOpen(true)}
          >
            Renew / Pay now
          </Button>
        </div>
      </div>
      <SubscriptionRenewDialog open={renewOpen} onOpenChange={setRenewOpen} />
    </>
  );
}
