"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { useOrganizationStore } from "@/store/organization-store";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { formatPaymentStatus, termLabelFromMonths } from "@/lib/subscription-export-lock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Building2,
  Calculator,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  History,
  Sparkles,
  Users,
} from "lucide-react";
import type {
  OrganizationEntitlement,
  PlanCode,
  SubscriptionAddOnBreakdown,
  SubscriptionPricingBreakdown,
  SubscriptionRenewalHistoryRow,
} from "@/types";
import { openRazorpayCheckout, type RazorpayCheckoutPayload } from "@/lib/razorpay-checkout";
import { peekSaasReferral } from "@/lib/saas-referral";
import { PlanCtaButton } from "@/components/billing/plan-cta-link";

type RenewResult = {
  entitlement: OrganizationEntitlement;
  payment: { id: string; status: string };
  checkout?: RazorpayCheckoutPayload | null;
};

type AddOnResult = {
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

function paymentStatusIcon(status: string | null | undefined) {
  switch (status) {
    case "PAID":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "PENDING":
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case "PROCESSING":
      return <RefreshCw className="h-3.5 w-3.5 text-blue-500" />;
    case "FAILED":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    default:
      return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function paymentStatusBadgeVariant(
  status: string | null | undefined
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
      return "default";
    case "PENDING":
    case "PROCESSING":
      return "secondary";
    case "FAILED":
      return "destructive";
    default:
      return "outline";
  }
}

export function SubscriptionRenewalWorkbench({
  entitlement,
  onEntitlementUpdated,
}: {
  entitlement: OrganizationEntitlement;
  onEntitlementUpdated?: () => Promise<void> | void;
}) {
  const setEntitlement = useOrganizationStore((s) => s.setEntitlement);
  const sub = entitlement.subscription;
  const initialPlan = (sub.planCode as PlanCode) || "STARTER";

  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [pricingConfig, setPricingConfig] = useState<PublicPricingConfig>(FALLBACK_PRICING);
  const [plansLoading, setPlansLoading] = useState(true);
  const [planCode, setPlanCode] = useState<PlanCode>(
    SELF_SERVE_PLANS.includes(initialPlan) || initialPlan === "ENTERPRISE"
      ? initialPlan
      : "GROWTH"
  );
  const [termMonths, setTermMonths] = useState<number>(12);
  const [extraBranchesInput, setExtraBranchesInput] = useState("0");
  const [extraUsersInput, setExtraUsersInput] = useState("0");
  const [referralCode, setReferralCode] = useState(
    () => peekSaasReferral() ?? entitlement.organization.referralCode ?? ""
  );
  const [quote, setQuote] = useState<SubscriptionPricingBreakdown | null>(null);
  const [history, setHistory] = useState<SubscriptionRenewalHistoryRow[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [renewLoading, setRenewLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [onlineCheckout, setOnlineCheckout] = useState(false);
  const [addonBranchesInput, setAddonBranchesInput] = useState("0");
  const [addonUsersInput, setAddonUsersInput] = useState("0");
  const [addonQuote, setAddonQuote] = useState<SubscriptionAddOnBreakdown | null>(null);
  const [addonQuoteLoading, setAddonQuoteLoading] = useState(false);
  const [addonLoading, setAddonLoading] = useState(false);
  const walletBalance = entitlement.organization.referralWalletPoints ?? 0;
  const [useWalletPoints, setUseWalletPoints] = useState(walletBalance > 0);
  const [useAddonWalletPoints, setUseAddonWalletPoints] = useState(walletBalance > 0);
  const [walletPointsInput, setWalletPointsInput] = useState(
    walletBalance > 0 ? String(walletBalance) : ""
  );
  const [addonWalletPointsInput, setAddonWalletPointsInput] = useState(
    walletBalance > 0 ? String(walletBalance) : ""
  );

  const extraBranches = useMemo(() => parseCount(extraBranchesInput), [extraBranchesInput]);
  const extraUsers = useMemo(() => parseCount(extraUsersInput), [extraUsersInput]);
  const addonBranches = useMemo(() => parseCount(addonBranchesInput), [addonBranchesInput]);
  const addonUsers = useMemo(() => parseCount(addonUsersInput), [addonUsersInput]);
  const walletPointsToUse = useMemo(() => {
    if (!useWalletPoints) return null;
    const n = parseCount(walletPointsInput);
    return n > 0 ? n : 0;
  }, [useWalletPoints, walletPointsInput]);
  const addonWalletPointsToUse = useMemo(() => {
    if (!useAddonWalletPoints) return null;
    const n = parseCount(addonWalletPointsInput);
    return n > 0 ? n : 0;
  }, [useAddonWalletPoints, addonWalletPointsInput]);
  const normalizedReferral = useMemo(() => {
    const trimmed = referralCode.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [referralCode]);

  // Mid-cycle capacity: ACTIVE + unexpired. Ignore paymentStatus so a pending/failed
  // renew checkout does not hide Add branch / user after a prior paid conversion.
  const canBuyAddOns =
    sub.status === "ACTIVE" &&
    (sub.daysRemaining == null || sub.daysRemaining > 0) &&
    (sub.effectiveMaxBranches != null || sub.effectiveMaxUsers != null);
  const canBuyBranchAddOn = sub.effectiveMaxBranches != null;
  const canBuyUserAddOn = sub.effectiveMaxUsers != null;

  const selectablePlans = useMemo(
    () => plans.filter((p) => p.planCode !== "CUSTOM"),
    [plans]
  );
  const selectedPlan = useMemo(
    () => selectablePlans.find((p) => p.planCode === planCode) ?? null,
    [selectablePlans, planCode]
  );
  const selectedIsPayable = SELF_SERVE_PLANS.includes(planCode);

  const termOptions = useMemo(() => {
    const allowed = selectedPlan?.allowedTerms?.length
      ? selectedPlan.allowedTerms
      : [...ALL_TERMS];
    const multiplier = pricingConfig.planMultipliers[planCode] ?? 1;
    return ALL_TERMS.filter((t) => allowed.includes(t)).map((months) => {
      const termBase =
        pricingConfig.termBasePrices[String(months)] ?? pricingConfig.termBasePrices["12"] ?? 0;
      const price = Math.round(termBase * multiplier * 100) / 100;
      return {
        months,
        base: price,
        label: termLabelFromMonths(months),
      };
    });
  }, [selectedPlan, pricingConfig, planCode]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiGet<{ renewals: SubscriptionRenewalHistoryRow[] }>(
        "/api/organization/subscription/renewals"
      );
      setHistory(data.renewals);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load renewal history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
    void apiGet<{ onlineEnabled?: boolean; provider?: string }>(
      "/api/organization/subscription/payment-config"
    )
      .then((cfg) => setOnlineCheckout(cfg.onlineEnabled === true || cfg.provider === "RAZORPAY"))
      .catch(() => setOnlineCheckout(false));

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
  }, []);

  useEffect(() => {
    if (termOptions.length === 0) return;
    if (termOptions.some((t) => t.months === termMonths)) return;
    const yearly = termOptions.find((t) => t.months === 12);
    setTermMonths(yearly?.months ?? termOptions[0].months);
  }, [termOptions, termMonths]);

  useEffect(() => {
    if (!selectedIsPayable) {
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
          useWalletPoints,
          walletPoints: walletPointsToUse,
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
    planCode,
    termMonths,
    extraBranches,
    extraUsers,
    normalizedReferral,
    useWalletPoints,
    walletPointsToUse,
    selectedIsPayable,
  ]);

  useEffect(() => {
    if (!canBuyAddOns || (addonBranches <= 0 && addonUsers <= 0)) {
      setAddonQuote(null);
      setAddonQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setAddonQuoteLoading(true);
    const timer = window.setTimeout(() => {
      void apiPost<{ breakdown: SubscriptionAddOnBreakdown }>(
        "/api/organization/subscription/addon/pricing",
        {
          extraBranches: canBuyBranchAddOn ? addonBranches : 0,
          extraUsers: canBuyUserAddOn ? addonUsers : 0,
          useWalletPoints: useAddonWalletPoints,
          walletPoints: addonWalletPointsToUse,
        }
      )
        .then((data) => {
          if (!cancelled) setAddonQuote(data.breakdown);
        })
        .catch(() => {
          if (!cancelled) setAddonQuote(null);
        })
        .finally(() => {
          if (!cancelled) setAddonQuoteLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    canBuyAddOns,
    canBuyBranchAddOn,
    canBuyUserAddOn,
    addonBranches,
    addonUsers,
    useAddonWalletPoints,
    addonWalletPointsToUse,
  ]);

  const submitAddOn = async () => {
    if (!canBuyAddOns) return;
    const branches = canBuyBranchAddOn ? addonBranches : 0;
    const users = canBuyUserAddOn ? addonUsers : 0;
    if (branches <= 0 && users <= 0) {
      toast.error("Add at least one extra branch or user");
      return;
    }
    setAddonLoading(true);
    try {
      const data = await apiPost<AddOnResult>("/api/organization/subscription/addon", {
        preferOnline: true,
        notes: "Capacity add-on from settings",
        extraBranches: branches,
        extraUsers: users,
        useWalletPoints: useAddonWalletPoints,
        walletPoints: addonWalletPointsToUse,
      });

      if (data.payment.status === "PAID") {
        setEntitlement(data.entitlement);
        toast.success("Add-on purchased", {
          description:
            (data.entitlement.organization.referralWalletPoints ?? 0) < walletBalance
              ? "Paid with referral wallet points. Limits updated."
              : "Your branch/user limits have been updated.",
        });
        setAddonBranchesInput("0");
        setAddonUsersInput("0");
        await Promise.resolve(onEntitlementUpdated?.());
        await loadHistory();
        return;
      }

      if (data.checkout?.provider === "RAZORPAY") {
        try {
          const rzp = await openRazorpayCheckout(data.checkout);
          const confirmed = await apiPost<{ entitlement: OrganizationEntitlement }>(
            "/api/organization/subscription/confirm-razorpay",
            {
              paymentId: data.checkout.paymentId,
              razorpayOrderId: rzp.razorpay_order_id,
              razorpayPaymentId: rzp.razorpay_payment_id,
              razorpaySignature: rzp.razorpay_signature,
            }
          );
          setEntitlement(confirmed.entitlement);
          toast.success("Add-on purchased", {
            description: "Your branch/user limits have been updated.",
          });
          setAddonBranchesInput("0");
          setAddonUsersInput("0");
          await Promise.resolve(onEntitlementUpdated?.());
          await loadHistory();
          return;
        } catch (payErr) {
          try {
            const synced = await apiPost<{ entitlement: OrganizationEntitlement }>(
              "/api/organization/subscription/sync-razorpay",
              {
                paymentId: data.checkout.paymentId,
                razorpayOrderId: data.checkout.orderId,
              }
            );
            setEntitlement(synced.entitlement);
            toast.success("Add-on purchased", {
              description: "Your branch/user limits have been updated.",
            });
            setAddonBranchesInput("0");
            setAddonUsersInput("0");
            await Promise.resolve(onEntitlementUpdated?.());
            await loadHistory();
            return;
          } catch {
            await apiPost("/api/organization/subscription/sync-razorpay", {
              paymentId: data.checkout.paymentId,
              razorpayOrderId: data.checkout.orderId,
              abandonIfUnpaid: true,
            }).catch(() => undefined);
            toast.error(payErr instanceof Error ? payErr.message : "Payment was not completed");
            return;
          }
        }
      }

      setEntitlement(data.entitlement);
      toast.message("Online checkout unavailable", {
        description:
          "Payment was queued as Pending — an admin can Mark Paid, or configure Razorpay on the API.",
      });
      await Promise.resolve(onEntitlementUpdated?.());
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not purchase add-on");
    } finally {
      setAddonLoading(false);
    }
  };

  const submitRenewal = async () => {
    if (!selectedIsPayable) return;
    setRenewLoading(true);
    try {
      const data = await apiPost<RenewResult>("/api/organization/subscription/renew", {
        preferOnline: true,
        notes: `Renewal requested from settings — ${planCode}`,
        planCode,
        termMonths,
        extraBranches,
        extraUsers,
        referralCode: normalizedReferral,
        useWalletPoints,
        walletPoints: walletPointsToUse,
      });

      if (data.payment.status === "PAID") {
        setEntitlement(data.entitlement);
        toast.success("Payment successful", {
          description:
            (quote?.walletPointsApplied ?? 0) > 0
              ? "Covered by referral wallet points. Your subscription is active."
              : "Your subscription is active.",
        });
        await Promise.resolve(onEntitlementUpdated?.());
        await loadHistory();
        return;
      }

      if (data.checkout?.provider === "RAZORPAY") {
        try {
          const rzp = await openRazorpayCheckout(data.checkout);
          const confirmed = await apiPost<{ entitlement: OrganizationEntitlement }>(
            "/api/organization/subscription/confirm-razorpay",
            {
              paymentId: data.checkout.paymentId,
              razorpayOrderId: rzp.razorpay_order_id,
              razorpayPaymentId: rzp.razorpay_payment_id,
              razorpaySignature: rzp.razorpay_signature,
            }
          );
          setEntitlement(confirmed.entitlement);
          toast.success("Payment successful", {
            description: "Your subscription is active.",
          });
          await Promise.resolve(onEntitlementUpdated?.());
          await loadHistory();
          return;
        } catch (payErr) {
          try {
            const synced = await apiPost<{ entitlement: OrganizationEntitlement }>(
              "/api/organization/subscription/sync-razorpay",
              {
                paymentId: data.checkout.paymentId,
                razorpayOrderId: data.checkout.orderId,
              }
            );
            setEntitlement(synced.entitlement);
            toast.success("Payment successful", {
              description: "Your subscription is active.",
            });
            await Promise.resolve(onEntitlementUpdated?.());
            await loadHistory();
            return;
          } catch {
            await apiPost("/api/organization/subscription/sync-razorpay", {
              paymentId: data.checkout.paymentId,
              razorpayOrderId: data.checkout.orderId,
              abandonIfUnpaid: true,
            }).catch(() => undefined);
            toast.error(payErr instanceof Error ? payErr.message : "Payment was not completed");
            setEntitlement(data.entitlement);
            await loadHistory();
            return;
          }
        }
      }

      setEntitlement(data.entitlement);
      toast.message("Online checkout unavailable", {
        description:
          "Razorpay is not configured on the API. Payment was queued as Pending — an admin can Mark Paid, or add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET and restart the API.",
      });
      await Promise.resolve(onEntitlementUpdated?.());
      await loadHistory();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit renewal request");
    } finally {
      setRenewLoading(false);
    }
  };

  const currentPaymentStatus = entitlement.subscription.paymentStatus;
  const hasPendingPayment =
    currentPaymentStatus === "PENDING" || currentPaymentStatus === "PROCESSING";
  const addOns = pricingConfig.addOns;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Calculator className="h-4 w-4 text-primary" />
          Renew / Upgrade Plan
        </h3>

        {hasPendingPayment && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Payment verification in progress
              </p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Your payment request is{" "}
                {currentPaymentStatus === "PROCESSING" ? "being processed" : "pending verification"}
                . Your subscription and exports will be restored once payment is confirmed.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Plan</Label>
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
                        {sub.planCode === plan.planCode ? (
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
                  <Label className="text-xs">Validity</Label>
                  <Select
                    value={String(termMonths)}
                    onValueChange={(v) => setTermMonths(Number.parseInt(v, 10))}
                  >
                    <SelectTrigger className="h-9">
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
                  <Label className="text-xs">Referral code</Label>
                  <Input
                    className="h-9"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="Optional partner code"
                  />
                  {quote?.referralValidationMessage ? (
                    <p className="text-xs text-destructive">{quote.referralValidationMessage}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    Extra branches
                    {addOns.extraBranchPrice != null
                      ? ` (+${formatCurrency(addOns.extraBranchPrice)})`
                      : ""}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9"
                    value={extraBranchesInput}
                    onChange={(e) => setExtraBranchesInput(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    Extra users
                    {addOns.extraUserPrice != null
                      ? ` (+${formatCurrency(addOns.extraUserPrice)})`
                      : ""}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9"
                    value={extraUsersInput}
                    onChange={(e) => setExtraUsersInput(e.target.value)}
                  />
                </div>
                {(quote?.walletPointsAvailable ?? walletBalance) > 0 ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="use-wallet-points"
                        checked={useWalletPoints}
                        onCheckedChange={(v) => {
                          const on = v === true;
                          setUseWalletPoints(on);
                          if (on && !walletPointsInput) {
                            setWalletPointsInput(
                              String(quote?.walletPointsAvailable ?? walletBalance)
                            );
                          }
                        }}
                      />
                      <Label
                        htmlFor="use-wallet-points"
                        className="text-xs font-normal leading-snug"
                      >
                        Use wallet points ({quote?.walletPointsAvailable ?? walletBalance} available
                        · 1 pt = ₹1 before GST)
                      </Label>
                    </div>
                    {useWalletPoints ? (
                      <div className="flex items-center gap-2 pl-6">
                        <Label htmlFor="wallet-points-amount" className="sr-only">
                          Points to redeem
                        </Label>
                        <Input
                          id="wallet-points-amount"
                          type="number"
                          min={1}
                          max={quote?.walletPointsAvailable ?? walletBalance}
                          className="h-9 w-28 tabular-nums"
                          value={walletPointsInput}
                          onChange={(e) => setWalletPointsInput(e.target.value)}
                          placeholder="e.g. 100"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          points (max {quote?.walletPointsAvailable ?? walletBalance})
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                        <span className="tabular-nums">
                          +{formatCurrency(quote.extraBranchCost)}
                        </span>
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
                        <span className="tabular-nums">
                          −{formatCurrency(quote.referralDiscount)}
                        </span>
                      </div>
                    ) : null}
                    {(quote.walletPointsDiscount ?? 0) > 0 ? (
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Wallet ({quote.walletPointsApplied} pts)
                        </span>
                        <span className="tabular-nums">
                          −{formatCurrency(quote.walletPointsDiscount ?? 0)}
                        </span>
                      </div>
                    ) : null}
                    {quote.referralValidationMessage && !quote.referralApplied ? (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        {quote.referralValidationMessage}
                      </p>
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
              Enterprise is custom-priced. Contact sales to activate.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {selectedIsPayable ? (
              <Button
                type="button"
                size="sm"
                onClick={() => void submitRenewal()}
                disabled={renewLoading || quoteLoading}
              >
                {renewLoading
                  ? "Submitting…"
                  : quote && quote.finalAmount <= 0
                    ? "Redeem points"
                    : onlineCheckout
                      ? "Pay"
                      : "Request payment"}
              </Button>
            ) : (
              <PlanCtaButton
                size="sm"
                dialogTitle="Contact sales"
                href={sub.contactUsUrl || sub.upgradeUrl}
                phone={sub.contactPhone}
              >
                Contact sales
              </PlanCtaButton>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Building2 className="h-4 w-4 text-primary" />
          Add branch / user only
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          No plan change needed — purchase individual capacity for the rest of your current term.
        </p>
        {!canBuyAddOns ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
            {sub.status === "TRIAL" ? (
              <>
                Available after you convert from trial with a paid plan. Then you can buy extra
                branches or users here without picking Starter / Growth again.
              </>
            ) : sub.daysRemaining != null && sub.daysRemaining <= 0 ? (
              <>Subscription expired. Renew your plan above, then you can buy extra capacity here.</>
            ) : sub.effectiveMaxBranches == null && sub.effectiveMaxUsers == null ? (
              <>Your plan already has unlimited branches and users — no add-on purchase needed.</>
            ) : (
              <>Extra branch/user purchase is not available for this subscription right now.</>
            )}
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>Capacity only — expiry unchanged</span>
              <span className="text-border">·</span>
              <span>
                {sub.expiresAt
                  ? formatDate(sub.expiresAt)
                  : sub.currentPeriodEnd
                    ? formatDate(sub.currentPeriodEnd)
                    : "No expiry"}
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {sub.effectiveMaxBranches == null
                  ? "Unlimited"
                  : `${entitlement.usage.branchesUsed}/${sub.effectiveMaxBranches}`}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {sub.effectiveMaxUsers == null
                  ? "Unlimited"
                  : `${entitlement.usage.usersUsed ?? 0}/${sub.effectiveMaxUsers}`}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Extra branches</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 max-w-[7.5rem] tabular-nums"
                    disabled={!canBuyBranchAddOn}
                    value={addonBranchesInput}
                    onChange={(e) => setAddonBranchesInput(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {canBuyBranchAddOn && addOns.extraBranchPrice != null
                      ? `${formatCurrency(addOns.extraBranchPrice)} each`
                      : "Unlimited on this plan"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Extra users</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 max-w-[7.5rem] tabular-nums"
                    disabled={!canBuyUserAddOn}
                    value={addonUsersInput}
                    onChange={(e) => setAddonUsersInput(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {canBuyUserAddOn && addOns.extraUserPrice != null
                      ? `${formatCurrency(addOns.extraUserPrice)} each`
                      : "Unlimited on this plan"}
                  </p>
                </div>
                {(addonQuote?.walletPointsAvailable ?? walletBalance) > 0 ? (
                  <div className="col-span-2 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="use-addon-wallet-points"
                        checked={useAddonWalletPoints}
                        onCheckedChange={(v) => {
                          const on = v === true;
                          setUseAddonWalletPoints(on);
                          if (on && !addonWalletPointsInput) {
                            setAddonWalletPointsInput(
                              String(addonQuote?.walletPointsAvailable ?? walletBalance)
                            );
                          }
                        }}
                      />
                      <Label
                        htmlFor="use-addon-wallet-points"
                        className="text-xs font-normal leading-snug"
                      >
                        Use wallet points (
                        {addonQuote?.walletPointsAvailable ?? walletBalance} available · 1 pt = ₹1
                        before GST)
                      </Label>
                    </div>
                    {useAddonWalletPoints ? (
                      <div className="flex items-center gap-2 pl-6">
                        <Label htmlFor="addon-wallet-points-amount" className="sr-only">
                          Points to redeem
                        </Label>
                        <Input
                          id="addon-wallet-points-amount"
                          type="number"
                          min={1}
                          max={addonQuote?.walletPointsAvailable ?? walletBalance}
                          className="h-9 w-28 tabular-nums"
                          value={addonWalletPointsInput}
                          onChange={(e) => setAddonWalletPointsInput(e.target.value)}
                          placeholder="e.g. 100"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          points (max {addonQuote?.walletPointsAvailable ?? walletBalance})
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col justify-between rounded-xl border bg-muted/30 p-3">
                <div className="space-y-1 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Due now
                  </p>
                  {addonQuoteLoading && !addonQuote ? (
                    <p className="text-xs text-muted-foreground">Calculating…</p>
                  ) : addonQuote ? (
                    <>
                      {addonQuote.extraBranchCost > 0 ? (
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Branches ×{addonQuote.extraBranches}
                          </span>
                          <span className="tabular-nums">
                            {formatCurrency(addonQuote.extraBranchCost)}
                          </span>
                        </div>
                      ) : null}
                      {addonQuote.extraUserCost > 0 ? (
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Users ×{addonQuote.extraUsers}
                          </span>
                          <span className="tabular-nums">
                            {formatCurrency(addonQuote.extraUserCost)}
                          </span>
                        </div>
                      ) : null}
                      {(addonQuote.walletPointsDiscount ?? 0) > 0 ? (
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Wallet ({addonQuote.walletPointsApplied} pts)
                          </span>
                          <span className="tabular-nums">
                            −{formatCurrency(addonQuote.walletPointsDiscount ?? 0)}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          GST ({addonQuote.gstPercent}%)
                        </span>
                        <span className="tabular-nums">
                          +{formatCurrency(addonQuote.gstAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-t pt-1.5 text-sm font-semibold">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {formatCurrency(addonQuote.finalAmount)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Enter a quantity to quote.</p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => void submitAddOn()}
                  disabled={
                    addonLoading ||
                    addonQuoteLoading ||
                    !addonQuote ||
                    (addonBranches <= 0 && addonUsers <= 0)
                  }
                >
                  {addonLoading
                    ? "Submitting…"
                    : addonQuote && addonQuote.finalAmount <= 0
                      ? "Redeem points"
                      : onlineCheckout
                        ? "Pay for add-on"
                        : "Request add-on"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-primary" />
          Renewal History
        </h3>
        {historyLoading ? (
          <p className="text-sm text-muted-foreground">Loading renewal history…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No renewal history yet. History appears after paid renewals.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5">Bill #</th>
                  <th className="px-3 py-2.5">Renewal date</th>
                  <th className="px-3 py-2.5">Term</th>
                  <th className="px-3 py-2.5">Old expiry</th>
                  <th className="px-3 py-2.5">New expiry</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-right">GST</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Txn ref</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={row.billId}
                    className="border-b last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs font-medium">
                      {row.billNumber}
                    </td>
                    <td className="px-3 py-2.5">{formatDate(row.renewalDate)}</td>
                    <td className="px-3 py-2.5">{row.termLabel}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatDate(row.previousExpiry)}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{formatDate(row.newExpiry)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                      {formatCurrency(row.gstAmount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={paymentStatusBadgeVariant(row.paymentStatus)}
                        className="flex w-fit items-center gap-1 text-xs"
                      >
                        {paymentStatusIcon(row.paymentStatus)}
                        {formatPaymentStatus(row.paymentStatus)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {row.txnReference ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
