"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Clock3, Lock, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { useOrganizationStore } from "@/store/organization-store";
import { formatPaymentStatus, termLabelFromMonths } from "@/lib/subscription-export-lock";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { PlanCtaButton } from "@/components/billing/plan-cta-link";
import type { OrganizationEntitlement, PlanCode, SubscriptionPricingBreakdown } from "@/types";
import { openRazorpayCheckout, type RazorpayCheckoutPayload } from "@/lib/razorpay-checkout";

type RenewResult = {
  entitlement: OrganizationEntitlement;
  payment: { id: string; status: string };
  checkout?: RazorpayCheckoutPayload | null;
};

type PublicPlan = {
  planCode: PlanCode;
  planName: string;
  limits: { maxBranches: number | null; maxStaff?: number | null };
  allowedTerms?: number[];
  annualPrice: number;
  currency: string;
};

type PublicPricingConfig = {
  currency: string;
  gstPercent: number;
  termBasePrices: Record<string, number>;
  planMultipliers: Record<string, number>;
  addOns: {
    extraBranchPrice?: number;
    extraUserPrice?: number;
    onboardingFee?: number;
    referralDiscount?: number;
  };
};

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

const ALL_TERMS = [1, 3, 12, 24, 36, 60] as const;
const RECOMMENDED_PLAN: PlanCode = "GROWTH";
const SELF_SERVE_PLANS: PlanCode[] = ["STARTER", "GROWTH", "BUSINESS"];

const FALLBACK_PLANS: PublicPlan[] = [
  {
    planCode: "STARTER",
    planName: "Starter",
    limits: { maxBranches: 1, maxStaff: 3 },
    allowedTerms: [...ALL_TERMS],
    annualPrice: 9999,
    currency: "INR",
  },
  {
    planCode: "GROWTH",
    planName: "Growth",
    limits: { maxBranches: 3, maxStaff: 10 },
    allowedTerms: [...ALL_TERMS],
    annualPrice: 17998,
    currency: "INR",
  },
  {
    planCode: "BUSINESS",
    planName: "Business",
    limits: { maxBranches: 10, maxStaff: 25 },
    allowedTerms: [...ALL_TERMS],
    annualPrice: 29997,
    currency: "INR",
  },
  {
    planCode: "ENTERPRISE",
    planName: "Enterprise",
    limits: { maxBranches: null, maxStaff: null },
    allowedTerms: [...ALL_TERMS],
    annualPrice: 49995,
    currency: "INR",
  },
];

const FALLBACK_PRICING: PublicPricingConfig = {
  currency: "INR",
  gstPercent: 18,
  termBasePrices: { "1": 999, "3": 2499, "12": 9999, "24": 18999, "36": 26999, "60": 41999 },
  planMultipliers: { STARTER: 1, GROWTH: 1.8, BUSINESS: 3, ENTERPRISE: 5 },
  addOns: {
    extraBranchPrice: 2500,
    extraUserPrice: 750,
    onboardingFee: 1500,
    referralDiscount: 1000,
  },
};

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

