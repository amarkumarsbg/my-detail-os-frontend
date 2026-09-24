"use client";

import { create } from "zustand";
import { putSingletonDocument } from "@/lib/collection-sync";
import { DEFAULT_BRAND_PRIMARY, normalizeHex } from "@/lib/brand-color";
import {
  DEFAULT_LOGIN_HERO_FEATURES,
  normalizeLoginHeroFeatures,
  type LoginHeroFeature,
} from "@/lib/login-hero-content";
import {
  CATEGORY_REMINDER_TYPES,
  parseReminderFrequency,
  type SchedulableReminderFrequency,
} from "@/lib/reminder-schedule";
import type { ReminderType } from "@/types";
import {
  normalizeRewardCategoryIncentivePercents,
  type RewardCategoryIncentivePercents,
} from "@/lib/reward-category-rates";

/** Keyed by Service Management category id (legacy ReminderType keys still accepted). */
export type ReminderCategoryFrequencies = Record<string, SchedulableReminderFrequency>;

export const DEFAULT_REMINDER_CATEGORY_FREQUENCIES: ReminderCategoryFrequencies = {
  GENERAL_SERVICE: "MONTHLY",
  OIL_CHANGE: "QUARTERLY",
  BRAKE_INSPECTION: "BIANNUAL",
  TIRE_ROTATION: "QUARTERLY",
  AC_SERVICE: "QUARTERLY",
  BATTERY_CHECK: "BIANNUAL",
  INSURANCE: "YEARLY",
  PUC: "BIANNUAL",
};

export interface SerializableAppSettings {
  gstRegistrationStatus: "REGISTERED" | "NOT_REGISTERED";
  businessName: string;
  businessLogo: string;
  businessTagline: string;
  businessPhone: string;
  businessWhatsApp: string;
  businessEmail: string;
  businessAddress: string;
  businessWebsite: string;
  gstin: string;
  companyPan: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankUpi: string;
  referralRewardAmount: number;
  newCustomerDiscount: number;
  whatsappReminderEnabled: boolean;
  /** Days before due date when a reminder becomes DUE / eligible to send. */
  reminderLeadDays: number;
  /** Default cadence for pending-payment reminders. */
  reminderPaymentFrequency: SchedulableReminderFrequency;
  /** Default cadence per service category (high-end stays CUSTOM month lists). */
  reminderCategoryFrequencies: ReminderCategoryFrequencies;
  /** Staff reward / incentive % keyed by Service Management category id. */
  rewardCategoryIncentivePercents: RewardCategoryIncentivePercents;
  /** Fallback mechanic incentive % when a category has no rate. */
  defaultMechanicIncentivePercent: number;
  /** Fallback incentive % for high-end services without a category rate. */
  highEndIncentivePercent: number;
  /** Cap on incentive amount per job (₹). */
  incentiveCapPerJob: number;
  /** Company-wide accent (#RRGGBB). Drives --primary / sidebar active. */
  brandPrimary: string;
  /** Login page left-panel background image URL (optional). */
  loginBackgroundImage: string;
  /** Login hero copy (empty heading/description → product defaults at display time). */
  loginHeroHeading: string;
  loginHeroDescription: string;
  /**
   * Feature highlights on the login hero.
   * Empty array hides the block; bootstrap omit uses {@link DEFAULT_LOGIN_HERO_FEATURES}.
   */
  loginHeroFeatures: LoginHeroFeature[];
}

export const DEFAULT_SERIALIZABLE_APP_SETTINGS: SerializableAppSettings = {
  gstRegistrationStatus: "REGISTERED",
  businessName: "MY DETAIL OS",
  businessLogo: "",
  businessTagline: "Car Wash & Detailing Studio",
  businessPhone: "+91-80-4123-4567",
  businessWhatsApp: "+91-80-4123-4567",
  businessEmail: "hello@mydetailos.com",
  businessAddress: "80 Feet Road, Koramangala 4th Block, Bengaluru 560034",
  businessWebsite: "www.mydetailos.com",
  gstin: "29AABCT1234F1ZP",
  companyPan: "[Your PAN]",
  bankName: "[Your Bank Name]",
  bankBranch: "[Branch Name]",
  bankAccountNumber: "[Account Number]",
  bankIfsc: "[IFSC Code]",
  bankUpi: "[UPI ID or Number]",
  referralRewardAmount: 500,
  newCustomerDiscount: 200,
  whatsappReminderEnabled: true,
  reminderLeadDays: 7,
  reminderPaymentFrequency: "MONTHLY",
  reminderCategoryFrequencies: { ...DEFAULT_REMINDER_CATEGORY_FREQUENCIES },
  rewardCategoryIncentivePercents: {},
  defaultMechanicIncentivePercent: 0,
  highEndIncentivePercent: 0,
  incentiveCapPerJob: 5000,
  brandPrimary: DEFAULT_BRAND_PRIMARY,
  loginBackgroundImage: "",
  loginHeroHeading: "",
  loginHeroDescription: "",
  loginHeroFeatures: [...DEFAULT_LOGIN_HERO_FEATURES],
};

