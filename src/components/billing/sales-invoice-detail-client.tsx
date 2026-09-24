"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useDashboardStoresReady } from "@/hooks/use-dashboard-stores-ready";
import {
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronDown,
  Download,
  Share2,
  Gift,
  Coins,
  Ticket,
  Trash2,
  Pencil,
  Plus,
  Minus,
  Percent,
  BookMarked,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RecordPaymentDialog } from "@/components/billing/record-payment-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { useInvoiceStore } from "@/store/invoice-store";
import { useJobCardStore } from "@/store/job-card-store";
import { useAuthStore } from "@/store/auth-store";
import { useCustomerStore } from "@/store/customer-store";
import { useSettingsStore } from "@/store/settings-store";
import { useCustomerRewardSettingsStore } from "@/store/customer-reward-settings-store";
import { useMembershipStore } from "@/store/membership-store";
import {
  canRedeemRewardPoints,
  loyaltyPointsEarned,
  maxRedeemablePoints,
  pointsRedeemedFromInvoice,
  rewardDiscountFromPoints,
  rewardRedemptionHelpText,
  validateRewardPointsRedemption,
} from "@/lib/customer-reward-config";
import { useVehicleStore } from "@/store/vehicle-store";
import { userCanCreate } from "@/lib/rbac";
import { resolveMembershipInvoiceDetails, vehicleMakeModelLabel } from "@/lib/membership-invoice";
import { useInventoryStore } from "@/store/inventory-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { pushActivityLog } from "@/lib/activity-log-helper";
import { formatCurrency } from "@/lib/utils";
import { filterCounterSaleParts } from "@/lib/inventory/part-used-in";
import { formatAvailableStock, getSelectableUnits, getUnitPrice, partMatchesInventorySearch } from "@/lib/inventory/multi-unit";
import { ServiceSearchInput } from "@/components/services/searchable-service-select";
import { buildInvoiceWhatsAppMessage } from "@/lib/whatsapp-customer-messages";
import {
  sendCustomerWhatsApp,
  openWhatsAppComposer,
  isWhatsAppNotConfiguredError,
} from "@/lib/whatsapp-send";
import { isResendNotConfiguredError } from "@/lib/invoice-email-send";
import {
  paymentDisplayNumber,
  paymentInDetailPath,
} from "@/lib/billing/payment-helpers";
import { appendReturnTo } from "@/lib/navigation/return-to";
import { DetailBackButton } from "@/components/shared/detail-back-button";
import { useNotificationStore } from "@/store/notification-store";
import { apiGet, ApiError } from "@/lib/api-client";
import {
  invoicePdfFilename,
  prefetchInvoicePdf,
  sendInvoiceEmailWithPdf,
  warmInvoicePdfEngine,
  type InvoicePdfOpts,
} from "@/lib/invoice-pdf";
import { buildInvoiceEmailHtml, buildTaxInvoicePrintHtml, formatInvoiceVehicleDetailsLine, taxRateAsFraction, taxRateAsPercentLabel } from "@/lib/tax-invoice-format";
import { invoiceCustomerDocumentLabel } from "@/lib/invoice-source";
import {
  canApplyReferralOnInvoice,
  invoiceCarriesReferral,
  REFERRAL_EXISTING_CUSTOMER_MESSAGE,
} from "@/lib/referral-eligibility";
import { creditReferralWalletsForInvoice } from "@/lib/referral-wallet-credits";
import { resolveReferralProgramRewards } from "@/lib/referral-program-rewards";
import { useWalletStore } from "@/store/wallet-store";
import { useReferralSettingsStore } from "@/store/referral-settings-store";
import { DEFAULT_GST_RATE, isGstRegistered } from "@/lib/gst-tax";
import { cn, formatInrTable } from "@/lib/utils";
import { toast } from "sonner";
import { assertCanExportData } from "@/lib/assert-can-export";
import type { Invoice, InvoiceLineItem, JobCard, Part, PaymentMethod, ServiceCatalogItem } from "@/types";
import { Textarea } from "@/components/ui/textarea";

