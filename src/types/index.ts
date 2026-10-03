export type PlanCode = "STARTER" | "GROWTH" | "BUSINESS" | "ENTERPRISE" | "CUSTOM";

export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "EXPIRED" | "CANCELLED" | "TRIAL";

export type SubscriptionPaymentStatus = "PAID" | "PENDING" | "PROCESSING" | "FAILED";

export type GraceOrLockStatus = "OK" | "EXPORT_LOCKED" | "EXPIRED";

export type PlanLimits = {
  maxBranches: number | null;
  maxStaff?: number | null;
  maxCustomers?: number | null;
};

export type OrganizationEntitlement = {
  organization: {
    id: string;
    name: string;
    slug: string | null;
    shareReferralCode?: string | null;
    referralWalletPoints?: number;
  };
  subscription: {
    planCode: PlanCode;
    planName: string;
    status: SubscriptionStatus;
    limits: PlanLimits;
    maxBranchesOverride: number | null;
    effectiveMaxBranches: number | null;
    maxUsersOverride: number | null;
    effectiveMaxUsers: number | null;
    contactUsUrl: string | null;
    contactPhone: string | null;
    upgradeUrl: string | null;
    currentPeriodEnd: string | null;
    termMonths?: number;
    startsAt?: string | null;
    expiresAt?: string | null;
    paymentStatus?: SubscriptionPaymentStatus;
    lastPaymentTxnId?: string | null;
    daysRemaining?: number | null;
    graceOrLock?: GraceOrLockStatus;
    exportLocked?: boolean;
  };
  usage: { branchesUsed: number; usersUsed?: number };
  canCreateBranch: boolean;
  canExportData?: boolean;
};

export type SubscriptionPaymentRow = {
  id: string;
  amount: number | null;
  currency: string;
  status: SubscriptionPaymentStatus;
  txnReference: string | null;
  method: string | null;
  notes: string | null;
  recordedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export type SubscriptionBillRow = {
  id: string;
  billNumber: string;
  planName: string;
  termMonths: number;
  termLabel: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  extraBranchCost: number;
  extraUserCost: number;
  onboardingFee: number;
  referralDiscount: number;
  gstPercent: number;
  gstAmount: number;
  paymentStatus: SubscriptionPaymentStatus | null;
  txnReference: string | null;
  amount: number | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
  organizationName?: string;
};

export type SubscriptionPricingBreakdown = {
  planCode: PlanCode;
  planName: string;
  termMonths: number;
  termLabel: string;
  extraBranches: number;
  extraUsers: number;
  baseAmount: number;
  extraBranchCost: number;
  extraUserCost: number;
  onboardingFee: number;
  onboardingApplied: boolean;
  referralCode: string | null;
  referralDiscount: number;
  referralApplied: boolean;
  referralEligible: boolean;
  referralValidationMessage: string | null;
  referrerOrganizationId?: string | null;
  gstPercent: number;
  gstAmount: number;
  subTotalBeforeTax: number;
  finalAmount: number;
  includedBranches: number | null;
  includedUsers: number | null;
  finalAllowedBranches: number | null;
  finalAllowedUsers: number | null;
  currency: string;
  isFirstSubscription: boolean;
};

/** Mid-cycle capacity purchase (extras + GST only). */
export type SubscriptionAddOnBreakdown = {
  kind: "ADDON";
  planCode: PlanCode;
  planName: string;
  extraBranches: number;
  extraUsers: number;
  extraBranchCost: number;
  extraUserCost: number;
  gstPercent: number;
  gstAmount: number;
  subTotalBeforeTax: number;
  finalAmount: number;
  previousAllowedBranches: number | null;
  previousAllowedUsers: number | null;
  finalAllowedBranches: number | null;
  finalAllowedUsers: number | null;
  currency: string;
  expiresAt: string | null;
};

export type SubscriptionRenewalHistoryRow = {
  billId: string;
  billNumber: string;
  previousExpiry: string;
  newExpiry: string;
  termMonths: number;
  termLabel: string;
  amount: number;
  gstAmount: number;
  paymentStatus: SubscriptionPaymentStatus | null;
  txnReference: string | null;
  renewalDate: string;
};

export * from "./auth";
export * from "./customer";
export * from "./vehicle";
export * from "./service";
export * from "./job-card";
export * from "./billing";
export * from "./appointment";
export * from "./inventory";
export * from "./expense";
export * from "./hr";
export * from "./ops";
export * from "./activity";
export * from "./dashboard";
export * from "./party";
export * from "./pagination";