function normalizeCategoryFrequencies(raw: unknown): ReminderCategoryFrequencies {
  const base: ReminderCategoryFrequencies = { ...DEFAULT_REMINDER_CATEGORY_FREQUENCIES };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const [key, v] of Object.entries(o)) {
    if (typeof v === "string" && key.trim()) {
      base[key] = parseReminderFrequency(v, base[key] ?? "MONTHLY");
    }
  }
  return base;
}

function sliceSerializable(s: SerializableAppSettings): SerializableAppSettings {
  return {
    gstRegistrationStatus: s.gstRegistrationStatus,
    businessName: s.businessName,
    businessLogo: s.businessLogo,
    businessTagline: s.businessTagline,
    businessPhone: s.businessPhone,
    businessWhatsApp: s.businessWhatsApp,
    businessEmail: s.businessEmail,
    businessAddress: s.businessAddress,
    businessWebsite: s.businessWebsite,
    gstin: s.gstin,
    companyPan: s.companyPan,
    bankName: s.bankName,
    bankBranch: s.bankBranch,
    bankAccountNumber: s.bankAccountNumber,
    bankIfsc: s.bankIfsc,
    bankUpi: s.bankUpi,
    referralRewardAmount: s.referralRewardAmount,
    newCustomerDiscount: s.newCustomerDiscount,
    whatsappReminderEnabled: s.whatsappReminderEnabled,
    reminderLeadDays: s.reminderLeadDays,
    reminderPaymentFrequency: s.reminderPaymentFrequency,
    reminderCategoryFrequencies: { ...s.reminderCategoryFrequencies },
    rewardCategoryIncentivePercents: { ...s.rewardCategoryIncentivePercents },
    defaultMechanicIncentivePercent: s.defaultMechanicIncentivePercent,
    highEndIncentivePercent: s.highEndIncentivePercent,
    incentiveCapPerJob: s.incentiveCapPerJob,
    brandPrimary: s.brandPrimary,
    loginBackgroundImage: s.loginBackgroundImage,
    loginHeroHeading: s.loginHeroHeading,
    loginHeroDescription: s.loginHeroDescription,
    loginHeroFeatures: s.loginHeroFeatures.slice(0, 3),
  };
}