function InvoicePartPickSelect({
  parts,
  onPick,
}: {
  parts: Part[];
  onPick: (part: Part) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const list = parts.filter((p) => partMatchesInventorySearch(p, query));
    return list.slice(0, 80);
  }, [parts, query]);

  return (
    <Select
      value=""
      onValueChange={(id) => {
        const part = parts.find((p) => p.id === id);
        if (part) onPick(part);
      }}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      <SelectTrigger className="h-9">
        <SelectValue placeholder="Pick from inventory parts…" />
      </SelectTrigger>
      <SelectContent className="max-h-[min(18rem,50vh)]">
        <div
          className="sticky top-0 z-10 border-b border-border bg-popover p-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ServiceSearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search name, SKU, barcode…"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No parts match
          </div>
        ) : (
          filtered.map((p) => {
            const units = getSelectableUnits(p);
            const primaryUnit = units[0] ?? p.primaryUnit;
            const primaryPrice = getUnitPrice(p, primaryUnit);
            const secondaryUnit = p.secondaryUnit;
            const secondaryPrice = secondaryUnit ? getUnitPrice(p, secondaryUnit) : null;
            const stockStr = formatAvailableStock(p);
            
            return (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex flex-col gap-0.5 py-0.5 text-left w-[360px] sm:w-[480px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium leading-snug">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                      {stockStr}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono flex flex-wrap gap-x-2">
                    <span>SKU: {p.sku}</span>
                    <span>·</span>
                    <span>{formatCurrency(primaryPrice)}/{primaryUnit}</span>
                    {secondaryUnit && secondaryPrice != null && (
                      <>
                        <span>·</span>
                        <span>{formatCurrency(secondaryPrice)}/{secondaryUnit}</span>
                      </>
                    )}
                  </div>
                </div>
              </SelectItem>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
}

function InvoiceServicePickSelect({
  services,
  onPick,
}: {
  services: ServiceCatalogItem[];
  onPick: (svc: ServiceCatalogItem) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = services.filter((s) => s.isActive !== false);
    if (!q) return active.slice(0, 80);
    return active
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      )
      .slice(0, 80);
  }, [services, query]);

  return (
    <Select
      value=""
      onValueChange={(id) => {
        const svc = services.find((s) => s.id === id);
        if (svc) onPick(svc);
      }}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
    >
      <SelectTrigger className="h-9">
        <SelectValue placeholder="Pick from services…" />
      </SelectTrigger>
      <SelectContent className="max-h-[min(18rem,50vh)]">
        <div
          className="sticky top-0 z-10 border-b border-border bg-popover p-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ServiceSearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search services…"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No services match
          </div>
        ) : (
          filtered.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="flex flex-col gap-0.5 py-0.5 text-left">
                <span className="text-sm leading-snug">{s.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {s.category} · {formatCurrency(s.defaultPrice)}
                </span>
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

function recalculateInvoiceFromLines(
  lineItems: InvoiceLineItem[],
  taxRate: number,
  discountAmount: number,
  rewardDiscount: number,
  referralDiscount: number,
  walletAmountUsed: number,
  gstRegistered: boolean
) {
  const subtotal =
    Math.round(lineItems.reduce((sum, li) => sum + li.total, 0) * 100) / 100;
  const reductions = Math.max(0, discountAmount) + Math.max(0, rewardDiscount) + Math.max(0, referralDiscount);
  const taxable = Math.max(0, subtotal - reductions);
  const effectiveRate = gstRegistered ? taxRateAsFraction(taxRate || DEFAULT_GST_RATE) : 0;
  const taxAmount = Math.round(taxable * effectiveRate * 100) / 100;
  const grandTotal = Math.round((taxable + taxAmount) * 100) / 100;
  return { subtotal, taxAmount, grandTotal, walletAmountUsed };
}

/** Persisted `lineDiscount` is ₹; edit UI works in %. */
function lineDiscountPercent(qty: number, unitPrice: number, discountInr: number): number {
  const gross = qty * unitPrice;
  if (gross <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, discountInr) / gross) * 10000) / 100);
}

function lineDiscountInrFromPercent(qty: number, unitPrice: number, percent: number): number {
  const p = Math.min(100, Math.max(0, percent));
  return Math.round(qty * unitPrice * (p / 100) * 100) / 100;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI", icon: Smartphone },
  { value: "CARD", label: "Card", icon: CreditCard },
];

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  const config = PAYMENT_METHODS.find((m) => m.value === method);
  const Icon = config?.icon ?? Banknote;
  return (
    <Badge variant="outline" className="gap-1.5">
      <Icon className="w-3.5 h-3.5" />
      {config?.label ?? method}
    </Badge>
  );
}

type SalesInvoiceDetailClientProps = {
  invoiceId: string;
};

export function SalesInvoiceDetailClient({ invoiceId: id }: SalesInvoiceDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnQuery = searchParams.toString();
  const currentReturnPath = returnQuery ? `${pathname}?${returnQuery}` : pathname;
  const storesReady = useDashboardStoresReady();

  const invoices = useInvoiceStore((s) => s.invoices);
  const updateInvoice = useInvoiceStore((s) => s.updateInvoice);
  const jobCards = useJobCardStore((s) => s.jobCards);
  const [singleInvoice, setSingleInvoice] = useState<Invoice | null>(null);
  const [singleJobCard, setSingleJobCard] = useState<JobCard | null>(null);
  const [singleFetchDone, setSingleFetchDone] = useState(false);

  useEffect(() => {
    setSingleInvoice(null);
    setSingleJobCard(null);
    setSingleFetchDone(false);
  }, [id]);
  const user = useAuthStore((s) => s.user);
  const getActiveMembership = useMembershipStore((s) => s.getActiveMembership);
  const membershipPackages = useMembershipStore((s) => s.packages);
  const membershipSubscriptions = useMembershipStore((s) => s.subscriptions);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const rawParts = useInventoryStore((s) => s.parts);
  const inventoryParts = useMemo(() => filterCounterSaleParts(rawParts), [rawParts]);
  const serviceCatalog = useServiceCatalogStore((s) => s.catalog);

  const invoice = useMemo(
    () => invoices.find((inv) => inv.id === id) ?? singleInvoice,
    [invoices, id, singleInvoice]
  );

  const jobCard = useMemo(() => {
    if (!invoice) return null;
    const fromStore = jobCards.find((jc) => jc.id === invoice.jobCardId);
    return fromStore ?? (singleJobCard && singleJobCard.id === invoice.jobCardId ? singleJobCard : null);
  }, [invoice, jobCards, singleJobCard]);

  useEffect(() => {
    let cancelled = false;
    if (invoice || singleFetchDone) return;
    void (async () => {
      try {
        const data = await apiGet<{ item: Invoice }>(`/api/invoices/${encodeURIComponent(id)}`);
        if (cancelled || !data.item) return;
        setSingleInvoice(data.item);
        useInvoiceStore.setState((state) => {
          if (state.invoices.some((inv) => inv.id === data.item.id)) return state;
          return { invoices: [data.item, ...state.invoices] };
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          // Keep not-found UX.
        }
      } finally {
        if (!cancelled) setSingleFetchDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, invoice, singleFetchDone]);

  useEffect(() => {
    let cancelled = false;
    if (!invoice || jobCard) return;
    const invoiceJobCardId = invoice.jobCardId;
    if (!invoiceJobCardId) return;
    void (async () => {
      try {
        const data = await apiGet<{ item: JobCard }>(
          `/api/job-cards/${encodeURIComponent(invoiceJobCardId)}`
        );
        if (cancelled || !data.item) return;
        setSingleJobCard(data.item);
        useJobCardStore.setState((state) => {
          if (state.jobCards.some((jc) => jc.id === data.item.id)) return state;
          return { jobCards: [data.item, ...state.jobCards] };
        });
      } catch {
        // Optional optimization only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoice, jobCard]);

  const { customers } = useCustomerStore();
  const addWalletTransaction = useWalletStore((s) => s.addTransaction);
  const {
    gstRegistrationStatus,
    businessName,
    businessTagline,
    businessPhone,
    businessWhatsApp,
    businessEmail,
    businessAddress,
    businessWebsite,
    gstin,
    companyPan,
    bankName,
    bankBranch,
    bankAccountNumber,
    bankIfsc,
    bankUpi,
  } = useSettingsStore();

  const referralProgram = useReferralSettingsStore();
  const referralRewards = useMemo(
    () =>
      resolveReferralProgramRewards({
        program: referralProgram,
        jobSubtotalInr: invoice?.subtotal ?? 0,
      }),
    [
      invoice?.subtotal,
      referralProgram.programEnabled,
      referralProgram.advocateRewardMode,
      referralProgram.advocateAmount,
      referralProgram.newCustomerRewardMode,
      referralProgram.newCustomerAmount,
      referralProgram.minJobAmountInr,
    ]
  );
  const referralBuyerAmount = referralRewards.buyerAmount;
  const referralAdvocateAmount = referralRewards.advocateAmount;

  const invoiceCustomer = useMemo(
    () => (invoice ? customers.find((c) => c.id === invoice.customerId) : null),
    [invoice, customers]
  );

  const canApplyReferral = useMemo(
    () =>
      Boolean(
        referralProgram.programEnabled &&
          invoice &&
          canApplyReferralOnInvoice({
            customer: invoiceCustomer,
            invoices,
            currentInvoiceId: invoice.id,
            jobCards,
            currentJobCardId: invoice.jobCardId,
          })
      ),
    [invoice, invoiceCustomer, invoices, jobCards, referralProgram.programEnabled]
  );

  const membershipForInvoice = useMemo(() => {
    if (!invoice) return null;
    if (invoice.membershipId) {
      const snap = membershipSubscriptions.find((s) => s.id === invoice.membershipId);
      if (snap) return snap;
      return {
        id: invoice.membershipId,
        customerId: invoice.customerId,
        packageId: "",
        startDate: "",
        endDate: "",
        status: "ACTIVE" as const,
      };
    }
    const viaUsage = membershipSubscriptions.find((sub) =>
      (sub.usageHistory ?? []).some((u) => u.jobCardId === invoice.jobCardId)
    );
    if (viaUsage) return viaUsage;
    return (
      getActiveMembership(invoice.customerId, jobCard?.vehicleId) ??
      getActiveMembership(invoice.customerId) ??
      null
    );
  }, [invoice, jobCard?.vehicleId, getActiveMembership, membershipSubscriptions]);

  const membershipPackageName = useMemo(() => {
    if (invoice?.membershipPackageName) return invoice.membershipPackageName;
    if (!membershipForInvoice?.packageId) return undefined;
    return membershipPackages.find((p) => p.id === membershipForInvoice.packageId)?.name;
  }, [invoice?.membershipPackageName, membershipForInvoice, membershipPackages]);

  const membershipVehicle = useMemo(() => {
    if (!invoice) return null;
    const vehicleId = membershipForInvoice?.vehicleId ?? jobCard?.vehicleId;
    if (vehicleId) {
      const byId = vehicles.find((v) => v.id === vehicleId);
      if (byId) return byId;
    }
    const reg = invoice.vehicleRegNumber?.trim();
    if (!reg || reg === "—") return null;
    return (
      vehicles.find(
        (v) => v.registrationNumber.replace(/\s+/g, "").toUpperCase() === reg.replace(/\s+/g, "").toUpperCase()
      ) ?? null
    );
  }, [invoice, membershipForInvoice?.vehicleId, jobCard?.vehicleId, vehicles]);

  const membershipDetails = useMemo(() => {
    if (!invoice) return null;
    const resolved = resolveMembershipInvoiceDetails({
      invoice,
      membership: membershipForInvoice,
      packageName: membershipPackageName,
      vehicle: membershipVehicle,
    });
    if (resolved) return resolved;
    if (!invoice.membershipId && !invoice.membershipPackageName) return null;
    return {
      packageName: invoice.membershipPackageName || membershipPackageName || "Membership",
      validFrom: invoice.membershipStartDate || membershipForInvoice?.startDate || "",
      validUntil: invoice.membershipEndDate || membershipForInvoice?.endDate || "",
      vehicleName:
        invoice.vehicleMakeModel ||
        jobCard?.vehicleMakeModel ||
        vehicleMakeModelLabel(membershipVehicle) ||
        "",
      vehicleRegNumber: invoice.vehicleRegNumber || membershipVehicle?.registrationNumber || "",
      membershipId: invoice.membershipId || membershipForInvoice?.id || "",
    };
  }, [invoice, membershipForInvoice, membershipPackageName, membershipVehicle, jobCard?.vehicleMakeModel]);

  const resolvedVehicleMakeModel =
    membershipDetails?.vehicleName ||
    invoice?.vehicleMakeModel ||
    jobCard?.vehicleMakeModel ||
    vehicleMakeModelLabel(membershipVehicle) ||
    "—";

  const invoiceVehicle = useMemo(() => {
    if (membershipVehicle) return membershipVehicle;
    if (!jobCard?.vehicleId) return null;
    return vehicles.find((v) => v.id === jobCard.vehicleId) ?? null;
  }, [membershipVehicle, jobCard?.vehicleId, vehicles]);

  const vehicleDetailsLine = useMemo(
    () =>
      formatInvoiceVehicleDetailsLine({
        variant: invoiceVehicle?.variant,
        year: invoiceVehicle?.year,
        fuelType: invoiceVehicle?.fuelType,
        color: invoiceVehicle?.color,
      }),
    [invoiceVehicle]
  );

  const odometerReading =
    invoice?.odometerReading != null && Number.isFinite(invoice.odometerReading)
      ? invoice.odometerReading
      : jobCard?.odometerReading != null && Number.isFinite(jobCard.odometerReading)
        ? jobCard.odometerReading
        : invoiceVehicle?.odometer;

  // Persist membership snapshot on older invoices so PDF / public share keep the ID.
  useEffect(() => {
    if (!invoice) return;
    const patch: Partial<Invoice> = {};
    if (!invoice.membershipId && membershipForInvoice?.id) {
      patch.membershipId = membershipForInvoice.id;
      patch.membershipPackageName = membershipPackageName;
    }
    if (invoice.source === "MEMBERSHIP" && membershipDetails) {
      if (!invoice.membershipPackageName && membershipDetails.packageName) {
        patch.membershipPackageName = membershipDetails.packageName;
      }
      if (!invoice.membershipStartDate && membershipDetails.validFrom) {
        patch.membershipStartDate = membershipDetails.validFrom;
      }
      if (!invoice.membershipEndDate && membershipDetails.validUntil) {
        patch.membershipEndDate = membershipDetails.validUntil;
      }
      if (!invoice.vehicleMakeModel && membershipDetails.vehicleName) {
        patch.vehicleMakeModel = membershipDetails.vehicleName;
      }
    }
    if (Object.keys(patch).length === 0) return;
    void updateInvoice(invoice.id, patch);
  }, [invoice, membershipForInvoice?.id, membershipPackageName, membershipDetails, updateInvoice]);

  const payments = useMemo(() => invoice?.payments ?? [], [invoice]);
  const canEditInvoice =
    Boolean(invoice) &&
    payments.length === 0 &&
    (invoice?.walletAmountUsed ?? 0) <= 0 &&
    invoice?.status !== "PAID" &&
    invoice?.status !== "PARTIALLY_PAID";

  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLines, setEditLines] = useState<InvoiceLineItem[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Local edit states for discounts
  const [flatDiscountType, setFlatDiscountType] = useState<"percentage" | "fixed">("fixed");
  const [flatDiscountStr, setFlatDiscountStr] = useState(() => invoice ? String(invoice.discountAmount || "") : "");
  const [pointsRedeemStr, setPointsRedeemStr] = useState(() => {
    if (!invoice) return "";
    const pts = pointsRedeemedFromInvoice(invoice);
    return pts > 0 ? String(pts) : "";
  });
  const [referralCode, setReferralCode] = useState(() => invoice ? String(invoice.referralCodeUsed || "") : "");
  const [appliedReferrerId, setAppliedReferrerId] = useState(() => invoice ? invoice.referralAdvocateId || "" : "");
  const [referralDiscountApplied, setReferralDiscountApplied] = useState(() => invoice ? invoice.referralDiscount || 0 : 0);
  const [referralVerifiedMsg, setReferralVerifiedMsg] = useState("");
  const [referralErrorMsg, setReferralErrorMsg] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const availablePoints = invoiceCustomer?.rewardPoints ?? 0;
  const rewardPointsPer100 = useCustomerRewardSettingsStore((s) => s.pointsPer100);
  const rewardPointValue = useCustomerRewardSettingsStore((s) => s.pointValue);
  const rewardReferralBonus = useCustomerRewardSettingsStore((s) => s.referralBonus);
  const rewardMinRedeem = useCustomerRewardSettingsStore((s) => s.minRedeem);
  const rewardMaxRedeem = useCustomerRewardSettingsStore((s) => s.maxRedeem);
  const rewardConfigSnapshot = useMemo(
    () => ({
      pointsPer100: rewardPointsPer100,
      pointValue: rewardPointValue,
      referralBonus: rewardReferralBonus,
      minRedeem: rewardMinRedeem,
      ...(rewardMaxRedeem != null ? { maxRedeem: rewardMaxRedeem } : {}),
    }),
    [
      rewardPointsPer100,
      rewardPointValue,
      rewardReferralBonus,
      rewardMinRedeem,
      rewardMaxRedeem,
    ]
  );

  useEffect(() => {
    if (invoice && typeof window !== "undefined") {
      const draftFlat = sessionStorage.getItem(`draft-flat-${invoice.id}`);
      const draftFlatType = sessionStorage.getItem(`draft-flat-type-${invoice.id}`);
      const draftReward = sessionStorage.getItem(`draft-reward-${invoice.id}`);
      const draftCode = sessionStorage.getItem(`draft-code-${invoice.id}`);
      const draftAdvocate = sessionStorage.getItem(`draft-advocate-${invoice.id}`);
      const draftRefDiscount = sessionStorage.getItem(`draft-refdiscount-${invoice.id}`);

      if (draftFlatType === "percentage" || draftFlatType === "fixed") {
        setFlatDiscountType(draftFlatType);
      } else {
        setFlatDiscountType("fixed");
      }

      // Exclusivity Priority: 1. Reward draft / Referral draft, 2. Flat draft / DB values
      const hasRewardDraft = draftReward !== null && Number(draftReward) > 0;
      const hasReferralDraft =
        canApplyReferral && draftCode !== null && draftCode.trim() !== "";

      let finalFlat = "";
      let finalReward = "";
      let finalCode = "";
      let finalAdvocate = "";
      let finalRefDiscount = 0;

      if (hasRewardDraft || hasReferralDraft) {
        finalFlat = "";
        if (hasRewardDraft) {
          const initialPts = pointsRedeemedFromInvoice(invoice);
          const draftPts = Number(draftReward);
          const maxForDraft = maxRedeemablePoints(
            availablePoints,
            rewardConfigSnapshot,
            invoice.subtotal
          );
          const parsedDraftReward =
            draftPts > 0 &&
            draftPts <= maxForDraft &&
            !validateRewardPointsRedemption({
              points: draftPts,
              availablePoints,
              config: rewardConfigSnapshot,
              subtotalInr: invoice.subtotal,
            })
              ? draftReward
              : null;
          finalReward =
            parsedDraftReward !== null
              ? parsedDraftReward
              : initialPts > 0
                ? String(initialPts)
                : "";
        }
        if (hasReferralDraft) {
          finalCode = draftCode || "";
          finalAdvocate = draftAdvocate || "";
          finalRefDiscount = draftRefDiscount !== null ? Number(draftRefDiscount) : 0;
        }
      } else {
        const dbFlat = invoice.discountAmount || 0;
        finalFlat = draftFlat !== null ? draftFlat : (dbFlat > 0 ? String(dbFlat) : "");
        if (Number(finalFlat) > 0) {
          finalReward = "";
          finalCode = "";
          finalAdvocate = "";
          finalRefDiscount = 0;
        } else {
          const initialPts = pointsRedeemedFromInvoice(invoice);
          finalReward = initialPts > 0 ? String(initialPts) : "";

          finalCode = invoice.referralCodeUsed || "";
          finalAdvocate = invoice.referralAdvocateId || "";
          finalRefDiscount = invoice.referralDiscount || 0;
        }
      }

      setFlatDiscountStr(finalFlat);
      setPointsRedeemStr(finalReward);
      setReferralCode(finalCode);
      setAppliedReferrerId(finalAdvocate);
      setReferralDiscountApplied(hasReferralDraft ? 0 : finalRefDiscount);
      setReferralVerifiedMsg(
        finalCode
          ? hasReferralDraft
            ? `Referral verified (unsaved) — wallets credit on apply`
            : (invoice.referralDiscount || 0) > 0
              ? "Referral discount applied"
              : invoice.referralCodeUsed
                ? "Referral applied (wallet credits)"
                : "Referral code applied"
          : ""
      );
      setReferralErrorMsg("");
    }
  }, [invoice, availablePoints, canApplyReferral, rewardConfigSnapshot]);

  const clearPointsDraft = () => {
    setPointsRedeemStr("");
    if (invoice && typeof window !== "undefined") {
      sessionStorage.setItem(`draft-reward-${invoice.id}`, "");
    }
  };

  const clearReferralDraft = () => {
    setReferralCode("");
    setAppliedReferrerId("");
    setReferralDiscountApplied(0);
    setReferralVerifiedMsg("");
    setReferralErrorMsg("");
    if (invoice && typeof window !== "undefined") {
      sessionStorage.removeItem(`draft-code-${invoice.id}`);
      sessionStorage.removeItem(`draft-advocate-${invoice.id}`);
      sessionStorage.removeItem(`draft-refdiscount-${invoice.id}`);
    }
  };

  const clearFlatDraft = () => {
    setFlatDiscountStr("");
    if (invoice && typeof window !== "undefined") {
      sessionStorage.setItem(`draft-flat-${invoice.id}`, "");
    }
  };

  const handleFlatDiscountChange = (val: string) => {
    setFlatDiscountStr(val);
    if (!invoice) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`draft-flat-${invoice.id}`, val);
      sessionStorage.setItem(`draft-flat-type-${invoice.id}`, flatDiscountType);
      if (Number(val) > 0) {
        clearPointsDraft();
        clearReferralDraft();
      }
    }
  };

  const handleFlatDiscountTypeChange = (type: "percentage" | "fixed") => {
    setFlatDiscountType(type);
    if (invoice && typeof window !== "undefined") {
      sessionStorage.setItem(`draft-flat-type-${invoice.id}`, type);
    }
  };

  const handlePointsRedeemChange = (val: string) => {
    setPointsRedeemStr(val);
    if (!invoice) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`draft-reward-${invoice.id}`, val);
      if (Number(val) > 0) {
        clearFlatDraft();
        clearReferralDraft();
      }
    }
  };

  const handleReferralCodeChange = (val: string) => {
    setReferralCode(val);
    setReferralErrorMsg("");
    if (!invoice) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`draft-code-${invoice.id}`, val);
      if (val.trim()) {
        clearFlatDraft();
        clearPointsDraft();
      }
    }
  };



  const subtotal = invoice ? invoice.subtotal : 0;
  const flatDiscountInput = Number(flatDiscountStr) || 0;
  const flatDiscount =
    flatDiscountInput <= 0
      ? 0
      : flatDiscountType === "percentage"
        ? Math.min(
            subtotal,
            Math.round(subtotal * (Math.min(100, flatDiscountInput) / 100) * 100) / 100
          )
        : Math.min(subtotal, flatDiscountInput);
  const pointsRedeem = Number(pointsRedeemStr) || 0;
  const referralDiscount = referralDiscountApplied;

  const hasFlatInput = (Number(flatDiscountStr) || 0) > 0;
  const redemptionAllowed = canRedeemRewardPoints(availablePoints, rewardConfigSnapshot);
  const hasPointsInput =
    redemptionAllowed &&
    pointsRedeemStr.trim() !== "" &&
    (Number(pointsRedeemStr) || 0) > 0;
  const hasReferralInput =
    referralCode.trim() !== "" || Boolean(appliedReferrerId) || referralDiscountApplied > 0;

  const isFlatDisabled = hasPointsInput || hasReferralInput;
  const isPointsDisabled = hasFlatInput || hasReferralInput || !redemptionAllowed;
  const isReferralDisabled = hasFlatInput || hasPointsInput;

  const maxAllowedPoints = maxRedeemablePoints(
    availablePoints,
    rewardConfigSnapshot,
    subtotal
  );
  const rewardValidationError = validateRewardPointsRedemption({
    points: pointsRedeem,
    availablePoints,
    config: rewardConfigSnapshot,
    subtotalInr: subtotal,
  });
  const activeFlatDiscount = isFlatDisabled ? 0 : flatDiscount;
  const activeRewardDiscount =
    isPointsDisabled || rewardValidationError
      ? 0
      : rewardDiscountFromPoints(pointsRedeem, rewardConfigSnapshot);
  const activeReferralDiscount = isReferralDisabled ? 0 : referralDiscount;

  // Derive pointsErrorMsg synchronously during render to prevent render lags
  const pointsErrorMsg = rewardValidationError ?? "";
  const pointsHelpText = rewardRedemptionHelpText(
    rewardConfigSnapshot,
    availablePoints,
    maxAllowedPoints
  );

  const discountTotal = activeFlatDiscount + activeRewardDiscount + activeReferralDiscount;
  const hasReferralPending =
    Boolean(appliedReferrerId) &&
    referralCode.trim() !== "" &&
    !isReferralDisabled;
  const hasDiscountToApply =
    activeFlatDiscount > 0 ||
    activeRewardDiscount > 0 ||
    activeReferralDiscount > 0 ||
    hasReferralPending;
  const taxableSubtotal = Math.max(0, subtotal - discountTotal);
  const taxRate = !isGstRegistered(gstRegistrationStatus)
    ? 0
    : invoice
      ? taxRateAsFraction(invoice.taxRate)
      : DEFAULT_GST_RATE;
  const taxAmount = Math.round(taxableSubtotal * taxRate * 100) / 100;
  const grandTotalComputed = Math.round((taxableSubtotal + taxAmount) * 100) / 100;
  const pointsToEarn = loyaltyPointsEarned(taxableSubtotal, rewardConfigSnapshot);

  const handleVerifyReferralCode = () => {
    setReferralErrorMsg("");
    setReferralVerifiedMsg("");
    if (!invoice) return;
    
    if (!canApplyReferral) {
      setReferralErrorMsg(
        !referralProgram.programEnabled
          ? "Referral program is paused. Enable it on the Referrals page."
          : REFERRAL_EXISTING_CUSTOMER_MESSAGE
      );
      return;
    }

    if (!referralRewards.ok) {
      setReferralErrorMsg(referralRewards.reason);
      return;
    }

    if (hasFlatInput || hasPointsInput) {
      setReferralErrorMsg("Cannot apply referral code while another discount is active.");
      return;
    }

    if (!referralCode.trim()) {
      setReferralErrorMsg("Enter a referral code first.");
      return;
    }

    const trimmed = referralCode.trim();
    if (invoiceCustomer && trimmed.toLowerCase() === invoiceCustomer.referralCode.toLowerCase()) {
      setReferralErrorMsg("A customer cannot use their own referral code.");
      return;
    }

    const { findByReferralCode } = useCustomerStore.getState();
    const referrer = findByReferralCode(trimmed);
    if (!referrer) {
      setReferralErrorMsg("Invalid referral code.");
      return;
    }

    // Valid referral — wallet credits on "Apply to Invoice" (not an invoice line discount)
    clearFlatDraft();
    clearPointsDraft();
    setAppliedReferrerId(referrer.id);
    setReferralDiscountApplied(0);
    setReferralVerifiedMsg(
      `Verified (${referrer.name}). On apply: customer +${formatCurrency(referralBuyerAmount)} wallet, referrer +${formatCurrency(referralAdvocateAmount)} wallet.`
    );
    toast.success(`Referral code verified: Referred by ${referrer.name}`);

    if (typeof window !== "undefined") {
      sessionStorage.setItem(`draft-code-${invoice.id}`, trimmed);
      sessionStorage.setItem(`draft-advocate-${invoice.id}`, referrer.id);
      sessionStorage.setItem(`draft-refdiscount-${invoice.id}`, "0");
    }
  };

  const handleRemoveReferral = () => {
    setReferralCode("");
    setAppliedReferrerId("");
    setReferralDiscountApplied(0);
    setReferralVerifiedMsg("");
    setReferralErrorMsg("");
    toast.message("Referral code removed");
    if (!invoice) return;

    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`draft-code-${invoice.id}`);
      sessionStorage.removeItem(`draft-advocate-${invoice.id}`);
      sessionStorage.removeItem(`draft-refdiscount-${invoice.id}`);
    }
  };

  const handleSaveDiscounts = async () => {
    if (!invoice) return;
    if (pointsErrorMsg) {
      toast.error(pointsErrorMsg);
      return;
    }

    setIsApplying(true);
    try {
      const persistReferral = canApplyReferral || invoiceCarriesReferral(invoice);
      const codeTrimmed = referralCode.trim();
      const shouldCreditReferralWallets =
        persistReferral && Boolean(appliedReferrerId) && codeTrimmed !== "";

      // Referral is wallet credit for both parties — do not reduce invoice totals.
      const savedReferralDiscount = 0;

      await updateInvoice(invoice.id, {
        discountAmount: activeFlatDiscount,
        rewardDiscount: activeRewardDiscount,
        rewardPointsRedeemed: activeRewardDiscount > 0 ? pointsRedeem : 0,
        referralDiscount: shouldCreditReferralWallets
          ? savedReferralDiscount
          : persistReferral
            ? activeReferralDiscount
            : 0,
        referralAdvocateId: shouldCreditReferralWallets
          ? appliedReferrerId || undefined
          : persistReferral && activeReferralDiscount > 0
            ? appliedReferrerId || undefined
            : undefined,
        referralCodeUsed: shouldCreditReferralWallets
          ? codeTrimmed || undefined
          : persistReferral && activeReferralDiscount > 0
            ? codeTrimmed || undefined
            : undefined,
        taxAmount: taxAmount,
        grandTotal: grandTotalComputed,
      });

      if (shouldCreditReferralWallets && invoiceCustomer) {
        if (!referralRewards.ok) {
          toast.error(referralRewards.reason);
          return;
        }
        const { findByReferralCode, creditWallet, updateCustomer } =
          useCustomerStore.getState();
        const advocate =
          customers.find((c) => c.id === appliedReferrerId) ||
          findByReferralCode(codeTrimmed);
        if (advocate) {
          const { buyerCredited, advocateCredited } = await creditReferralWalletsForInvoice({
            invoiceId: invoice.id,
            buyer: invoiceCustomer,
            advocate,
            buyerAmount: referralBuyerAmount,
            advocateAmount: referralAdvocateAmount,
            referralCode: codeTrimmed,
            transactions: useWalletStore.getState().transactions,
            creditWallet,
            addTransaction: addWalletTransaction,
            getCustomer: (id) => useCustomerStore.getState().customers.find((c) => c.id === id),
            updateCustomer,
          });
          if (buyerCredited || advocateCredited) {
            toast.success("Referral wallet credits applied", {
              description: [
                buyerCredited
                  ? `Customer +${formatCurrency(referralBuyerAmount)}`
                  : null,
                advocateCredited
                  ? `Referrer +${formatCurrency(referralAdvocateAmount)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · "),
            });
          }
        }
      }

      toast.success("Invoice discounts applied successfully");

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`draft-flat-${invoice.id}`);
        sessionStorage.removeItem(`draft-flat-type-${invoice.id}`);
        sessionStorage.removeItem(`draft-reward-${invoice.id}`);
        sessionStorage.removeItem(`draft-code-${invoice.id}`);
        sessionStorage.removeItem(`draft-advocate-${invoice.id}`);
        sessionStorage.removeItem(`draft-refdiscount-${invoice.id}`);
      }
    } catch (err) {
      toast.error("Failed to apply discounts to invoice");
    } finally {
      setIsApplying(false);
    }
  };

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + p.amount, 0) + (invoice?.walletAmountUsed || 0),
    [payments, invoice?.walletAmountUsed]
  );
  const remainingBalance = invoice ? invoice.grandTotal - totalPaid : 0;

  const invoicePdfOpts = useMemo((): InvoicePdfOpts | null => {
    if (!invoice) return null;
    return {
      invoice,
      jobCard: jobCard ?? null,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      customerEmail: invoiceCustomer?.email?.trim() ?? "",
      customerAddress: invoiceCustomer?.address ?? "",
      vehicleMakeModel: resolvedVehicleMakeModel,
      vehicleDetailsLine: vehicleDetailsLine || undefined,
      odometerReading: odometerReading ?? undefined,
      business: {
        businessName,
        businessTagline,
        businessAddress,
        businessPhone,
        businessWhatsApp,
        businessEmail,
        businessWebsite,
        gstRegistrationStatus,
        gstin,
        companyPan,
        bankName,
        bankBranch,
        bankAccountNumber,
        bankIfsc,
        bankUpi,
      },
      payments,
      totalPaid,
      remainingBalance,
      referralCode: invoiceCustomer?.referralCode,
      referralRewardAmount: referralAdvocateAmount,
      newCustomerDiscount: referralBuyerAmount,
      membershipId: membershipForInvoice?.id,
      membershipPackageName,
      membershipDetails: membershipDetails ?? undefined,
    };
  }, [
    invoice,
    jobCard,
    invoiceCustomer,
    payments,
    totalPaid,
    remainingBalance,
    businessName,
    businessTagline,
    businessAddress,
    businessPhone,
    businessWhatsApp,
    businessEmail,
    businessWebsite,
    gstRegistrationStatus,
    gstin,
    companyPan,
    bankName,
    bankBranch,
    bankAccountNumber,
    bankIfsc,
    bankUpi,
    referralAdvocateAmount,
    referralBuyerAmount,
    membershipForInvoice?.id,
    membershipPackageName,
    membershipDetails,
    resolvedVehicleMakeModel,
    vehicleDetailsLine,
    odometerReading,
  ]);

  useEffect(() => {
    warmInvoicePdfEngine();
    if (invoicePdfOpts) prefetchInvoicePdf(invoicePdfOpts);
  }, [invoicePdfOpts]);

  const previewHtml = useMemo(() => {
    if (!invoicePdfOpts) return "";
    return buildTaxInvoicePrintHtml(invoicePdfOpts, { includePrintScript: false });
  }, [invoicePdfOpts]);

  const openEditInvoice = () => {
    if (!invoice || !canEditInvoice) return;
    setEditLines(invoice.lineItems.map((li) => ({ ...li })));
    setEditNotes(invoice.notes ?? "");
    setEditDialogOpen(true);
  };

  const wantsEdit = searchParams.get("edit") === "1";
  useEffect(() => {
    if (!wantsEdit || !invoice) return;
    if (
      invoice.payments.length > 0 ||
      (invoice.walletAmountUsed ?? 0) > 0 ||
      invoice.status === "PAID" ||
      invoice.status === "PARTIALLY_PAID"
    ) {
      toast.error("This invoice can no longer be edited", {
        description: "Payments have already been recorded.",
      });
      return;
    }
    setEditLines(invoice.lineItems.map((li) => ({ ...li })));
    setEditNotes(invoice.notes ?? "");
    setEditDialogOpen(true);
    // Open once when arriving from the billing list Edit action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsEdit, invoice?.id]);

  const updateEditLine = (
    id: string,
    patch: Partial<InvoiceLineItem> & { lineDiscountPercent?: number }
  ) => {
    setEditLines((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        const { lineDiscountPercent: pctPatch, ...restPatch } = patch;
        const next = { ...li, ...restPatch };
        const qty = Math.max(0, Number(next.quantity) || 0);
        const unitPrice = Math.max(0, Number(next.unitPrice) || 0);
        const gross = qty * unitPrice;
        let lineDiscount: number;
        if (pctPatch != null) {
          lineDiscount = lineDiscountInrFromPercent(qty, unitPrice, pctPatch);
        } else if (restPatch.lineDiscount != null) {
          lineDiscount = Math.min(gross, Math.max(0, Number(restPatch.lineDiscount) || 0));
        } else if (restPatch.quantity != null || restPatch.unitPrice != null) {
          const prevPct = lineDiscountPercent(li.quantity, li.unitPrice, li.lineDiscount ?? 0);
          lineDiscount = lineDiscountInrFromPercent(qty, unitPrice, prevPct);
        } else {
          lineDiscount = Math.min(gross, Math.max(0, Number(next.lineDiscount) || 0));
        }
        const total = Math.max(0, Math.round((gross - lineDiscount) * 100) / 100);
        let description = next.description;
        if (
          next.type === "PARTS" &&
          restPatch.quantity != null &&
          /—\s*[\d.]+(\s+\S+)?\s*$/.test(description)
        ) {
          description = description.replace(/—\s*[\d.]+/, `— ${qty}`);
        }
        return { ...next, description, quantity: qty, unitPrice, lineDiscount, total };
      })
    );
  };

  const addEditLine = () => {
    setEditLines((prev) => [
      ...prev,
      {
        id: `li-edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        description: "",
        type: "OTHER",
        quantity: 1,
        unitPrice: 0,
        total: 0,
        lineDiscount: 0,
      },
    ]);
  };

  const applyPartToEditLine = (lineId: string, part: Part) => {
    const unit = getSelectableUnits(part)[0] || part.primaryUnit || "pcs";
    const unitPrice = getUnitPrice(part, unit);
    updateEditLine(lineId, {
      description: `${part.name} — 1 ${unit}`,
      type: "PARTS",
      quantity: 1,
      unitPrice,
      lineDiscount: 0,
    });
  };

  const applyServiceToEditLine = (lineId: string, svc: ServiceCatalogItem) => {
    const unitPrice = svc.defaultPrice;
    updateEditLine(lineId, {
      description: svc.name,
      type: "SERVICE",
      quantity: 1,
      unitPrice,
      lineDiscount: 0,
    });
  };

  const addPartLine = (part: Part) => {
    const unit = getSelectableUnits(part)[0] || part.primaryUnit || "pcs";
    const unitPrice = getUnitPrice(part, unit);
    const qty = 1;
    const total = Math.round(qty * unitPrice * 100) / 100;
    setEditLines((prev) => [
      ...prev,
      {
        id: `li-edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        description: `${part.name} — ${qty} ${unit}`,
        type: "PARTS",
        quantity: qty,
        unitPrice,
        total,
        lineDiscount: 0,
      },
    ]);
  };

  const removeEditLine = (id: string) => {
    setEditLines((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.id !== id)));
  };

  const handleSaveInvoiceEdit = async () => {
    if (!invoice || !canEditInvoice) return;
    const cleaned = editLines
      .map((li) => ({
        ...li,
        description: li.description.trim(),
      }))
      .filter((li) => li.description.length > 0);
    if (cleaned.length === 0) {
      toast.error("Add at least one line item with a description");
      return;
    }
    const gstRegistered = isGstRegistered(gstRegistrationStatus);
    const totals = recalculateInvoiceFromLines(
      cleaned,
      invoice.taxRate,
      invoice.discountAmount || 0,
      invoice.rewardDiscount || 0,
      invoice.referralDiscount || 0,
      invoice.walletAmountUsed || 0,
      gstRegistered
    );
    setEditSaving(true);
    try {
      await updateInvoice(invoice.id, {
        lineItems: cleaned,
        notes: editNotes.trim() || undefined,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        grandTotal: totals.grandTotal,
      });
      pushActivityLog({
        action: "UPDATED",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityLabel: invoice.invoiceNumber,
        details: `Edited line items on ${invoice.invoiceNumber}`,
      });
      toast.success("Invoice updated");
      setEditDialogOpen(false);
    } catch {
      toast.error("Failed to update invoice");
    } finally {
      setEditSaving(false);
    }
  };

  const openRecordDialog = () => {
    setRecordDialogOpen(true);
  };

  const handlePrint = () => {
    if (!assertCanExportData()) return;
    if (!invoicePdfOpts) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const html = buildTaxInvoicePrintHtml(invoicePdfOpts);
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleInvoiceWhatsApp = async () => {
    if (!invoice) return;
    const invoiceLabel = invoiceCustomerDocumentLabel(
      invoice,
      isGstRegistered(gstRegistrationStatus)
    ).sentenceCase;
    const message = buildInvoiceWhatsAppMessage(invoice, {
      businessName,
      remainingBalance,
      invoiceLabel,
    });
    const phone = invoice.customerPhone;
    const notify = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: channel === "api" ? "Invoice shared via WhatsApp" : "Invoice — WhatsApp composer",
        message: `${invoice.invoiceNumber} → ${phone}`,
        href: `/billing/${invoice.id}`,
        branchId: jobCard?.branchId,
      });
    };
    const logSent = () => {
      pushActivityLog({
        action: "WHATSAPP_SENT",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityLabel: invoice.invoiceNumber,
        details: `Invoice ${invoice.invoiceNumber} shared with ${invoice.customerName} via WhatsApp`,
      });
    };
    try {
      await sendCustomerWhatsApp(phone, message);
      toast.success("Invoice sent via WhatsApp", { description: phone });
      notify("api");
      logSent();
    } catch (err) {
      if (isWhatsAppNotConfiguredError(err)) {
        openWhatsAppComposer(phone, message);
        toast.info("WhatsApp opened", {
          description: "Finish sending in the app, or configure Twilio WhatsApp on the server.",
        });
        notify("composer");
        logSent();
        return;
      }
      toast.error("WhatsApp failed", {
        description: err instanceof ApiError ? err.message : "Could not send",
      });
    }
  };

  const handleInvoiceEmail = async () => {
    if (!invoice || !invoicePdfOpts) return;
    const toEmail = invoiceCustomer?.email?.trim();
    if (!toEmail) {
      toast.error("No customer email", {
        description: "Add an email on the customer profile, then try again.",
      });
      return;
    }
    const latestInvoice =
      useInvoiceStore.getState().invoices.find((i) => i.id === invoice.id) ?? invoice;
    const pdfOpts: InvoicePdfOpts = {
      ...invoicePdfOpts!,
      invoice: latestInvoice,
      customerEmail: toEmail,
    };
    const attachmentFilename = invoicePdfFilename(invoice.invoiceNumber, gstRegistrationStatus);
    const { titleCase: titleCaseLabel, sentenceCase: sentenceCaseLabel } =
      invoiceCustomerDocumentLabel(latestInvoice, isGstRegistered(gstRegistrationStatus));
    const emailHtml = buildInvoiceEmailHtml({
      customerName: invoice.customerName,
      invoiceNumber: invoice.invoiceNumber,
      businessName,
      invoiceLabel: titleCaseLabel,
      grandTotal: invoice.grandTotal,
      remainingBalance,
      vehicleRegNumber: invoice.vehicleRegNumber,
      attachmentFilename,
    });
    const subject = `${titleCaseLabel} ${invoice.invoiceNumber} — ${businessName}`;
    const text = [
      buildInvoiceWhatsAppMessage(invoice, { businessName, remainingBalance, invoiceLabel: sentenceCaseLabel }),
      "",
      `Your ${sentenceCaseLabel} is attached as ${attachmentFilename}. Open the PDF to view or download the full invoice.`,
    ].join("\n");
    const pdfToast = toast.loading("Sending invoice email…");
    const notify = () => {
      useNotificationStore.getState().addNotification({
        type: "email_sent",
        title: "Invoice emailed",
        message: `${invoice.invoiceNumber} → ${toEmail}`,
        href: `/billing/${invoice.id}`,
        branchId: jobCard?.branchId,
      });
    };
    const logSent = () => {
      pushActivityLog({
        action: "EMAIL_SENT",
        entityType: "INVOICE",
        entityId: invoice.id,
        entityLabel: invoice.invoiceNumber,
        details: `Invoice ${invoice.invoiceNumber} emailed to ${invoice.customerName} (${toEmail}) with PDF attachment`,
      });
    };
    try {
      await sendInvoiceEmailWithPdf({
        pdfOpts,
        to: toEmail,
        subject,
        emailHtml,
        text,
      });
      toast.dismiss(pdfToast);
      toast.success("Invoice emailed", {
        description: `${toEmail} — PDF attached (${attachmentFilename})`,
      });
      notify();
      logSent();
    } catch (err) {
      toast.dismiss(pdfToast);
      if (isResendNotConfiguredError(err)) {
        toast.error("Email not configured", {
          description:
            "Set RESEND_API_KEY on the API server (same as password reset). Optionally set MAIL_FROM.",
        });
        return;
      }
      if (err instanceof ApiError && err.code === "PAYLOAD_TOO_LARGE") {
        toast.error("Invoice PDF too large", {
          description: err.message,
        });
        return;
      }
      toast.error("Email failed", {
        description: err instanceof ApiError ? err.message : "Could not send",
      });
    }
  };

  if (!invoice) {
    if (!storesReady) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Invoice not found</p>
        <DetailBackButton fallbackHref="/billing" />
      </div>
    );
  }

  const formatShortDate = (iso: string) =>
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
      .format(new Date(iso))
      .replace(/ /g, "-");

  const customerDocLabel = invoiceCustomerDocumentLabel(
    invoice,
    isGstRegistered(gstRegistrationStatus)
  );

  return (
    <div className="space-y-4 print:hidden">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DetailBackButton fallbackHref="/billing" />
          <h1 className="text-lg font-semibold">
            {customerDocLabel.titleCase} #{invoice.invoiceNumber}
          </h1>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/billing?view=ledger&customerId=${encodeURIComponent(invoice.customerId)}`}
            >
              <BookMarked className="mr-1.5 h-4 w-4" />
              Ledger
            </Link>
          </Button>
          {canEditInvoice && (
            <Button variant="outline" size="sm" onClick={openEditInvoice}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit Invoice
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Download className="mr-1.5 h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Share2 className="mr-1.5 h-4 w-4" />
                Share
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  const customerName = invoice.customerName;
                  const businessNameVal = businessName || "MY DETAIL OS";
                  const invoiceNumber = invoice.invoiceNumber;
                  const totalAmount = invoice.grandTotal;
                  const vehicleName = resolvedVehicleMakeModel !== "—" ? resolvedVehicleMakeModel : "Vehicle";
                  const vehicleNumber = invoice.vehicleRegNumber || jobCard?.vehicleRegNumber || "";
                  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
                  const publicInvoiceUrl = `${appBaseUrl}/public-invoice/${invoice.id}`;

                  const msg = `Hi ${customerName},

Please find your invoice from ${businessNameVal}.

Invoice: ${invoiceNumber}

Amount: ₹${totalAmount}

Vehicle: ${vehicleName} - ${vehicleNumber}

You can view the invoice here: ${publicInvoiceUrl}

Thank you,
${businessNameVal}`;

                  openWhatsAppComposer(invoice.customerPhone, msg);
                }}
              >
                <svg
                  className="mr-0.5 h-4 w-4 shrink-0"
                  viewBox="0 0 240 241.19"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="#25d366"
                    fillRule="evenodd"
                    d="M205,35.05A118.61,118.61,0,0,0,120.46,0C54.6,0,1,53.61,1,119.51a119.5,119.5,0,0,0,16,59.74L0,241.19l63.36-16.63a119.43,119.43,0,0,0,57.08,14.57h0A119.54,119.54,0,0,0,205,35.07v0ZM120.5,219A99.18,99.18,0,0,1,69.91,205.1l-3.64-2.17-37.6,9.85,10-36.65-2.35-3.76A99.37,99.37,0,0,1,190.79,49.27,99.43,99.43,0,0,1,120.49,219ZM175,144.54c-3-1.51-17.67-8.71-20.39-9.71s-4.72-1.51-6.75,1.51-7.72,9.71-9.46,11.72-3.49,2.27-6.45.76-12.63-4.66-24-14.84A91.1,91.1,0,0,1,91.25,113.3c-1.75-3-.19-4.61,1.33-6.07s3-3.48,4.47-5.23a19.65,19.65,0,0,0,3-5,5.51,5.51,0,0,0-.24-5.23C99,90.27,93,75.57,90.6,69.58s-4.89-5-6.73-5.14-3.73-.09-5.7-.09a11,11,0,0,0-8,3.73C67.48,71.05,59.75,78.3,59.75,93s10.69,28.88,12.19,30.9S93,156.07,123,169c7.12,3.06,12.68,4.9,17,6.32a41.18,41.18,0,0,0,18.8,1.17c5.74-.84,17.66-7.21,20.17-14.18s2.5-13,1.75-14.19-2.69-2.06-5.7-3.59l0,0Z"
                  />
                </svg>
                Whatsapp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {(invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID") &&
            remainingBalance > 0.01 &&
            userCanCreate(useAuthStore.getState().user, "BILLING") && (
              <Button size="sm" onClick={openRecordDialog}>
                Record Payment In
              </Button>
            )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
          {previewHtml ? (
            <iframe
              title={`${customerDocLabel.titleCase} preview`}
              className="h-[min(85vh,920px)] w-full border-0"
              srcDoc={previewHtml}
            />
          ) : (
            <p className="p-8 text-sm text-muted-foreground">Loading preview…</p>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
          {payments.length === 0 && (invoice.status === "DRAFT" || invoice.status === "ISSUED") && (
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-border py-3 bg-violet-50/40 dark:bg-violet-950/10">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Gift className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  Discounts & Rewards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 text-sm">
                {/* Direct Discount — % or fixed ₹ */}
                <div className={cn("space-y-2", isFlatDisabled && "opacity-60")}>
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <Label className="font-medium text-foreground">Direct Discount</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isFlatDisabled}
                      className={cn(
                        "h-9 flex-1 gap-1 rounded-md text-xs transition-all",
                        flatDiscountType === "percentage"
                          ? "border-amber-300 bg-amber-50 font-semibold text-amber-700 hover:bg-amber-100/80 hover:text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                      onClick={() => handleFlatDiscountTypeChange("percentage")}
                    >
                      % Percentage
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isFlatDisabled}
                      className={cn(
                        "h-9 flex-1 gap-1 rounded-md text-xs transition-all",
                        flatDiscountType === "fixed"
                          ? "border-amber-300 bg-amber-50 font-semibold text-amber-700 hover:bg-amber-100/80 hover:text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                      onClick={() => handleFlatDiscountTypeChange("fixed")}
                    >
                      ₹ Fixed Amount
                    </Button>
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                      {flatDiscountType === "percentage" ? "%" : "₹"}
                    </span>
                    <Input
                      id="flat-discount"
                      type="number"
                      min={0}
                      max={flatDiscountType === "percentage" ? 100 : undefined}
                      placeholder={flatDiscountType === "percentage" ? "e.g. 10" : "e.g. 500"}
                      value={flatDiscountStr}
                      disabled={isFlatDisabled}
                      onChange={(e) => handleFlatDiscountChange(e.target.value)}
                      className="pl-8 tabular-nums"
                    />
                  </div>
                  {flatDiscountType === "percentage" && flatDiscount > 0 && !isFlatDisabled && (
                    <p className="text-[11px] text-muted-foreground">
                      Equals {formatCurrency(flatDiscount)} off subtotal
                    </p>
                  )}
                  {isFlatDisabled && (
                    <p className="text-[11px] text-amber-600">
                      Disabled because reward points or referral discount is active.
                    </p>
                  )}
                </div>

                {/* Reward Points Input */}
                <div className={cn("space-y-1.5", isPointsDisabled && "opacity-60")}>
                  <Label htmlFor="reward-points" className="flex items-center justify-between gap-2 font-medium text-foreground w-full">
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                      Redeem Reward Points
                    </span>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full font-bold font-mono border border-indigo-100 dark:border-indigo-900/50 shrink-0 whitespace-nowrap">
                      Available: {availablePoints}
                    </span>
                  </Label>
                  <Input
                    id="reward-points"
                    type="text"
                    inputMode="numeric"
                    placeholder={
                      redemptionAllowed
                        ? "Enter points"
                        : `Need ${rewardConfigSnapshot.minRedeem} pts`
                    }
                    value={pointsRedeemStr}
                    disabled={isPointsDisabled}
                    onChange={(e) =>
                      handlePointsRedeemChange(e.target.value.replace(/[^\d]/g, ""))
                    }
                    className="[appearance:textfield]"
                  />
                  {isPointsDisabled && (hasFlatInput || hasReferralInput) && (
                    <p className="text-[11px] text-amber-600">
                      Disabled because direct discount or referral is active.
                    </p>
                  )}
                  {!redemptionAllowed && !hasFlatInput && !hasReferralInput && (
                    <p className="text-[11px] text-amber-600">{pointsHelpText}</p>
                  )}
                  {redemptionAllowed && pointsErrorMsg ? (
                    <p className="text-[11px] text-destructive">{pointsErrorMsg}</p>
                  ) : null}
                  {redemptionAllowed && !pointsErrorMsg ? (
                    <p className="text-[11px] text-muted-foreground">{pointsHelpText}</p>
                  ) : null}
                </div>

                {/* Referral Code Input — new customers only */}
                {canApplyReferral ? (
                <div className={cn("space-y-1.5", isReferralDisabled && "opacity-60")}>
                  <Label htmlFor="referral-code" className="flex items-center gap-1.5 font-medium text-foreground">
                    <Ticket className="w-3.5 h-3.5 text-muted-foreground" />
                    Referral Code
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="referral-code"
                      placeholder="Enter friend's code"
                      value={referralCode}
                      onChange={(e) => handleReferralCodeChange(e.target.value)}
                      disabled={Boolean(appliedReferrerId) || isReferralDisabled}
                    />
                    {appliedReferrerId ? (
                      <Button variant="outline" size="icon" className="shrink-0 text-destructive border-destructive/20 hover:bg-destructive/5" onClick={handleRemoveReferral}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="shrink-0"
                        onClick={handleVerifyReferralCode}
                        disabled={isReferralDisabled || !referralCode.trim()}
                      >
                        Apply
                      </Button>
                    )}
                  </div>
                  {isReferralDisabled && (
                    <p className="text-[11px] text-amber-600">
                      Disabled because direct discount or reward points are active.
                    </p>
                  )}
                  {referralVerifiedMsg && (
                    <p className="text-[11px] text-emerald-600 font-medium">{referralVerifiedMsg}</p>
                  )}
                  {referralErrorMsg && (
                    <p className="text-[11px] text-destructive">{referralErrorMsg}</p>
                  )}
                </div>
                ) : invoice && invoiceCarriesReferral(invoice) ? (
                  <p className="text-[11px] text-muted-foreground">
                    Referral already applied on this invoice (wallet credits).
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {REFERRAL_EXISTING_CUSTOMER_MESSAGE}
                  </p>
                )}

                <Separator />

                {/* Calculation Summary */}
                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-foreground text-sm mb-2">Pre-Invoice Calculation</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{formatCurrency(subtotal)}</span>
                  </div>
                  {activeFlatDiscount > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>
                        Direct Discount
                        {flatDiscountType === "percentage" && flatDiscountInput > 0
                          ? ` (${Math.min(100, flatDiscountInput)}%)`
                          : ""}
                      </span>
                      <span className="font-mono">-{formatCurrency(activeFlatDiscount)}</span>
                    </div>
                  )}
                  {activeRewardDiscount > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Reward Discount ({pointsRedeem} pts)</span>
                      <span className="font-mono">-{formatCurrency(activeRewardDiscount)}</span>
                    </div>
                  )}
                  {activeReferralDiscount > 0 && (
                    <div className="flex justify-between text-amber-600 font-medium">
                      <span>Referral Discount</span>
                      <span className="font-mono">-{formatCurrency(activeReferralDiscount)}</span>
                    </div>
                  )}
                  {hasReferralPending && activeReferralDiscount <= 0 && (
                    <div className="space-y-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-emerald-700 dark:text-emerald-400">
                      <div className="flex justify-between font-medium">
                        <span>Customer wallet (referral)</span>
                        <span className="font-mono">+{formatCurrency(referralBuyerAmount)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Referrer wallet</span>
                        <span className="font-mono">+{formatCurrency(referralAdvocateAmount)}</span>
                      </div>
                    </div>
                  )}
                  {invoice &&
                    invoiceCarriesReferral(invoice) &&
                    !hasReferralPending &&
                    (invoice.referralDiscount || 0) <= 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Referral wallet credits are linked to this invoice.
                    </p>
                  )}
                  {isGstRegistered(gstRegistrationStatus) ? (
                    <>
                      <div className="flex justify-between font-semibold border-t border-border pt-1.5 text-[13px]">
                        <span>Taxable Subtotal</span>
                        <span className="font-mono">{formatCurrency(taxableSubtotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>GST ({taxRateAsPercentLabel(taxRate)})</span>
                        <span className="font-mono">{formatCurrency(taxAmount)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex justify-between font-bold text-sm border-t border-border pt-1.5 text-primary">
                    <span>Revised Grand Total</span>
                    <span className="font-mono">{formatCurrency(grandTotalComputed)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-medium bg-emerald-500/5 dark:bg-emerald-500/10 p-2 rounded-md mt-2">
                    <span>Loyalty Points to Earn</span>
                    <span>{pointsToEarn} points</span>
                  </div>
                </div>

                <Button
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium animate-in fade-in duration-200 disabled:opacity-50"
                  disabled={isApplying || Boolean(pointsErrorMsg) || !hasDiscountToApply}
                  onClick={handleSaveDiscounts}
                >
                  {isApplying ? "Applying..." : "Apply to Invoice"}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="text-base font-semibold">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Invoice Amount</span>
                <span className="font-semibold tabular-nums">{formatInrTable(invoice.grandTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Initial Amount Received</span>
                <span className="tabular-nums">{formatInrTable(0)}</span>
              </div>
              <Separator />
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer rounded-md border border-border p-3 hover:bg-muted/30"
                      onClick={() =>
                        router.push(
                          appendReturnTo(paymentInDetailPath(payment.id), currentReturnPath)
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(
                            appendReturnTo(paymentInDetailPath(payment.id), currentReturnPath)
                          );
                        }
                      }}
                    >
                      <p className="font-medium">Payment In #{paymentDisplayNumber(payment.id)}</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatInrTable(payment.amount)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatShortDate(payment.paidAt)}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {payment.method.toLowerCase()}
                        {payment.referenceNumber ? ` (${payment.referenceNumber})` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between gap-2 font-medium">
                <span>Total Amount Received</span>
                <span className="tabular-nums">{formatInrTable(totalPaid)}</span>
              </div>
              {remainingBalance > 0.01 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Balance Amount</span>
                  <span className={cn("font-bold tabular-nums text-destructive")}>
                    {formatInrTable(remainingBalance)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] overflow-hidden flex flex-col sm:max-w-4xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
            <div className="space-y-3">
              {editLines.map((li, idx) => (
                <div
                  key={li.id}
                  className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Line {idx + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      disabled={editLines.length <= 1}
                      onClick={() => removeEditLine(li.id)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`edit-desc-${li.id}`}>Description</Label>
                    <Input
                      id={`edit-desc-${li.id}`}
                      value={li.description}
                      onChange={(e) => updateEditLine(li.id, { description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`edit-qty-${li.id}`}>Qty</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => {
                            const current = li.quantity || 0;
                            updateEditLine(li.id, {
                              quantity: Math.max(1, current - 1),
                            });
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          id={`edit-qty-${li.id}`}
                          type="text"
                          inputMode="decimal"
                          className="text-center w-full min-w-0"
                          value={String(li.quantity)}
                          onChange={(e) =>
                            updateEditLine(li.id, {
                              quantity: Number(e.target.value.replace(/,/g, "")) || 0,
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => {
                            const current = li.quantity || 0;
                            updateEditLine(li.id, {
                              quantity: current + 1,
                            });
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        {(() => {
                          const matchedPart = rawParts.find((p) =>
                            li.description.toLowerCase().startsWith(p.name.toLowerCase())
                          );
                          if (!matchedPart) return null;
                          const units = getSelectableUnits(matchedPart);
                          if (units.length <= 1) return null;
                          const currentUnit = units.find((u) => li.description.includes(u)) ?? units[0];
                          return (
                            <Select
                              value={currentUnit}
                              onValueChange={(unit) => {
                                const newPrice = getUnitPrice(matchedPart, unit);
                                const oldUnitStr = `— 1 ${currentUnit}`;
                                const newUnitStr = `— 1 ${unit}`;
                                let nextDesc = li.description;
                                if (nextDesc.includes(oldUnitStr)) {
                                  nextDesc = nextDesc.replace(oldUnitStr, newUnitStr);
                                } else {
                                  nextDesc = `${matchedPart.name} — 1 ${unit}`;
                                }
                                updateEditLine(li.id, {
                                  description: nextDesc,
                                  unitPrice: newPrice,
                                });
                              }}
                            >
                              <SelectTrigger className="h-9 w-[4.5rem] text-xs px-1.5 focus:ring-0 shrink-0 bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {units.map((u) => (
                                  <SelectItem key={u} value={u} className="text-xs">
                                    {u}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`edit-rate-${li.id}`}>Rate (₹)</Label>
                      <Input
                        id={`edit-rate-${li.id}`}
                        type="text"
                        inputMode="decimal"
                        value={String(li.unitPrice)}
                        onChange={(e) =>
                          updateEditLine(li.id, {
                            unitPrice: Number(e.target.value.replace(/,/g, "")) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`edit-disc-${li.id}`}>Line disc. (%)</Label>
                      <Input
                        id={`edit-disc-${li.id}`}
                        type="text"
                        inputMode="decimal"
                        value={String(
                          lineDiscountPercent(li.quantity, li.unitPrice, li.lineDiscount ?? 0)
                        )}
                        onChange={(e) =>
                          updateEditLine(li.id, {
                            lineDiscountPercent:
                              Number(e.target.value.replace(/,/g, "")) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Line total</Label>
                      <p className="flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium tabular-nums">
                        {formatCurrency(li.total)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>From counter sale</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <InvoicePartPickSelect
                        parts={inventoryParts}
                        onPick={(part) => applyPartToEditLine(li.id, part)}
                      />
                      <InvoiceServicePickSelect
                        services={serviceCatalog}
                        onPick={(svc) => applyServiceToEditLine(li.id, svc)}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Selecting a part or service fills description and rate. You can still edit them.
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addEditLine}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add blank line
              </Button>
              <div className="min-w-[12rem] flex-1 sm:max-w-xs">
                <InvoicePartPickSelect parts={inventoryParts} onPick={addPartLine} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-invoice-notes">Notes</Label>
              <Textarea
                id="edit-invoice-notes"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Optional notes on the invoice"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Subtotal and GST recalculate on save. Invoice-level discounts stay as already applied.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={editSaving} onClick={() => void handleSaveInvoiceEdit()}>
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecordPaymentDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        invoiceId={invoice?.id ?? null}
        onSuccess={() => {
          setRecordDialogOpen(false);
          if (invoice?.jobCardId) {
            router.push(`/job-cards/${invoice.jobCardId}?deliverVehicle=1`);
          }
        }}
      />
    </div>
  );
}
