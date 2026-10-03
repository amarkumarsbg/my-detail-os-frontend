"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";
import { marketingSignupUrl } from "@/lib/marketing-site";
import { useSettingsStore } from "@/store/settings-store";
import { useCustomerRewardSettingsStore } from "@/store/customer-reward-settings-store";
import { useServiceCatalogStore } from "@/store/service-catalog-store";
import { useServiceCategoryStore } from "@/store/service-category-store";
import { useStaffRewardStore } from "@/store/staff-reward-store";
import {
  REMINDER_FREQUENCY_LABELS,
  SCHEDULABLE_REMINDER_FREQUENCIES,
  type SchedulableReminderFrequency,
} from "@/lib/reminder-schedule";
import { useOrganizationStore } from "@/store/organization-store";
import { useHighEndServiceStore, buildHighEndSegmentPricing, highEndDefaultEstimate } from "@/store/high-end-service-store";
import {
  EMPTY_HIGH_END_PRICE_DRAFT,
  HighEndSegmentPricingFields,
} from "@/components/settings/high-end-segment-pricing-fields";
import { useVehicleCatalogStore } from "@/store/vehicle-catalog-store";
import { BrandingThemePanel } from "@/components/settings/branding-theme-panel";
import { useDomainDataReady } from "@/components/layout/domain-data-sync";
import type {
  CompanyTargetTierConfig,
  CompanyTargetDistributionMode,
  CompanyTargetRoleShareMap,
  VehicleSegment,
} from "@/types";
import {
  Building2,
  Receipt,
  Gift,
  Bell,
  Save,
  Percent,
  IndianRupee,
  Coins,
  Clock,
  Mail,
  Phone,
  MapPin,
  FileText,
  Scale,
  CalendarClock,
  Check,
  X,
  MessageCircle,
  Sparkles,
  Plus,
  Trash2,
  Car,
  Pencil,
  CreditCard,
  Target,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Users,
  GitBranch,
  LockKeyhole,
  Unlock,
  Copy,
} from "lucide-react";
import {
  branchLimitLabel,
  resolveContactUsUrl,
  resolveSupportPhone,
} from "@/lib/plan-limits";
import {
  formatPaymentStatus,
  termLabelFromMonths,
} from "@/lib/subscription-export-lock";
import { PlanCtaButton } from "@/components/billing/plan-cta-link";
import { SubscriptionBillsSection } from "@/components/billing/subscription-bills-section";
import { SubscriptionRenewDialog } from "@/components/billing/subscription-renew-banner";
import { SubscriptionRenewalWorkbench } from "@/components/billing/subscription-renewal-workbench";

const DEFAULT_TERMS = `1. Vehicle will be kept in secure parking during service.
2. Not responsible for valuables left in vehicle.
3. Warranty: 30 days on parts replaced, 7 days on labor.
4. Payment due upon delivery.
5. Estimated delivery time is subject to parts availability.`;

const COMPANY_TARGET_ROLE_OPTIONS: Array<{
  role: keyof CompanyTargetRoleShareMap;
  label: string;
}> = [
  { role: "ADMIN", label: "Admin" },
  { role: "BRANCH_MANAGER", label: "Branch Manager" },
  { role: "MANAGER", label: "Manager" },
  { role: "SUPERVISOR", label: "Supervisor" },
  { role: "RECEPTIONIST", label: "Receptionist" },
  { role: "MECHANIC", label: "Mechanic" },
];

type RoleShareRowDraft = {
  role: keyof CompanyTargetRoleShareMap;
  percent: number;
};

function defaultRoleShares(): CompanyTargetRoleShareMap {
  return {
    ADMIN: 0,
    BRANCH_MANAGER: 15,
    MANAGER: 15,
    SUPERVISOR: 20,
    RECEPTIONIST: 10,
    MECHANIC: 40,
  };
}

function buildRoleShareRows(
  shares?: CompanyTargetRoleShareMap
): RoleShareRowDraft[] {
  const merged = { ...defaultRoleShares(), ...(shares || {}) };
  return COMPANY_TARGET_ROLE_OPTIONS.map((opt) => ({
    role: opt.role,
    percent: Number(merged[opt.role] ?? 0),
  }));
}

function rowsToRoleShareMap(rows: RoleShareRowDraft[]): CompanyTargetRoleShareMap {
  const next: CompanyTargetRoleShareMap = {};
  for (const opt of COMPANY_TARGET_ROLE_OPTIONS) next[opt.role] = 0;
  for (const row of rows) {
    const v = Number(row.percent);
    next[row.role] = Number.isFinite(v) ? Math.max(0, v) : 0;
  }
  return next;
}

function resolveTierRole(tier: CompanyTargetTierConfig | undefined): keyof CompanyTargetRoleShareMap {
  if (tier?.role) return tier.role;
  const rows = buildRoleShareRows(tier?.roleShares || defaultRoleShares());
  return rows.find((row) => Number(row.percent) > 0)?.role || "MECHANIC";
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={cn(
      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      enabled ? "bg-primary" : "bg-muted"
    )}>
      <span className={cn(
        "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
        enabled ? "translate-x-6" : "translate-x-1"
      )} />
    </button>
  );
}