/** Merge API payload into serializable defaults (ignores unknown keys). */
export function mergeAppSettingsPayload(raw: unknown): Partial<SerializableAppSettings> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const next: Partial<SerializableAppSettings> = {};
  const str = (k: keyof SerializableAppSettings) =>
    typeof o[k] === "string" ? (o[k] as string) : undefined;
  const num = (k: keyof SerializableAppSettings) =>
    typeof o[k] === "number" && Number.isFinite(o[k] as number)
      ? (o[k] as number)
      : undefined;
  const bool = (k: keyof SerializableAppSettings) =>
    typeof o[k] === "boolean" ? (o[k] as boolean) : undefined;

  const assignStr = (...keys: (keyof SerializableAppSettings)[]) => {
    for (const k of keys) {
      const v = str(k);
      if (v !== undefined) next[k] = v as never;
    }
  };
  assignStr(
    "gstRegistrationStatus",
    "businessName",
    "businessLogo",
    "businessTagline",
    "businessPhone",
    "businessWhatsApp",
    "businessEmail",
    "businessAddress",
    "businessWebsite",
    "gstin",
    "companyPan",
    "bankName",
    "bankBranch",
    "bankAccountNumber",
    "bankIfsc",
    "bankUpi",
    "loginHeroHeading",
    "loginHeroDescription"
  );
  if (o.gstRegistrationStatus === "REGISTERED" || o.gstRegistrationStatus === "NOT_REGISTERED") {
    next.gstRegistrationStatus = o.gstRegistrationStatus;
  }
  const rr = num("referralRewardAmount");
  if (rr !== undefined) next.referralRewardAmount = rr;
  const nd = num("newCustomerDiscount");
  if (nd !== undefined) next.newCustomerDiscount = nd;
  const wa = bool("whatsappReminderEnabled");
  if (wa !== undefined) next.whatsappReminderEnabled = wa;
  const lead = num("reminderLeadDays");
  if (lead !== undefined) next.reminderLeadDays = Math.max(0, Math.floor(lead));
  if (typeof o.reminderPaymentFrequency === "string") {
    next.reminderPaymentFrequency = parseReminderFrequency(o.reminderPaymentFrequency, "MONTHLY");
  }
  if ("reminderCategoryFrequencies" in o) {
    next.reminderCategoryFrequencies = normalizeCategoryFrequencies(o.reminderCategoryFrequencies);
  }
  if ("rewardCategoryIncentivePercents" in o) {
    next.rewardCategoryIncentivePercents = normalizeRewardCategoryIncentivePercents(
      o.rewardCategoryIncentivePercents
    );
  }
  const dmi = num("defaultMechanicIncentivePercent");
  if (dmi !== undefined) next.defaultMechanicIncentivePercent = Math.min(100, Math.max(0, dmi));
  const hei = num("highEndIncentivePercent");
  if (hei !== undefined) next.highEndIncentivePercent = Math.min(100, Math.max(0, hei));
  const cap = num("incentiveCapPerJob");
  if (cap !== undefined) next.incentiveCapPerJob = Math.max(0, cap);
  const brandRaw = str("brandPrimary");
  if (brandRaw !== undefined) {
    next.brandPrimary = normalizeHex(brandRaw) ?? DEFAULT_BRAND_PRIMARY;
  }
  const loginBg = str("loginBackgroundImage");
  if (loginBg !== undefined) next.loginBackgroundImage = loginBg;
  if ("loginHeroFeatures" in o) {
    if (o.loginHeroFeatures === null || o.loginHeroFeatures === undefined) {
      /* leave unset so store defaults apply */
    } else {
      next.loginHeroFeatures = normalizeLoginHeroFeatures(o.loginHeroFeatures);
    }
  }
  return next;
}

interface SettingsState extends SerializableAppSettings {
  setBusinessProfile: (
    profile: Partial<
      Pick<
        SerializableAppSettings,
        | "gstRegistrationStatus"
        | "businessName"
        | "businessLogo"
        | "businessTagline"
        | "businessPhone"
        | "businessWhatsApp"
        | "businessEmail"
        | "businessAddress"
        | "businessWebsite"
        | "gstin"
        | "companyPan"
        | "bankName"
        | "bankBranch"
        | "bankAccountNumber"
        | "bankIfsc"
        | "bankUpi"
        | "loginBackgroundImage"
        | "loginHeroHeading"
        | "loginHeroDescription"
        | "loginHeroFeatures"
      >
    >
  ) => void;
  setReferralRewardAmount: (amount: number) => void;
  setNewCustomerDiscount: (amount: number) => void;
  setWhatsappReminderEnabled: (enabled: boolean) => void;
  setReminderLeadDays: (days: number) => void;
  setReminderPaymentFrequency: (frequency: SchedulableReminderFrequency) => void;
  setReminderCategoryFrequency: (
    categoryId: string,
    frequency: SchedulableReminderFrequency
  ) => void;
  setReminderCategoryFrequencies: (map: ReminderCategoryFrequencies) => void;
  setRewardCategoryIncentivePercent: (categoryId: string, percent: number) => void;
  setDefaultMechanicIncentivePercent: (percent: number) => void;
  setHighEndIncentivePercent: (percent: number) => void;
  setIncentiveCapPerJob: (amount: number) => void;
  setBrandPrimary: (hex: string) => boolean;
  /** Live preview while editing brand color in settings (not persisted). */
  brandPrimaryPreview: string | null;
  setBrandPrimaryPreview: (hex: string | null) => void;
  patchFromBootstrap: (patch: Partial<SerializableAppSettings>) => void;
}

let settingsSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAppSettingsSync(get: () => SettingsState): void {
  if (settingsSyncTimer) clearTimeout(settingsSyncTimer);
  settingsSyncTimer = setTimeout(() => {
    settingsSyncTimer = null;
    const s = get();
    void putSingletonDocument("appSettings", sliceSerializable(s)).catch((err) => {
      if (process.env.NODE_ENV !== "production") console.warn(err);
    });
  }, 450);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SERIALIZABLE_APP_SETTINGS,
  brandPrimaryPreview: null,

  patchFromBootstrap: (patch) => set((state) => ({ ...state, ...patch })),

  setBusinessProfile: (profile) => {
    set((state) => ({ ...state, ...profile }));
    scheduleAppSettingsSync(get);
  },

  setReferralRewardAmount: (referralRewardAmount) => {
    set({ referralRewardAmount });
    scheduleAppSettingsSync(get);
  },

  setNewCustomerDiscount: (newCustomerDiscount) => {
    set({ newCustomerDiscount });
    scheduleAppSettingsSync(get);
  },

  setWhatsappReminderEnabled: (whatsappReminderEnabled) => {
    set({ whatsappReminderEnabled });
    scheduleAppSettingsSync(get);
  },

  setReminderLeadDays: (days) => {
    set({ reminderLeadDays: Math.max(0, Math.floor(days)) });
    scheduleAppSettingsSync(get);
  },

  setReminderPaymentFrequency: (reminderPaymentFrequency) => {
    set({ reminderPaymentFrequency });
    scheduleAppSettingsSync(get);
  },

  setReminderCategoryFrequency: (categoryId, frequency) => {
    const id = categoryId.trim();
    if (!id) return;
    set((state) => ({
      reminderCategoryFrequencies: {
        ...state.reminderCategoryFrequencies,
        [id]: frequency,
      },
    }));
    scheduleAppSettingsSync(get);
  },

  setReminderCategoryFrequencies: (reminderCategoryFrequencies) => {
    set({
      reminderCategoryFrequencies: normalizeCategoryFrequencies(reminderCategoryFrequencies),
    });
    scheduleAppSettingsSync(get);
  },

  setRewardCategoryIncentivePercent: (categoryId, percent) => {
    const id = categoryId.trim();
    if (!id) return;
    const n = Math.min(100, Math.max(0, Math.round(Number(percent) * 100) / 100));
    if (!Number.isFinite(n)) return;
    set((state) => ({
      rewardCategoryIncentivePercents: {
        ...state.rewardCategoryIncentivePercents,
        [id]: n,
      },
    }));
    scheduleAppSettingsSync(get);
  },

  setDefaultMechanicIncentivePercent: (percent) => {
    const n = Math.min(100, Math.max(0, Math.round(Number(percent) * 100) / 100));
    if (!Number.isFinite(n)) return;
    set({ defaultMechanicIncentivePercent: n });
    scheduleAppSettingsSync(get);
  },

  setHighEndIncentivePercent: (percent) => {
    const n = Math.min(100, Math.max(0, Math.round(Number(percent) * 100) / 100));
    if (!Number.isFinite(n)) return;
    set({ highEndIncentivePercent: n });
    scheduleAppSettingsSync(get);
  },

  setIncentiveCapPerJob: (amount) => {
    const n = Math.max(0, Math.round(Number(amount) * 100) / 100);
    if (!Number.isFinite(n)) return;
    set({ incentiveCapPerJob: n });
    scheduleAppSettingsSync(get);
  },

  setBrandPrimary: (hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return false;
    set({ brandPrimary: normalized, brandPrimaryPreview: null });
    scheduleAppSettingsSync(get);
    return true;
  },

  setBrandPrimaryPreview: (hex) => {
    if (hex === null) {
      set({ brandPrimaryPreview: null });
      return;
    }
    const normalized = normalizeHex(hex);
    if (!normalized) return;
    set({ brandPrimaryPreview: normalized });
  },
}));

/** Resolve frequency for a service category from settings (with defaults). */
export function getCategoryReminderFrequency(
  settings: Pick<SerializableAppSettings, "reminderCategoryFrequencies">,
  categoryIdOrType: string
): SchedulableReminderFrequency {
  const key = categoryIdOrType.trim();
  if (!key) return "MONTHLY";
  return (
    settings.reminderCategoryFrequencies[key] ??
    DEFAULT_REMINDER_CATEGORY_FREQUENCIES[key] ??
    "MONTHLY"
  );
}