function parseCount(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function capacityLabel(limits: PublicPlan["limits"]): string {
  const branches =
    limits.maxBranches == null
      ? "Unlimited branches"
      : `${limits.maxBranches} branch${limits.maxBranches === 1 ? "" : "es"}`;
  const users =
    limits.maxStaff == null
      ? "Unlimited users"
      : `${limits.maxStaff} user${limits.maxStaff === 1 ? "" : "s"}`;
  return `${branches} · ${users}`;
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

function CountdownUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-[2.75rem] flex-col items-center rounded-lg bg-zinc-900 px-2 py-1.5 text-white sm:min-w-[3.25rem]">
      <span className="font-mono text-sm font-semibold leading-none tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-white/55">
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
  return (
    <div
      className="flex shrink-0 items-center gap-1"
      title={expiresAt ? `Expires ${new Date(expiresAt).toLocaleString()}` : undefined}
      aria-live="polite"
      aria-label={
        parts.expired
          ? "Subscription overdue"
          : `Time left ${parts.days} days ${parts.hours} hours ${parts.minutes} minutes ${parts.seconds} seconds`
      }
    >
      <CountdownUnit value={String(parts.days)} label="Days" />
      <span className="pb-3 font-mono text-sm font-bold text-amber-800/40">:</span>
      <CountdownUnit value={pad2(parts.hours)} label="Hrs" />
      <span className="pb-3 font-mono text-sm font-bold text-amber-800/40">:</span>
      <CountdownUnit value={pad2(parts.minutes)} label="Min" />
      <span className="pb-3 font-mono text-sm font-bold text-amber-800/40">:</span>
      <CountdownUnit value={pad2(parts.seconds)} label="Sec" />
    </div>
  );
}

async function confirmOrSyncCheckout(
  checkout: RazorpayCheckoutPayload
): Promise<OrganizationEntitlement> {
  try {
    const rzp = await openRazorpayCheckout(checkout);
    const confirmed = await apiPost<{ entitlement: OrganizationEntitlement }>(
      "/api/organization/subscription/confirm-razorpay",
      {
        paymentId: checkout.paymentId,
        razorpayOrderId: rzp.razorpay_order_id,
        razorpayPaymentId: rzp.razorpay_payment_id,
        razorpaySignature: rzp.razorpay_signature,
      }
    );
    return confirmed.entitlement;
  } catch (payErr) {
    try {
      const synced = await apiPost<{ entitlement: OrganizationEntitlement }>(
        "/api/organization/subscription/sync-razorpay",
        {
          paymentId: checkout.paymentId,
          razorpayOrderId: checkout.orderId,
        }
      );
      return synced.entitlement;
    } catch {
      throw payErr instanceof Error ? payErr : new Error("Payment was not completed");
    }
  }
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
  const [plansLoading, setPlansLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [pricingConfig, setPricingConfig] = useState<PublicPricingConfig>(FALLBACK_PRICING);
  const [planCode, setPlanCode] = useState<PlanCode>("GROWTH");
  const [termMonths, setTermMonths] = useState<number>(12);
  const [extraBranchesInput, setExtraBranchesInput] = useState("0");
  const [extraUsersInput, setExtraUsersInput] = useState("0");
  const [referralCode, setReferralCode] = useState("");
  const [quote, setQuote] = useState<SubscriptionPricingBreakdown | null>(null);

  const sub = entitlement?.subscription;
  const isTrial = sub?.status === "TRIAL";
  const selectedIsPayable = SELF_SERVE_PLANS.includes(planCode);
  const extraBranches = useMemo(() => parseCount(extraBranchesInput), [extraBranchesInput]);
  const extraUsers = useMemo(() => parseCount(extraUsersInput), [extraUsersInput]);
  const normalizedReferral = useMemo(() => {
    const t = referralCode.trim();
    return t.length > 0 ? t : null;
  }, [referralCode]);

  const selectablePlans = useMemo(
    () => plans.filter((p) => p.planCode !== "CUSTOM"),
    [plans]
  );
  const selectedPlan = useMemo(
    () => selectablePlans.find((p) => p.planCode === planCode) ?? null,
    [selectablePlans, planCode]
  );

  const termOptions = useMemo(() => {
    const allowed = selectedPlan?.allowedTerms?.length
      ? selectedPlan.allowedTerms
      : [...ALL_TERMS];
    return ALL_TERMS.filter((t) => allowed.includes(t)).map((months) => ({
      months,
      base: pricingConfig.termBasePrices[String(months)] ?? pricingConfig.termBasePrices["12"] ?? 0,
      label: termLabelFromMonths(months),
    }));
  }, [selectedPlan, pricingConfig]);

  useEffect(() => {
    if (!open) return;
    const current = (sub?.planCode as PlanCode | undefined) ?? "STARTER";
    setPlanCode(
      isTrial
        ? RECOMMENDED_PLAN
        : SELF_SERVE_PLANS.includes(current)
          ? current
          : RECOMMENDED_PLAN
    );
    // Always open on yearly — matches the plan card “1-year base” people expect.
    setTermMonths(12);
    setExtraBranchesInput("0");
    setExtraUsersInput("0");
    setReferralCode("");
    setQuote(null);

    let cancelled = false;
    setPlansLoading(true);
    void apiGet<{ plans: PublicPlan[]; pricing?: PublicPricingConfig }>("/api/public/plans")
      .then((data) => {
        if (cancelled) return;
        setPlans((data.plans ?? []).length ? data.plans : FALLBACK_PLANS);
        if (data.pricing) setPricingConfig(data.pricing);
      })
      .catch(() => {
        if (!cancelled) {
          setPlans(FALLBACK_PLANS);
          setPricingConfig(FALLBACK_PRICING);
        }
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sub?.planCode, sub?.termMonths, isTrial]);

  useEffect(() => {
    if (termOptions.length === 0) return;
    if (termOptions.some((t) => t.months === termMonths)) return;
    // Prefer yearly when the current term isn’t offered for this plan.
    const yearly = termOptions.find((t) => t.months === 12);
    setTermMonths(yearly?.months ?? termOptions[0].months);
  }, [termOptions, termMonths]);

  useEffect(() => {
    if (!open || !planCode || !selectedIsPayable) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    const timer = window.setTimeout(() => {
      void apiPost<{ breakdown: SubscriptionPricingBreakdown }>(
        "/api/organization/subscription/pricing",
        {
          planCode,
          termMonths,
          extraBranches,
          extraUsers,
          referralCode: normalizedReferral,
        }
      )
        .then((data) => {
          if (!cancelled) setQuote(data.breakdown);
        })
        .catch(() => {
          if (!cancelled) setQuote(null);
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    open,
    planCode,
    termMonths,
    extraBranches,
    extraUsers,
    normalizedReferral,
    selectedIsPayable,
  ]);

  const submit = async () => {
    if (!selectedIsPayable) return;
    setSubmitting(true);
    try {
      const data = await apiPost<RenewResult>("/api/organization/subscription/renew", {
        preferOnline: true,
        planCode,
        termMonths,
        extraBranches,
        extraUsers,
        referralCode: normalizedReferral,
        notes: isTrial
          ? `Trial upgrade to ${planCode}`
          : `Renewal / upgrade to ${planCode}`,
      });

      if (data.checkout?.provider === "RAZORPAY") {
        try {
          const entitlementNext = await confirmOrSyncCheckout(data.checkout);
          setEntitlement(entitlementNext);
          toast.success("Payment successful", {
            description: "Your subscription is active. Thank you!",
          });
          onOpenChange(false);
          return;
        } catch (payErr) {
          toast.error(payErr instanceof Error ? payErr.message : "Payment was not completed");
          setEntitlement(data.entitlement);
          return;
        }
      }

      setEntitlement(data.entitlement);
      toast.message("Online checkout unavailable", {
        description:
          "Razorpay keys are missing on the API. Payment was queued as Pending — configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then restart the API.",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit renewal");
    } finally {
      setSubmitting(false);
    }
  };

  const addOns = pricingConfig.addOns;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          dialogMobileSheetContentClasses,
          "overflow-hidden sm:max-w-5xl lg:max-w-6xl"
        )}
      >
        <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pb-3")}>
          <DialogTitle>{isTrial ? "Configure your plan" : "Renew / upgrade plan"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-6 py-3">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            {plansLoading ? (
              <p className="text-xs text-muted-foreground">Loading plans…</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {selectablePlans.map((plan) => {
                  const selected = planCode === plan.planCode;
                  const recommended = plan.planCode === RECOMMENDED_PLAN;
                  const customPriced =
                    plan.planCode === "ENTERPRISE" ||
                    (plan.limits.maxBranches == null && plan.limits.maxStaff == null);
                  const multiplier = pricingConfig.planMultipliers[plan.planCode] ?? 1;
                  const termBase =
                    pricingConfig.termBasePrices[String(termMonths)] ??
                    pricingConfig.termBasePrices["12"] ??
                    0;
                  const termPrice = Math.round(termBase * multiplier * 100) / 100;
                  return (
                    <button
                      key={plan.planCode}
                      type="button"
                      onClick={() => setPlanCode(plan.planCode)}
                      className={cn(
                        "flex h-full flex-col rounded-xl border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40",
                        recommended && !selected && "border-[#FB8612]/40"
                      )}
                    >
                      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-1">
                        {recommended ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#FB8612]/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[#C45F0A]">
                            <Sparkles className="h-2.5 w-2.5" />
                            Popular
                          </span>
                        ) : null}
                        {sub?.planCode === plan.planCode ? (
                          <span className="rounded-full bg-muted px-1.5 py-px text-[9px] font-medium text-muted-foreground">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold leading-tight">{plan.planName}</p>
                      <p className="mt-1.5 text-lg font-bold tabular-nums leading-none">
                        {customPriced ? "Custom" : formatCurrency(termPrice)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {customPriced
                          ? "Contact sales"
                          : `${termLabelFromMonths(termMonths)} base`}
                      </p>
                      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                        <p className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {plan.limits.maxBranches == null
                            ? "Unlimited branches"
                            : `${plan.limits.maxBranches} branches`}
                        </p>
                        <p className="flex items-center gap-1">
                          <Users className="h-3 w-3 shrink-0" />
                          {plan.limits.maxStaff == null
                            ? "Unlimited users"
                            : `${plan.limits.maxStaff} users`}
                        </p>
                      </div>
                      {selected ? (
                        <p className="mt-auto pt-2 text-center text-[11px] font-semibold text-primary">
                          Selected
                        </p>
                      ) : (
                        <p className="mt-auto pt-2 text-center text-[11px] text-muted-foreground">
                          Tap to select
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedIsPayable ? (
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="cfg-term" className="text-xs">
                    Validity
                  </Label>
                  <Select
                    value={String(termMonths)}
                    onValueChange={(v) => setTermMonths(Number(v))}
                  >
                    <SelectTrigger id="cfg-term" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {termOptions.map((t) => (
                        <SelectItem key={t.months} value={String(t.months)}>
                          {t.label} — {formatCurrency(t.base)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cfg-referral" className="text-xs">
                    Referral code
                  </Label>
                  <Input
                    id="cfg-referral"
                    className="h-9"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder={
                      addOns.referralDiscount
                        ? `Optional (−${formatCurrency(addOns.referralDiscount)})`
                        : "Optional"
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cfg-branches" className="text-xs">
                    Extra branches
                    {addOns.extraBranchPrice != null
                      ? ` (+${formatCurrency(addOns.extraBranchPrice)})`
                      : ""}
                  </Label>
                  <Input
                    id="cfg-branches"
                    type="number"
                    min={0}
                    className="h-9"
                    value={extraBranchesInput}
                    onChange={(e) => setExtraBranchesInput(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cfg-users" className="text-xs">
                    Extra users
                    {addOns.extraUserPrice != null
                      ? ` (+${formatCurrency(addOns.extraUserPrice)})`
                      : ""}
                  </Label>
                  <Input
                    id="cfg-users"
                    type="number"
                    min={0}
                    className="h-9"
                    value={extraUsersInput}
                    onChange={(e) => setExtraUsersInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Pricing summary
                </p>
                {quoteLoading && !quote ? (
                  <p className="text-xs text-muted-foreground">Calculating…</p>
                ) : quote ? (
                  <div className="space-y-1">
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">Base ({quote.planName})</span>
                      <span className="tabular-nums">{formatCurrency(quote.baseAmount)}</span>
                    </div>
                    {quote.extraBranchCost > 0 ? (
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Extra branches ({quote.extraBranches})
                        </span>
                        <span className="tabular-nums">+{formatCurrency(quote.extraBranchCost)}</span>
                      </div>
                    ) : null}
                    {quote.extraUserCost > 0 ? (
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Extra users ({quote.extraUsers})
                        </span>
                        <span className="tabular-nums">+{formatCurrency(quote.extraUserCost)}</span>
                      </div>
                    ) : null}
                    {quote.onboardingApplied ? (
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">Onboarding</span>
                        <span className="tabular-nums">+{formatCurrency(quote.onboardingFee)}</span>
                      </div>
                    ) : null}
                    {quote.referralDiscount > 0 ? (
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">Referral</span>
                        <span className="tabular-nums">−{formatCurrency(quote.referralDiscount)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">GST ({quote.gstPercent}%)</span>
                      <span className="tabular-nums">+{formatCurrency(quote.gstAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-2 border-t pt-1.5 text-sm font-semibold">
                      <span>Total due</span>
                      <span className="tabular-nums">{formatCurrency(quote.finalAmount)}</span>
                    </div>
                    {selectedPlan ? (
                      <p className="pt-0.5 text-[10px] text-muted-foreground">
                        {capacityLabel(selectedPlan.limits)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Unable to load quote.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
              Enterprise is custom-priced in admin. Contact sales to activate.
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            {isTrial ? "Trial ends" : "Expires"}:{" "}
            {sub?.expiresAt || sub?.currentPeriodEnd
              ? formatDate(sub.expiresAt ?? sub.currentPeriodEnd!)
              : "—"}
            {" · "}
            Payment: {formatPaymentStatus(sub?.paymentStatus)}
          </p>
        </div>

        <DialogFooter className="gap-2 border-t px-6 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {selectedIsPayable ? (
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || quoteLoading || !planCode}
            >
              {submitting ? "Opening…" : "Pay"}
            </Button>
          ) : (
            <PlanCtaButton
              className="h-9"
              dialogTitle="Contact sales"
              href={sub?.contactUsUrl || sub?.upgradeUrl}
              phone={sub?.contactPhone}
            >
              Contact sales
            </PlanCtaButton>
          )}
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
  const sub = entitlement?.subscription;
  if (!sub) return null;

  const expiresAt = sub.expiresAt ?? sub.currentPeriodEnd;
  const countdown = useExpiryCountdown(expiresAt);
  const isTrial = sub.status === "TRIAL";
  const paymentPending =
    sub.paymentStatus === "PENDING" || sub.paymentStatus === "PROCESSING";

  // Ceiling days so "6d 23h" shows as "7 DAYS LEFT" (matches demo banner).
  const daysLeftBadge = (() => {
    if (!expiresAt) return sub.daysRemaining ?? null;
    const end = Date.parse(expiresAt);
    if (!Number.isFinite(end)) return sub.daysRemaining ?? null;
    const ms = end - Date.now();
    if (ms <= 0) return 0;
    return Math.max(1, Math.ceil(ms / 86_400_000));
  })();
  const daysLeft = countdown?.days ?? sub.daysRemaining ?? null;
  const showBanner =
    isTrial ||
    locked ||
    paymentPending ||
    (typeof daysLeft === "number" && daysLeft <= 30) ||
    countdown?.expired === true;

  if (!showBanner && !renewOpen) {
    return <SubscriptionRenewDialog open={renewOpen} onOpenChange={setRenewOpen} />;
  }

  // Only go red when expired / locked — trial with days left stays cream like demo.
  const urgent = Boolean(locked || countdown?.expired === true);
  const ctaLabel = isTrial
    ? countdown?.expired
      ? "Upgrade / Convert"
      : "Upgrade plan"
    : "Renew / Pay now";

  // Same layout/copy pattern as demo (image 1); trial only changes the title + CTA.
  const title = isTrial
    ? countdown?.expired
      ? "Free trial ended"
      : "Free trial ending soon"
    : locked
      ? "Exports locked"
      : paymentPending
        ? "Payment in progress"
        : "Subscription ending soon";

  const subtitle = isTrial
    ? "Upgrade anytime — pick a plan and pay online to activate."
    : "Exports stay locked until renewal. Your business data is never deleted.";

  const daysBadgeLabel = countdown?.expired
    ? "EXPIRED"
    : typeof daysLeftBadge === "number"
      ? `${daysLeftBadge} DAY${daysLeftBadge === 1 ? "" : "S"} LEFT`
      : null;

  return (
    <>
      {showBanner ? (
        <div
          className={cn(
            "mb-3 grid grid-cols-1 items-center gap-2 rounded-lg border border-amber-200/90 bg-[#FFF8F0] px-2.5 py-2 shadow-sm sm:grid-cols-3 sm:gap-3 sm:px-3",
            "border-l-[3px] border-l-[#FB8612]",
            urgent && "border-red-200 bg-red-50/90 border-l-red-500"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                urgent ? "bg-red-100 text-red-700" : "bg-[#FB8612]/15 text-[#C45F0A]"
              )}
            >
              {locked ? <Lock className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex flex-wrap items-center gap-1.5">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    urgent ? "text-red-950" : "text-amber-950"
                  )}
                >
                  {title}
                </p>
                {daysBadgeLabel ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-bold tracking-wide uppercase",
                      urgent
                        ? "bg-red-100 text-red-700"
                        : "bg-[#FB8612]/15 text-[#C45F0A]"
                    )}
                  >
                    <span className="size-1 rounded-full bg-current" aria-hidden />
                    {daysBadgeLabel}
                  </span>
                ) : null}
              </div>
              <p
                className={cn(
                  "truncate text-[11px]",
                  urgent ? "text-red-900/70" : "text-amber-900/70"
                )}
              >
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            {countdown ? (
              <SubscriptionCountdownClock parts={countdown} expiresAt={expiresAt} />
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0 rounded-md bg-[#FB8612] px-3 text-xs font-semibold text-white hover:bg-[#e5780f]"
              onClick={() => setRenewOpen(true)}
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      ) : null}
      <SubscriptionRenewDialog open={renewOpen} onOpenChange={setRenewOpen} />
    </>
  );
}