const SETTINGS_TABS = new Set([
  "business",
  "branding",
  "tax",
  "rewards",
  "terms",
  "incentives",
  "vehicles",
  "high-end",
  "reminders",
  "notifications",
  "plan",
  "general",
]);

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const settings = useSettingsStore();
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const refreshEntitlement = useOrganizationStore((s) => s.refreshEntitlement);
  const initialTab = (() => {
    const raw = searchParams.get("tab")?.trim().toLowerCase() ?? "";
    return SETTINGS_TABS.has(raw) ? raw : "business";
  })();
  const [settingsTab, setSettingsTab] = useState(initialTab);
  const [renewOpen, setRenewOpen] = useState(false);
  const [billsRefreshKey, setBillsRefreshKey] = useState(0);
  const highEndStore = useHighEndServiceStore();
  const vehicleCatalog = useVehicleCatalogStore();
  const [newBrandName, setNewBrandName] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelSegment, setNewModelSegment] = useState<VehicleSegment>("HATCHBACK");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [businessPhone, setBusinessPhone] = useState(settings.businessPhone);
  const [businessEmail, setBusinessEmail] = useState(settings.businessEmail);
  const [businessAddress, setBusinessAddress] = useState(settings.businessAddress);
  const [gstRegistrationStatus, setGstRegistrationStatus] = useState(settings.gstRegistrationStatus);
  const [gstin, setGstin] = useState(settings.gstin);
  const [bankName, setBankName] = useState(settings.bankName);
  const [bankBranch, setBankBranch] = useState(settings.bankBranch);
  const [bankAccountNumber, setBankAccountNumber] = useState(settings.bankAccountNumber);
  const [bankIfsc, setBankIfsc] = useState(settings.bankIfsc);
  const [bankUpi, setBankUpi] = useState(settings.bankUpi);

  const [defaultTaxRate, setDefaultTaxRate] = useState("18");
  const [taxRates, setTaxRates] = useState([
    { id: "1", category: "General Service", rate: "18" },
    { id: "2", category: "Spare Parts", rate: "28" },
    { id: "3", category: "Labour", rate: "18" },
    { id: "4", category: "AC Service", rate: "18" },
    { id: "5", category: "Body Work", rate: "18" },
  ]);

  const rewardPointsPer100 = useCustomerRewardSettingsStore((s) => s.pointsPer100);
  const rewardPointValue = useCustomerRewardSettingsStore((s) => s.pointValue);
  const rewardReferralBonus = useCustomerRewardSettingsStore((s) => s.referralBonus);
  const rewardMinRedeem = useCustomerRewardSettingsStore((s) => s.minRedeem);
  const saveRewardConfig = useCustomerRewardSettingsStore((s) => s.saveConfig);

  const [earningRate, setEarningRate] = useState(String(rewardPointsPer100));
  const [redemptionValue, setRedemptionValue] = useState(String(rewardPointValue));
  const [referralBonus, setReferralBonus] = useState(String(rewardReferralBonus));
  const [minRedeemPoints, setMinRedeemPoints] = useState(String(rewardMinRedeem));

  useEffect(() => {
    setEarningRate(String(rewardPointsPer100));
    setRedemptionValue(String(rewardPointValue));
    setReferralBonus(String(rewardReferralBonus));
    setMinRedeemPoints(String(rewardMinRedeem));
  }, [rewardPointsPer100, rewardPointValue, rewardReferralBonus, rewardMinRedeem]);

  const [notifJobUpdate, setNotifJobUpdate] = useState(true);
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifReminder, setNotifReminder] = useState(true);
  const [notifNewCustomer, setNotifNewCustomer] = useState(false);
  const [notifLowStock, setNotifLowStock] = useState(true);
  const [autoCleanupDays, setAutoCleanupDays] = useState("10");

  const [currency, setCurrency] = useState("INR");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");

  const [termsText, setTermsText] = useState(DEFAULT_TERMS);

  const reminderLeadDays = useSettingsStore((s) => s.reminderLeadDays);
  const reminderPaymentFrequency = useSettingsStore((s) => s.reminderPaymentFrequency);
  const reminderCategoryFrequencies = useSettingsStore((s) => s.reminderCategoryFrequencies);
  const setReminderLeadDays = useSettingsStore((s) => s.setReminderLeadDays);
  const setReminderPaymentFrequency = useSettingsStore((s) => s.setReminderPaymentFrequency);
  const setReminderCategoryFrequency = useSettingsStore((s) => s.setReminderCategoryFrequency);
  const serviceCatalog = useServiceCatalogStore((s) => s.catalog);
  const serviceCategories = useServiceCategoryStore((s) => s.categories);
  /** Reminder categories: prefer category records; fallback to categories present in service catalog rows. */
  const reminderServiceCategories = useMemo(() => {
    if (serviceCategories.length > 0) {
      return [...serviceCategories].sort((a, b) => a.order - b.order);
    }

    const names = Array.from(
      new Set(
        serviceCatalog
          .map((s) => s.category?.trim())
          .filter((v): v is string => Boolean(v && v.length > 0))
      )
    );

    const slugify = (name: string): string => {
      const s = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      return s || "category";
    };

    return names
      .sort((a, b) => a.localeCompare(b))
      .map((name, idx) => ({
        id: name,
        name,
        slug: slugify(name),
        order: idx + 1,
        bikeOnly: false,
      }));
  }, [serviceCategories, serviceCatalog]);

  const staffRewardSettings = useStaffRewardStore((s) => s.settings);
  const updateStaffRewardSettings = useStaffRewardStore((s) => s.updateSettings);

  const emptyRoleRewards = () => Array.from({ length: 4 }, () => ({ role: "", rewardPercent: 0 }));

  const emptyTiers = () => [
    { targetAmount: 0, rewardPercent: 0, roleRewards: emptyRoleRewards() },
    { targetAmount: 0, rewardPercent: 0, roleRewards: emptyRoleRewards() },
    { targetAmount: 0, rewardPercent: 0, roleRewards: emptyRoleRewards() },
    { targetAmount: 0, rewardPercent: 0, roleRewards: emptyRoleRewards() },
  ];

  const dataReady = useDomainDataReady();
  const hasInitializedRef = useRef(false);

  const [companyTargetEnabled, setCompanyTargetEnabled] = useState(false);
  const [companyTargetRevenueType, setCompanyTargetRevenueType] = useState<"INVOICES">("INVOICES");
  const [companyTargetPeriod, setCompanyTargetPeriod] = useState<"MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY">("MONTHLY");
  const [companyTargetDistributionMode, setCompanyTargetDistributionMode] =
    useState<CompanyTargetDistributionMode>("DISTRIBUTE_EQUALLY");
  const [companyTargetRoleShareRows, setCompanyTargetRoleShareRows] =
    useState<RoleShareRowDraft[]>(buildRoleShareRows(defaultRoleShares()));
  const [companyTargetFrequencyTiers, setCompanyTargetFrequencyTiers] = useState<
    Record<"MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY", CompanyTargetTierConfig[]>
  >({
    MONTHLY: emptyTiers(),
    QUARTERLY: emptyTiers(),
    HALF_YEARLY: emptyTiers(),
    YEARLY: emptyTiers(),
  });

  useEffect(() => {
    if (dataReady && staffRewardSettings && !hasInitializedRef.current) {
      setCompanyTargetEnabled(!!staffRewardSettings.companyTargetEnabled);
      setCompanyTargetRevenueType("INVOICES");

      const currentPeriod = staffRewardSettings.companyTargetPeriod || "MONTHLY";
      setCompanyTargetPeriod(currentPeriod);
      setCompanyTargetDistributionMode(
        staffRewardSettings.companyTargetDistributionMode || "DISTRIBUTE_EQUALLY"
      );
      setCompanyTargetRoleShareRows(
        buildRoleShareRows(staffRewardSettings.companyTargetRoleShares || defaultRoleShares())
      );

      const loadedFreqTiers = staffRewardSettings.companyTargetFrequencyTiers || {} as any;
      const legacyTiers = staffRewardSettings.companyTargetTiers || [];
      const fallbackRoleShares = staffRewardSettings.companyTargetRoleShares || defaultRoleShares();

      const normalizeTiers = (tiers: any[] | undefined): CompanyTargetTierConfig[] => {
        const source = Array.isArray(tiers) && tiers.length > 0 ? tiers : emptyTiers();
        return source.map((tier) => ({
          targetAmount: Number(tier?.targetAmount || 0),
          rewardPercent: Number(tier?.rewardPercent || 0),
          role: resolveTierRole(tier as CompanyTargetTierConfig),
          roleShares: rowsToRoleShareMap(
            buildRoleShareRows(
              (tier?.roleShares as CompanyTargetRoleShareMap | undefined) || fallbackRoleShares
            )
          ),
          roleRewards: Array.isArray(tier?.roleRewards) && tier.roleRewards.length > 0
            ? tier.roleRewards
            : emptyRoleRewards(),
        }));
      };

      setCompanyTargetFrequencyTiers({
        MONTHLY: normalizeTiers(loadedFreqTiers.MONTHLY || (currentPeriod === "MONTHLY" && legacyTiers.length > 0 ? legacyTiers : undefined)),
        QUARTERLY: normalizeTiers(loadedFreqTiers.QUARTERLY || (currentPeriod === "QUARTERLY" && legacyTiers.length > 0 ? legacyTiers : undefined)),
        HALF_YEARLY: normalizeTiers(loadedFreqTiers.HALF_YEARLY || (currentPeriod === "HALF_YEARLY" && legacyTiers.length > 0 ? legacyTiers : undefined)),
        YEARLY: normalizeTiers(loadedFreqTiers.YEARLY || (currentPeriod === "YEARLY" && legacyTiers.length > 0 ? legacyTiers : undefined)),
      });
      hasInitializedRef.current = true;
    }
  }, [dataReady, staffRewardSettings]);

  const patchCompanyTargetTier = (
    index: number,
    field: "targetAmount" | "rewardPercent" | string,
    value: number | string
  ) => {
    setCompanyTargetFrequencyTiers((prev) => {
      const copyAll = { ...prev } as any;
      const currentPeriod = companyTargetPeriod;
      const copyTiers = [...(copyAll[currentPeriod] || emptyTiers())];
      if (!copyTiers[index]) {
        copyTiers[index] = { targetAmount: 0, rewardPercent: 0 };
      }
      copyTiers[index] = { ...copyTiers[index]!, [field]: value };
      copyAll[currentPeriod] = copyTiers;
      return copyAll;
    });
  };

  const patchTierRoleRewardRow = (
    tierIdx: number,
    rowIdx: number,
    field: "role" | "rewardPercent",
    value: string | number
  ) => {
    setCompanyTargetFrequencyTiers((prev) => {
      const copyAll = { ...prev } as any;
      const copyTiers = [...(copyAll[companyTargetPeriod] || emptyTiers())];
      const tier = copyTiers[tierIdx] || { targetAmount: 0, rewardPercent: 0 };
      const roleRewards = [...((tier as any).roleRewards || emptyRoleRewards())];
      roleRewards[rowIdx] = { ...roleRewards[rowIdx], [field]: value };
      copyTiers[tierIdx] = { ...tier, roleRewards };
      copyAll[companyTargetPeriod] = copyTiers;
      return copyAll;
    });
  };

  const updateRoleShareRow = (index: number, patch: Partial<RoleShareRowDraft>) => {
    setCompanyTargetRoleShareRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const addRoleShareRow = () => {
    setCompanyTargetRoleShareRows((prev) => {
      const used = new Set(prev.map((r) => r.role));
      const nextRole = COMPANY_TARGET_ROLE_OPTIONS.find((o) => !used.has(o.role));
      if (!nextRole) return prev;
      return [...prev, { role: nextRole.role, percent: 0 }];
    });
  };

  const removeRoleShareRow = (index: number) => {
    setCompanyTargetRoleShareRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSaveCompanyTargets = () => {
    if (companyTargetDistributionMode === "DISTRIBUTE_ROLE_WISE") {
      const total = companyTargetRoleShareRows.reduce((s, r) => s + Number(r.percent || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        toast.error("Role-wise reward % must total 100.");
        return;
      }
    }
    updateStaffRewardSettings({
      companyTargetEnabled,
      companyTargetRevenueType,
      companyTargetPeriod,
      companyTargetTiers: companyTargetFrequencyTiers[companyTargetPeriod] as any,
      companyTargetFrequencyTiers: companyTargetFrequencyTiers as any,
      companyTargetDistributionMode,
      companyTargetRoleShares: rowsToRoleShareMap(companyTargetRoleShareRows),
    });
    toast.success("Company target rewards settings saved.");
  };

  useEffect(() => {
    if (dataReady && staffRewardSettings && !hasInitializedRef.current) {
      setCompanyTargetEnabled(!!staffRewardSettings.companyTargetEnabled);
      setCompanyTargetRevenueType("INVOICES");
      
      const currentPeriod = staffRewardSettings.companyTargetPeriod || "MONTHLY";
      setCompanyTargetPeriod(currentPeriod);
      
      const loadedFreqTiers = staffRewardSettings.companyTargetFrequencyTiers || {} as any;
      const legacyTiers = staffRewardSettings.companyTargetTiers || [];
      const fallbackRoleShares =
        staffRewardSettings.companyTargetRoleShares || defaultRoleShares();
      const normalizeTiers = (tiers: any[] | undefined): CompanyTargetTierConfig[] => {
        const source = Array.isArray(tiers) && tiers.length > 0 ? tiers : emptyTiers();
        return source.map((tier) => ({
          targetAmount: Number(tier?.targetAmount || 0),
          rewardPercent: Number(tier?.rewardPercent || 0),
          role: resolveTierRole(tier as CompanyTargetTierConfig),
          roleShares: rowsToRoleShareMap(
            buildRoleShareRows(
              (tier?.roleShares as CompanyTargetRoleShareMap | undefined) || fallbackRoleShares
            )
          ),
          roleRewards: Array.isArray(tier?.roleRewards) && tier.roleRewards.length > 0
            ? tier.roleRewards
            : emptyRoleRewards(),
        }));
      };
      
      setCompanyTargetFrequencyTiers({
        MONTHLY: normalizeTiers(
          loadedFreqTiers.MONTHLY ||
            (currentPeriod === "MONTHLY" && legacyTiers.length > 0 ? legacyTiers : undefined)
        ),
        QUARTERLY: normalizeTiers(
          loadedFreqTiers.QUARTERLY ||
            (currentPeriod === "QUARTERLY" && legacyTiers.length > 0 ? legacyTiers : undefined)
        ),
        HALF_YEARLY: normalizeTiers(
          loadedFreqTiers.HALF_YEARLY ||
            (currentPeriod === "HALF_YEARLY" && legacyTiers.length > 0 ? legacyTiers : undefined)
        ),
        YEARLY: normalizeTiers(
          loadedFreqTiers.YEARLY ||
            (currentPeriod === "YEARLY" && legacyTiers.length > 0 ? legacyTiers : undefined)
        ),
      });
      hasInitializedRef.current = true;
    }
  }, [dataReady, staffRewardSettings]);

  const [newHesName, setNewHesName] = useState("");
  const [newHesTotalYears, setNewHesTotalYears] = useState("5");
  const [newHesIntervalMonths, setNewHesIntervalMonths] = useState("6");
  const [newHesPrices, setNewHesPrices] = useState({ ...EMPTY_HIGH_END_PRICE_DRAFT });
  const [addHesOpen, setAddHesOpen] = useState(false);
  const [editingHesId, setEditingHesId] = useState<string | null>(null);
  const [editHesName, setEditHesName] = useState("");
  const [editHesPrices, setEditHesPrices] = useState({ ...EMPTY_HIGH_END_PRICE_DRAFT });
  const [editHesIntervalMonths, setEditHesIntervalMonths] = useState("6");
  const [editHesTotalYears, setEditHesTotalYears] = useState("5");

  const buildReminderIntervals = (intervalMonths: number, totalYears: number): number[] => {
    const intervals: number[] = [];
    for (let m = intervalMonths; m <= totalYears * 12; m += intervalMonths) {
      intervals.push(m);
    }
    return intervals;
  };

  /** Infer step from existing schedule (defaults to first interval or 6). */
  const inferredIntervalMonths = (intervals: number[]): number => {
    if (intervals.length === 0) return 6;
    if (intervals.length === 1) return intervals[0]!;
    const step = intervals[1]! - intervals[0]!;
    return step > 0 ? step : intervals[0]!;
  };

  const formatIntervalLabel = (months: number) => {
    if (months === 3) return "Every 3 months";
    if (months === 6) return "Every 6 months";
    if (months === 12) return "Every 1 year";
    return `Every ${months} months`;
  };

  const startEditHighEndService = (svc: (typeof highEndStore.services)[number]) => {
    setEditingHesId(svc.id);
    setEditHesName(svc.name);
    const sp = svc.segmentPricing;
    const fallback = String(svc.estimateAmountInr ?? "");
    setEditHesPrices({
      HATCHBACK: sp?.HATCHBACK ? String(sp.HATCHBACK) : fallback,
      SEDAN: sp?.SEDAN ? String(sp.SEDAN) : fallback,
      SUV: sp?.SUV ? String(sp.SUV) : fallback,
      LUXURY: sp?.LUXURY ? String(sp.LUXURY) : fallback,
      MUV: sp?.MUV ? String(sp.MUV) : fallback,
      COMPACT_SUV: sp?.COMPACT_SUV ? String(sp.COMPACT_SUV) : fallback,
      BIKE: sp?.BIKE ? String(sp.BIKE) : fallback,
    });
    setEditHesIntervalMonths(String(inferredIntervalMonths(svc.reminderIntervals)));
    setEditHesTotalYears(String(svc.totalYears));
  };

  const cancelEditHighEndService = () => {
    setEditingHesId(null);
  };

  const saveEditHighEndService = () => {
    if (!editingHesId) return;
    const name = editHesName.trim();
    if (!name) {
      toast.error("Enter service name");
      return;
    }
    const totalYears = parseInt(editHesTotalYears, 10) || 5;
    const intervalMonths = parseInt(editHesIntervalMonths, 10) || 6;
    const parsed = {
      HATCHBACK: Math.max(0, parseFloat(editHesPrices.HATCHBACK) || 0),
      SEDAN: Math.max(0, parseFloat(editHesPrices.SEDAN) || 0),
      SUV: Math.max(0, parseFloat(editHesPrices.SUV) || 0),
      BIKE: Math.max(0, parseFloat(editHesPrices.BIKE) || 0),
    };
    if (parsed.HATCHBACK === 0 && parsed.SEDAN === 0 && parsed.SUV === 0 && parsed.BIKE === 0) {
      toast.error("Enter at least one vehicle type price");
      return;
    }
    const segmentPricing = buildHighEndSegmentPricing(parsed);
    highEndStore.updateService(editingHesId, {
      name,
      estimateAmountInr: highEndDefaultEstimate(segmentPricing),
      segmentPricing,
      totalYears,
      reminderIntervals: buildReminderIntervals(intervalMonths, totalYears),
    });
    setEditingHesId(null);
    toast.success(`"${name}" saved`);
  };

  const resetAddHighEndForm = () => {
    setNewHesName("");
    setNewHesTotalYears("5");
    setNewHesIntervalMonths("6");
    setNewHesPrices({ ...EMPTY_HIGH_END_PRICE_DRAFT });
  };

  const openAddHighEndService = () => {
    resetAddHighEndForm();
    setAddHesOpen(true);
  };

  const handleAddHighEndService = () => {
    if (!newHesName.trim()) { toast.error("Enter service name"); return; }
    const totalYears = parseInt(newHesTotalYears, 10) || 5;
    const intervalMonths = parseInt(newHesIntervalMonths, 10) || 6;
    const intervals = buildReminderIntervals(intervalMonths, totalYears);
    const parsed = {
      HATCHBACK: Math.max(0, parseFloat(newHesPrices.HATCHBACK) || 0),
      SEDAN: Math.max(0, parseFloat(newHesPrices.SEDAN) || 0),
      SUV: Math.max(0, parseFloat(newHesPrices.SUV) || 0),
      BIKE: Math.max(0, parseFloat(newHesPrices.BIKE) || 0),
    };
    if (parsed.HATCHBACK === 0 && parsed.SEDAN === 0 && parsed.SUV === 0 && parsed.BIKE === 0) {
      toast.error("Enter at least one vehicle type price");
      return;
    }
    const segmentPricing = buildHighEndSegmentPricing(parsed);
    const name = newHesName.trim();
    highEndStore.addService({
      name,
      reminderIntervals: intervals,
      totalYears,
      estimateAmountInr: highEndDefaultEstimate(segmentPricing),
      segmentPricing,
    });
    resetAddHighEndForm();
    setAddHesOpen(false);
    toast.success(`"${name}" added as high-end service`);
  };

  const handleSave = (section: string) => {
    if (section === "Business profile") {
      settings.setBusinessProfile({
        gstRegistrationStatus,
        businessName,
        businessPhone,
        businessEmail,
        businessAddress,
        gstin,
        bankName,
        bankBranch,
        bankAccountNumber,
        bankIfsc,
        bankUpi,
      });
    }

    if (section === "Tax & Billing settings") {
      settings.setBusinessProfile({
        gstRegistrationStatus,
        gstin,
      });
    }

    toast.success(`${section} saved successfully`);
  };

  const handleTaxRateChange = (id: string, rate: string) => {
    setTaxRates((prev) => prev.map((t) => (t.id === id ? { ...t, rate } : t)));
  };

  const isGstRegistered = gstRegistrationStatus === "REGISTERED";

  useEffect(() => {
    void refreshEntitlement();
  }, [refreshEntitlement]);

  useEffect(() => {
    const raw = searchParams.get("tab")?.trim().toLowerCase() ?? "";
    if (SETTINGS_TABS.has(raw)) setSettingsTab(raw);
  }, [searchParams]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Settings" />

      <Tabs value={settingsTab} onValueChange={setSettingsTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 border border-border/60 rounded-xl p-1.5">
          <TabsTrigger value="business" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Business</TabsTrigger>
          <TabsTrigger value="branding" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Branding & Theme</TabsTrigger>
          <TabsTrigger value="tax" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Tax & Billing</TabsTrigger>
          <TabsTrigger value="rewards" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Rewards Points</TabsTrigger>
          <TabsTrigger value="terms" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Terms & Conditions</TabsTrigger>
          <TabsTrigger value="incentives" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Incentives</TabsTrigger>
          <TabsTrigger value="vehicles" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Vehicle Catalog</TabsTrigger>
          <TabsTrigger value="high-end" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">High-End Services</TabsTrigger>
          <TabsTrigger value="reminders" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Reminders</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Notifications</TabsTrigger>
          <TabsTrigger value="plan" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">Plan & billing</TabsTrigger>
          <TabsTrigger value="general" className="rounded-lg text-xs font-medium px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground data-[state=active]:font-semibold">General</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4">
          <BrandingThemePanel />
        </TabsContent>

        <TabsContent value="plan">
          <div className="space-y-4">
            {entitlement ? (
              <>
                {/* Expiry / Export Lock Warning Banner */}
                {(() => {
                  const days = entitlement.subscription.daysRemaining;
                  const exportLocked = entitlement.subscription.exportLocked === true || entitlement.canExportData === false;
                  const expired = typeof days === "number" && days < 0;
                  const expiringSoon = typeof days === "number" && days >= 0 && days <= 30;
                  if (expired || expiringSoon || exportLocked) {
                    return (
                      <div className={cn(
                        "flex items-start gap-3 rounded-xl border px-4 py-3",
                        expired
                          ? "border-destructive/30 bg-destructive/5 text-destructive dark:bg-destructive/10"
                          : "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-100"
                      )}>
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">
                            {expired
                              ? "Subscription expired"
                              : `Subscription expires in ${days} day${days === 1 ? "" : "s"}`}
                          </p>
                          {exportLocked && (
                            <p className="mt-0.5 text-sm opacity-80">
                              Exports and data downloads are locked. Your data is safe — renew to restore access.
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0"
                          variant={expired ? "destructive" : "default"}
                          onClick={() => {
                            document.getElementById("renew-workbench")?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          Renew now
                        </Button>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Current Subscription Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Current Subscription
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            entitlement.subscription.status === "ACTIVE"
                              ? "default"
                              : entitlement.subscription.status === "EXPIRED"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {entitlement.subscription.status}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => void refreshEntitlement()}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Plan</p>
                        <p className="font-semibold">{entitlement.subscription.planName}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Term</p>
                        <p className="font-medium">{termLabelFromMonths(entitlement.subscription.termMonths ?? 12)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Payment status</p>
                        <p className="flex items-center gap-1.5 font-medium">
                          {entitlement.subscription.paymentStatus === "PAID"
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            : entitlement.subscription.paymentStatus === "PENDING"
                              ? <Clock className="h-3.5 w-3.5 text-amber-500" />
                              : null}
                          {formatPaymentStatus(entitlement.subscription.paymentStatus)}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Start date</p>
                        <p className="font-medium">
                          {entitlement.subscription.startsAt
                            ? formatDate(entitlement.subscription.startsAt)
                            : "—"}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Expiry date</p>
                        <p className="font-medium">
                          {entitlement.subscription.expiresAt || entitlement.subscription.currentPeriodEnd
                            ? formatDate(entitlement.subscription.expiresAt ?? entitlement.subscription.currentPeriodEnd!)
                            : "—"}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Days remaining</p>
                        <p className={cn("font-semibold", typeof entitlement.subscription.daysRemaining === "number" && entitlement.subscription.daysRemaining <= 30 ? "text-orange-600 dark:text-orange-400" : "")}>
                          {typeof entitlement.subscription.daysRemaining === "number"
                            ? `${entitlement.subscription.daysRemaining} days`
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Usage */}
                    <Separator />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <GitBranch className="h-3.5 w-3.5" />
                          Branches
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold">{entitlement.usage.branchesUsed}</span>
                          <span className="text-sm text-muted-foreground">/ {branchLimitLabel(entitlement.subscription.effectiveMaxBranches)}</span>
                        </div>
                        {(() => {
                          const max = entitlement.subscription.effectiveMaxBranches;
                          if (max !== null && max !== undefined && entitlement.usage.branchesUsed >= max) {
                            return (
                              <p className="mt-1.5 text-xs text-orange-600 dark:text-orange-400">
                                Branch limit reached. Add extra branches when renewing.
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          Users
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold">{entitlement.usage.usersUsed ?? 0}</span>
                          <span className="text-sm text-muted-foreground">
                            / {entitlement.subscription.effectiveMaxUsers == null ? "unlimited" : entitlement.subscription.effectiveMaxUsers}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Super Admin always counts as 1 user. Mechanics do not use a seat.
                        </p>
                        {(() => {
                          const max = entitlement.subscription.effectiveMaxUsers;
                          const used = entitlement.usage.usersUsed ?? 0;
                          if (max !== null && max !== undefined && used >= max) {
                            return (
                              <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                                User limit reached. Add extra users when renewing.
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* Exports */}
                    <div className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
                      entitlement.canExportData === false || entitlement.subscription.exportLocked
                        ? "border-destructive/20 bg-destructive/5 text-destructive"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                    )}>
                      {entitlement.canExportData === false || entitlement.subscription.exportLocked
                        ? <LockKeyhole className="h-4 w-4 shrink-0" />
                        : <Unlock className="h-4 w-4 shrink-0" />}
                      <span>
                        {entitlement.canExportData === false || entitlement.subscription.exportLocked
                          ? "Data exports and downloads are currently locked. Your data is safe — renew to restore full access."
                          : "Data exports and downloads are available."}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Your business data is never deleted when a subscription expires. Exports lock when 30 or fewer days remain.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <PlanCtaButton
                        href={resolveContactUsUrl(entitlement)}
                        phone={resolveSupportPhone(entitlement)}
                        dialogTitle="Contact support"
                      >
                        Contact support
                      </PlanCtaButton>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Gift className="h-4 w-4" />
                      Referral code
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {entitlement.subscription.status === "TRIAL" ? (
                      <p className="text-sm text-muted-foreground">
                        Your workshop referral code is created after you convert from trial. Share it with other
                        workshops so they get a discount on their first paid plan.
                      </p>
                    ) : entitlement.organization.shareReferralCode ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Share this link or code. A new workshop gets a discount on their first paid plan, and you
                          earn 500 referral points when they pay (1 point = ₹1 before GST). Redeem points on
                          renew, upgrade, or branch/user add-ons.
                        </p>
                        {(entitlement.organization.referralWalletPoints ?? 0) > 0 ? (
                          <p className="text-sm font-medium">
                            Wallet: {entitlement.organization.referralWalletPoints} points — use at checkout
                            under Upgrade / Renew or Add branch / user.
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="rounded-lg border bg-muted/50 px-3 py-2 font-mono text-lg font-semibold tracking-wide">
                            {entitlement.organization.shareReferralCode}
                          </code>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const code = entitlement.organization.shareReferralCode;
                              if (!code) return;
                              void navigator.clipboard.writeText(code).then(
                                () => toast.success("Referral code copied"),
                                () => toast.error("Could not copy code")
                              );
                            }}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy code
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const code = entitlement.organization.shareReferralCode;
                              if (!code) return;
                              const url = `${marketingSignupUrl()}?ref=${encodeURIComponent(code)}`;
                              void navigator.clipboard.writeText(url).then(
                                () => toast.success("Referral link copied"),
                                () => toast.error("Could not copy link")
                              );
                            }}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy link
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Referral code is being prepared. Refresh this page in a moment, or contact support if it
                        still doesn’t appear.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Renewal Workbench */}
                <Card id="renew-workbench">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Plan, renew & capacity</CardTitle>
                    <p className="text-sm font-normal text-muted-foreground">
                      Change plan or renew above. On a paid active subscription, buy extra branches or
                      users below without changing your plan or expiry.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <SubscriptionRenewalWorkbench
                      entitlement={entitlement}
                      onEntitlementUpdated={async () => {
                        await refreshEntitlement();
                        setBillsRefreshKey((n) => n + 1);
                      }}
                    />
                  </CardContent>
                </Card>

                {/* Bills */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4" />
                      Bills
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SubscriptionBillsSection refreshKey={billsRefreshKey} />
                  </CardContent>
                </Card>

                <SubscriptionRenewDialog open={renewOpen} onOpenChange={setRenewOpen} />
              </>
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Unable to load plan details. Refresh the page or contact support.
                  </p>
                  <Button type="button" variant="outline" className="mt-3" onClick={() => void refreshEntitlement()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Business Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Phone</Label>
                        <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Email</Label>
                        <Input value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Address</Label>
                      <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>GST Registration</Label>
                      <Select value={gstRegistrationStatus} onValueChange={(value) => setGstRegistrationStatus(value as "REGISTERED" | "NOT_REGISTERED")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REGISTERED">GST Registered</SelectItem>
                          <SelectItem value="NOT_REGISTERED">GST Not Registered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />GSTIN</Label>
                      <Input
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value)}
                        className="font-mono"
                        disabled={gstRegistrationStatus === "NOT_REGISTERED"}
                        placeholder={gstRegistrationStatus === "NOT_REGISTERED" ? "Not required for non-GST business" : undefined}
                      />
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-lg border border-border/70 p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-muted-foreground">Bank & UPI Details (For Payment QR)</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Bank Name</Label>
                          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Branch Name</Label>
                          <Input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Account Number</Label>
                          <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>IFSC Code</Label>
                          <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} className="font-mono" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-primary font-medium">Merchant UPI ID (e.g. name@bank)</Label>
                        <Input value={bankUpi} onChange={(e) => setBankUpi(e.target.value)} placeholder="name@bank" className="font-semibold" />
                      </div>
                    </div>
                  </div>
                </div>
                <Separator />
                <Button onClick={() => handleSave("Business profile")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Tax Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">GST Registration</p>
                      <p className="text-xs text-muted-foreground">Choose whether invoices should be issued as tax invoices or plain invoices.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Registration Status</Label>
                    <Select value={gstRegistrationStatus} onValueChange={(value) => setGstRegistrationStatus(value as "REGISTERED" | "NOT_REGISTERED")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REGISTERED">GST Registered</SelectItem>
                        <SelectItem value="NOT_REGISTERED">GST Not Registered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5" />Default Tax Rate (%)</Label>
                  <Input
                    type="number"
                    value={defaultTaxRate}
                    onChange={(e) => setDefaultTaxRate(e.target.value)}
                    className={cn("max-w-32", !isGstRegistered && "opacity-60")}
                    disabled={!isGstRegistered}
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium">Category-wise Tax Rates</p>
                  {taxRates.map((t) => (
                    <div key={t.id} className="flex items-center gap-4">
                      <span className="text-sm min-w-[140px]">{t.category}</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          value={t.rate}
                          onChange={(e) => handleTaxRateChange(t.id, e.target.value)}
                          className={cn("w-20 h-9", !isGstRegistered && "opacity-60")}
                          disabled={!isGstRegistered}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
                <Button onClick={() => handleSave("Tax & Billing settings")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Rewards & Referral Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" />Points Earning Rate</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={earningRate} onChange={(e) => setEarningRate(e.target.value)} className="w-24" />
                    <span className="text-sm text-muted-foreground">points per ₹100 spent</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" />Redemption Value</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">1 point =</span>
                    <span className="text-sm text-muted-foreground">₹</span>
                    <Input type="number" step="0.01" value={redemptionValue} onChange={(e) => setRedemptionValue(e.target.value)} className="w-24" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Gift className="w-3.5 h-3.5" />Referral Bonus Points</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={referralBonus} onChange={(e) => setReferralBonus(e.target.value)} className="w-24" />
                    <span className="text-sm text-muted-foreground">points for both referrer and new customer</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Points to Redeem</Label>
                  <Input type="number" value={minRedeemPoints} onChange={(e) => setMinRedeemPoints(e.target.value)} className="w-24" />
                </div>
                <Separator />
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium mb-2">Example Calculation</p>
                  <p className="text-xs text-muted-foreground">
                    Customer spends ₹5,000 → Earns {(5000 / 100 * Number(earningRate)).toFixed(0)} points →
                    Worth ₹{(5000 / 100 * Number(earningRate) * Number(redemptionValue)).toFixed(2)} discount
                  </p>
                </div>

                <Button
                  onClick={() => {
                    const pointsPer100 = Number(earningRate);
                    const pointValue = Number(redemptionValue);
                    const referralBonusPts = Number(referralBonus);
                    const minRedeem = Number(minRedeemPoints);
                    if (!Number.isFinite(pointsPer100) || pointsPer100 <= 0) {
                      toast.error("Points earning rate must be a positive number");
                      return;
                    }
                    if (!Number.isFinite(pointValue) || pointValue <= 0) {
                      toast.error("Redemption value must be a positive amount");
                      return;
                    }
                    if (!Number.isFinite(referralBonusPts) || referralBonusPts < 0) {
                      toast.error("Referral bonus must be zero or greater");
                      return;
                    }
                    if (!Number.isFinite(minRedeem) || minRedeem < 0) {
                      toast.error("Minimum redeem points must be zero or greater");
                      return;
                    }
                    saveRewardConfig({
                      pointsPer100,
                      pointValue,
                      referralBonus: referralBonusPts,
                      minRedeem: Math.floor(minRedeem),
                    });
                    toast.success("Rewards configuration saved");
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Scale className="w-4 h-4" />
                Terms & Conditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-2xl">
                <div className="space-y-2">
                  <Label>Default Terms & Conditions</Label>
                  <Textarea
                    value={termsText}
                    onChange={(e) => setTermsText(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="Enter your default terms and conditions..."
                  />
                </div>
                <Button onClick={() => handleSave("Terms & Conditions")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incentives">
          <div className="grid grid-cols-1 gap-4 items-start">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-0.5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    Company Target-Based Rewards
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Enable rewards based on company-wide target achievements
                  </p>
                </div>
                <ToggleSwitch
                  enabled={companyTargetEnabled}
                  onToggle={() => setCompanyTargetEnabled(!companyTargetEnabled)}
                />
              </CardHeader>
              <CardContent>
                <div className="space-y-3.5">

                  {/* Distribution Model */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Revenue Basis</Label>
                      <Input value="Invoices (valid billed totals)" disabled className="bg-muted" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Distribution Model</Label>
                      <Select
                        value={companyTargetDistributionMode}
                        onValueChange={(v) => setCompanyTargetDistributionMode(v as CompanyTargetDistributionMode)}
                        disabled={!companyTargetEnabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DISTRIBUTE_EQUALLY">Distribute equally</SelectItem>
                          <SelectItem value="DISTRIBUTE_ROLE_WISE">Distribute role wise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Target Tiers */}
                  <div className="space-y-3">
                    <hr className="border-t border-border" />
                    <h4 className="text-sm font-semibold text-foreground">Target Tiers Configuration</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[0, 1, 2, 3].map((idx) => {
                        const currentFreqTiers = companyTargetFrequencyTiers[companyTargetPeriod] || [];
                        const tier = currentFreqTiers[idx] || { targetAmount: 0, rewardPercent: 0 };
                        return (
                          <div key={idx} className="space-y-1.5 rounded-lg border p-2 px-3 bg-muted/20">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Tier {idx + 1}</p>
                            <div className="space-y-1">
                              <div>
                                <Label className="text-[11px] font-medium">Target Amount (₹)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  disabled={!companyTargetEnabled}
                                  value={tier.targetAmount || ""}
                                  placeholder="e.g. 500000"
                                  onChange={(e) => patchCompanyTargetTier(idx, "targetAmount", Number(e.target.value) || 0)}
                                />
                              </div>
                              {companyTargetDistributionMode === "DISTRIBUTE_ROLE_WISE" ? (
                                <div className="space-y-1.5">
                                  <div className="grid grid-cols-2 gap-1.5 mb-1">
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Role</p>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Reward %</p>
                                  </div>
                                  {Array.from({ length: 4 }).map((_, rowIdx) => {
                                    const roleRewards = (tier as any).roleRewards || [];
                                    const rr = roleRewards[rowIdx] || { role: "", rewardPercent: 0 };
                                    return (
                                      <div key={rowIdx} className="grid grid-cols-2 gap-1.5">
                                        <Select
                                          value={rr.role || ""}
                                          onValueChange={(v) => patchTierRoleRewardRow(idx, rowIdx, "role", v)}
                                          disabled={!companyTargetEnabled}
                                        >
                                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select role" /></SelectTrigger>
                                          <SelectContent>
                                            {COMPANY_TARGET_ROLE_OPTIONS.map((opt) => (
                                              <SelectItem key={opt.role} value={opt.role}>{opt.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Input
                                          type="number" min={0} step="0.1" className="h-8 text-xs"
                                          disabled={!companyTargetEnabled}
                                          value={rr.rewardPercent || ""} placeholder="e.g. 2.5"
                                          onChange={(e) => patchTierRoleRewardRow(idx, rowIdx, "rewardPercent", Number(e.target.value) || 0)}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div>
                                  <Label className="text-[11px] font-medium">Reward %</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    disabled={!companyTargetEnabled}
                                    value={tier.rewardPercent || ""}
                                    placeholder="e.g. 2.5"
                                    onChange={(e) => patchCompanyTargetTier(idx, "rewardPercent", Number(e.target.value) || 0)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />
                  <Button onClick={handleSaveCompanyTargets}>
                    <Save className="w-4 h-4 mr-2" />Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reminders">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                Reminder Settings
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Defaults for service-category and pending-payment reminders. Individual high-end
                services can still use custom month schedules under High-End Services.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Default intervals by service category</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Shows every category from{" "}
                        <Link href="/services" className="text-primary underline-offset-2 hover:underline">
                          Services → Categories
                        </Link>
                        . High-end flagged services still use High-End Services schedules when delivered.
                      </p>
                    </div>
                  </div>
                  {reminderServiceCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-6 text-center">
                      No service categories yet. Create them under Services → Categories, then set reminder intervals here.
                    </p>
                  ) : (
                    <div className="grid gap-4">
                      {reminderServiceCategories.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <Label className="min-w-[160px]">{cat.name}</Label>
                            <p className="text-[11px] text-muted-foreground truncate">{cat.slug}</p>
                          </div>
                          <Select
                            value={reminderCategoryFrequencies[cat.id] ?? "MONTHLY"}
                            onValueChange={(v) =>
                              setReminderCategoryFrequency(cat.id, v as SchedulableReminderFrequency)
                            }
                          >
                            <SelectTrigger className="w-[180px] shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SCHEDULABLE_REMINDER_FREQUENCIES.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {REMINDER_FREQUENCY_LABELS[f]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium">Pending payment reminders</p>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="min-w-[160px]">Default frequency</Label>
                    <Select
                      value={reminderPaymentFrequency}
                      onValueChange={(v) =>
                        setReminderPaymentFrequency(v as SchedulableReminderFrequency)
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCHEDULABLE_REMINDER_FREQUENCIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {REMINDER_FREQUENCY_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used when an invoice is unpaid or partially paid. Reminders stop when outstanding
                    is cleared.
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    <div>
                      <p className="text-sm font-medium">WhatsApp Reminders</p>
                      <p className="text-xs text-muted-foreground">
                        When enabled, due reminders may be sent automatically (manual send still
                        available on the Reminders page)
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    enabled={settings.whatsappReminderEnabled}
                    onToggle={() => settings.setWhatsappReminderEnabled(!settings.whatsappReminderEnabled)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reminder Lead Days</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={String(reminderLeadDays)}
                      onChange={(e) => setReminderLeadDays(Number(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days before due date</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    How many days before the due date a reminder becomes Due / eligible to send
                  </p>
                </div>
                <Separator />
                <Button
                  onClick={() => {
                    toast.success("Reminder settings saved");
                  }}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-w-xl">
                {[
                  { label: "Job card status updates", desc: "Notify when job card status changes", enabled: notifJobUpdate, toggle: () => setNotifJobUpdate((v) => !v) },
                  { label: "Payment received", desc: "Notify when a payment is recorded", enabled: notifPayment, toggle: () => setNotifPayment((v) => !v) },
                  { label: "Service reminders", desc: "Notify when a service reminder is due", enabled: notifReminder, toggle: () => setNotifReminder((v) => !v) },
                  { label: "New customer registration", desc: "Notify when a new customer signs up", enabled: notifNewCustomer, toggle: () => setNotifNewCustomer((v) => !v) },
                  { label: "Low stock alerts", desc: "Notify when inventory items are below reorder level", enabled: notifLowStock, toggle: () => setNotifLowStock((v) => !v) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-4 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <ToggleSwitch enabled={item.enabled} onToggle={item.toggle} />
                  </div>
                ))}
                <div className="pt-4">
                  <Button onClick={() => handleSave("Notification preferences")}>
                    <Save className="w-4 h-4 mr-2" />Save Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="w-4 h-4" />
                Vehicle Brands & Models
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage the brands and models available in the system. When a new vehicle launches in the market, add it here.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label>Add New Brand</Label>
                  <Input
                    placeholder="e.g. BYD, Rivian"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!newBrandName.trim()) return;
                    if (vehicleCatalog.brands.some((b) => b.name.toLowerCase() === newBrandName.trim().toLowerCase())) {
                      toast.error("Brand already exists");
                      return;
                    }
                    vehicleCatalog.addBrand(newBrandName.trim());
                    setNewBrandName("");
                    toast.success(`${newBrandName.trim()} added`);
                  }}
                  disabled={!newBrandName.trim()}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Brand
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                {vehicleCatalog.brands.map((brand) => (
                  <div key={brand.id} className="border rounded-lg">
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedBrandId(selectedBrandId === brand.id ? null : brand.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{brand.name}</span>
                        <Badge variant="secondary" className="text-xs">{brand.models.length} models</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            vehicleCatalog.removeBrand(brand.id);
                            toast.success(`${brand.name} removed`);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {selectedBrandId === brand.id && (
                      <div className="border-t p-3 bg-muted/30 space-y-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Model Name</Label>
                            <Input
                              placeholder="e.g. Swift, Creta"
                              value={newModelName}
                              onChange={(e) => setNewModelName(e.target.value)}
                            />
                          </div>
                          <div className="w-36 space-y-1">
                            <Label className="text-xs">Segment</Label>
                            <Select value={newModelSegment} onValueChange={(v) => setNewModelSegment(v as VehicleSegment)}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="HATCHBACK">Hatchback</SelectItem>
                                <SelectItem value="SEDAN">Sedan</SelectItem>
                                <SelectItem value="COMPACT_SUV">Compact SUV</SelectItem>
                                <SelectItem value="SUV">SUV</SelectItem>
                                <SelectItem value="MUV">MUV</SelectItem>
                                <SelectItem value="LUXURY">Luxury</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!newModelName.trim()) return;
                              vehicleCatalog.addModel(brand.id, newModelName.trim(), newModelSegment);
                              setNewModelName("");
                            }}
                            disabled={!newModelName.trim()}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        {brand.models.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {brand.models.map((model) => (
                              <Badge key={model.name} variant="outline" className="gap-1 pr-1">
                                {model.name}
                                <span className="text-[10px] text-muted-foreground ml-0.5">
                                  ({model.segment === "COMPACT_SUV" ? "C-SUV" : model.segment === "HATCHBACK" ? "HB" : model.segment})
                                </span>
                                <button
                                  onClick={() => vehicleCatalog.removeModel(brand.id, model.name)}
                                  className="ml-0.5 rounded-full hover:bg-destructive/10 p-0.5"
                                >
                                  <X className="w-3 h-3 text-destructive" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No models added yet</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="high-end" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  High-End Services
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage premium programs: each can have an estimated amount (excl. GST) added on the job card when
                  selected, plus maintenance reminders after delivery.
                </p>
              </div>
              <Button
                type="button"
                className="shrink-0 w-full sm:w-auto"
                onClick={openAddHighEndService}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add new service
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                {highEndStore.services.map((svc) => {
                  const intervalMonths = inferredIntervalMonths(svc.reminderIntervals);
                  const isEditing = editingHesId === svc.id;
                  const draftIntervals = isEditing
                    ? buildReminderIntervals(
                        parseInt(editHesIntervalMonths, 10) || 6,
                        parseInt(editHesTotalYears, 10) || 5
                      )
                    : svc.reminderIntervals;

                  return (
                    <div
                      key={svc.id}
                      className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30"
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-1">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5 sm:col-span-1">
                              <Label className="text-xs">Service name</Label>
                              <Input
                                value={editHesName}
                                onChange={(e) => setEditHesName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Reminder interval</Label>
                              <Select
                                value={editHesIntervalMonths}
                                onValueChange={setEditHesIntervalMonths}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="3">Every 3 months</SelectItem>
                                  <SelectItem value="6">Every 6 months</SelectItem>
                                  <SelectItem value="12">Every 1 year</SelectItem>
                                  {![3, 6, 12].includes(Number(editHesIntervalMonths)) && (
                                    <SelectItem value={editHesIntervalMonths}>
                                      {formatIntervalLabel(Number(editHesIntervalMonths))} (current)
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Total duration</Label>
                              <Select
                                value={editHesTotalYears}
                                onValueChange={setEditHesTotalYears}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 year</SelectItem>
                                  <SelectItem value="2">2 years</SelectItem>
                                  <SelectItem value="3">3 years</SelectItem>
                                  <SelectItem value="5">5 years</SelectItem>
                                  {![1, 2, 3, 5].includes(Number(editHesTotalYears)) && (
                                    <SelectItem value={editHesTotalYears}>
                                      {editHesTotalYears} years (current)
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <HighEndSegmentPricingFields
                            values={editHesPrices}
                            onChange={setEditHesPrices}
                          />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <p className="font-medium">{svc.name}</p>
                              <p className="text-sm text-muted-foreground tabular-nums">
                                {(() => {
                                  const sp = svc.segmentPricing;
                                  const priced = sp
                                    ? [sp.HATCHBACK, sp.SEDAN, sp.SUV, sp.BIKE].filter((n) => n > 0)
                                    : [];
                                  const min =
                                    priced.length > 0
                                      ? Math.min(...priced)
                                      : svc.estimateAmountInr ?? 0;
                                  return sp && priced.length > 1
                                    ? `from ₹${min.toLocaleString("en-IN")} excl. GST`
                                    : `₹${min.toLocaleString("en-IN")} excl. GST`;
                                })()}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatIntervalLabel(intervalMonths)} · {svc.totalYears} year
                              {svc.totalYears !== 1 ? "s" : ""}
                            </p>
                            {svc.segmentPricing && (
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded-md border border-border/30">
                                <span>Hatchback: <strong className="text-foreground font-semibold">₹{(svc.segmentPricing.HATCHBACK ?? 0).toLocaleString("en-IN")}</strong></span>
                                <span className="opacity-40">|</span>
                                <span>Sedan: <strong className="text-foreground font-semibold">₹{(svc.segmentPricing.SEDAN ?? 0).toLocaleString("en-IN")}</strong></span>
                                <span className="opacity-40">|</span>
                                <span>SUV: <strong className="text-foreground font-semibold">₹{(svc.segmentPricing.SUV ?? 0).toLocaleString("en-IN")}</strong></span>
                                <span className="opacity-40">|</span>
                                <span>Bike: <strong className="text-foreground font-semibold">₹{(svc.segmentPricing.BIKE ?? 0).toLocaleString("en-IN")}</strong></span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {draftIntervals.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary"
                            >
                              {m >= 12 && m % 12 === 0 ? `${m / 12}yr` : `${m}mo`}
                            </span>
                          ))}
                        </div>
                        {isEditing && (
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" onClick={saveEditHighEndService}>
                              <Save className="w-3.5 h-3.5 mr-1.5" />
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={cancelEditHighEndService}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {!isEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => startEditHighEndService(svc)}
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={isEditing}
                          onClick={() => {
                            if (editingHesId === svc.id) setEditingHesId(null);
                            highEndStore.removeService(svc.id);
                            toast.success(`"${svc.name}" removed`);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {highEndStore.services.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No high-end services configured</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={openAddHighEndService}
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add new service
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Dialog
            open={addHesOpen}
            onOpenChange={(open) => {
              setAddHesOpen(open);
              if (!open) resetAddHighEndForm();
            }}
          >
            <DialogContent
              className={cn(dialogMobileSheetContentClasses, "max-h-[min(90dvh,780px)] sm:max-w-2xl")}
            >
              <DialogHeader className={cn(dialogMobileSheetHeaderClasses, "pr-12")}>
                <DialogTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </span>
                  Add high-end service
                </DialogTitle>
                <DialogDescription>
                  Set prices by vehicle type and the reminder schedule used on job cards.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="hes-name">Service name</Label>
                  <Input
                    id="hes-name"
                    placeholder="e.g. PPF Coating, Ceramic"
                    value={newHesName}
                    onChange={(e) => setNewHesName(e.target.value)}
                    autoFocus
                  />
                </div>
                <HighEndSegmentPricingFields
                  values={newHesPrices}
                  onChange={setNewHesPrices}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Reminder interval</Label>
                    <Select value={newHesIntervalMonths} onValueChange={setNewHesIntervalMonths}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Every 3 months</SelectItem>
                        <SelectItem value="6">Every 6 months</SelectItem>
                        <SelectItem value="12">Every 1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Total duration</Label>
                    <Select value={newHesTotalYears} onValueChange={setNewHesTotalYears}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 year</SelectItem>
                        <SelectItem value="2">2 years</SelectItem>
                        <SelectItem value="3">3 years</SelectItem>
                        <SelectItem value="4">4 years</SelectItem>
                        <SelectItem value="5">5 years</SelectItem>
                        <SelectItem value="6">6 years</SelectItem>
                        <SelectItem value="7">7 years</SelectItem>
                        <SelectItem value="8">8 years</SelectItem>
                        <SelectItem value="9">9 years</SelectItem>
                        <SelectItem value="10">10 years</SelectItem>
                        <SelectItem value="11">11 years</SelectItem>
                        <SelectItem value="12">12 years</SelectItem>
                        <SelectItem value="13">13 years</SelectItem>
                        <SelectItem value="14">14 years</SelectItem>
                        <SelectItem value="15">15 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-6 py-4 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setAddHesOpen(false);
                    resetAddHighEndForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={handleAddHighEndService}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add service
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 max-w-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5" />Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Time Zone</Label>
                    <Select value={timeZone} onValueChange={setTimeZone}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Auto-delete Inspection Photos After</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={autoCleanupDays} onChange={(e) => setAutoCleanupDays(e.target.value)} className="w-20" />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Set to 0 to keep photos indefinitely</p>
                </div>
                <Separator />
                <Button onClick={() => handleSave("General preferences")}>
                  <Save className="w-4 h-4 mr-2" />Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
