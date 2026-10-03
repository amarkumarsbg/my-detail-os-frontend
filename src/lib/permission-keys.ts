/**
 * Canonical permission keys for RBAC (nav + API).
 * Keep aligned with backend/src/constants/permission-keys.ts and prisma seed.
 */
export const PERMISSION_KEYS = [
  "DASHBOARD",
  "JOB_CARDS",
  "JOB_CARD_PRICING",
  "BOOKINGS",
  "PICKUP_DROP",
  "QUOTATIONS",
  "APPOINTMENTS",
  "CUSTOMERS",
  "MEMBERSHIP",
  "VEHICLES",
  "REMINDERS",
  "FOLLOW_UPS",
  "REFERRALS",
  "OFFERS",
  "SUPPORT",
  "BILLING",
  "REPORTS",
  "CASH_BANK",
  "PARTIES",
  "SHARED_LEDGER",
  "EXPENSES",
  "VENDORS",
  "STAFF",
  "ATTENDANCE",
  "LEAVE",
  "PAYROLL",
  "STAFF_REWARDS",
  "SERVICES",
  "INVENTORY",
  "BRANCHES",
  "PERFORMANCE",
  "MECHANICS",
  "ANALYTICS",
  "ADVANCED_REPORTS",
  "ACTIVITY",
  "MESSAGES",
  "SETTINGS",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** UI labels for staff permission editor. */
export const PERMISSION_KEY_LABELS: Record<PermissionKey, string> = {
  DASHBOARD: "Dashboard",
  JOB_CARDS: "Job Cards",
  JOB_CARD_PRICING: "Job Card Pricing",
  BOOKINGS: "Bookings",
  PICKUP_DROP: "Pickup & Drop",
  QUOTATIONS: "Quotations",
  APPOINTMENTS: "Appointments",
  CUSTOMERS: "Customers",
  MEMBERSHIP: "Membership",
  VEHICLES: "Vehicles",
  REMINDERS: "Reminders",
  FOLLOW_UPS: "Follow-ups",
  REFERRALS: "Referrals",
  OFFERS: "Offers",
  SUPPORT: "Support",
  BILLING: "Billing",
  REPORTS: "Reports",
  CASH_BANK: "Cash & Bank",
  PARTIES: "Parties",
  SHARED_LEDGER: "Shared Ledger",
  EXPENSES: "Expenses",
  VENDORS: "Vendors",
  STAFF: "Users & Staff",
  ATTENDANCE: "Attendance",
  LEAVE: "Leave",
  PAYROLL: "Salary & Payroll",
  STAFF_REWARDS: "Staff Rewards",
  SERVICES: "Services",
  INVENTORY: "Inventory",
  BRANCHES: "Branch",
  PERFORMANCE: "Performance",
  MECHANICS: "Mechanics",
  ANALYTICS: "Analytics",
  ADVANCED_REPORTS: "Advanced Reports",
  ACTIVITY: "Activity Log",
  MESSAGES: "Messages Log",
  SETTINGS: "Settings",
};

export const PERMISSIONS_FOR_UI = PERMISSION_KEYS.map((key) => ({
  key,
  label: PERMISSION_KEY_LABELS[key],
}));

/**
 * Modules that expose granular Create / View / Edit toggles in the permissions UI.
 * Delete is intentionally excluded — only Admin can delete.
 */
export const GRANULAR_PERMISSION_MODULES = [
  { key: "DASHBOARD", label: "Dashboard" },
  { key: "JOB_CARDS", label: "Job Cards" },
  { key: "JOB_CARD_PRICING", label: "Job Card Pricing" },
  { key: "BOOKINGS", label: "Bookings" },
  { key: "PICKUP_DROP", label: "Pickup & Drop" },
  { key: "QUOTATIONS", label: "Quotations" },
  { key: "APPOINTMENTS", label: "Appointments" },
  { key: "CUSTOMERS", label: "Customers" },
  { key: "MEMBERSHIP", label: "Membership" },
  { key: "VEHICLES", label: "Vehicles" },
  { key: "REMINDERS", label: "Reminders" },
  { key: "FOLLOW_UPS", label: "Follow-ups" },
  { key: "REFERRALS", label: "Referrals" },
  { key: "OFFERS", label: "Offers" },
  { key: "SUPPORT", label: "Support" },
  { key: "BILLING", label: "Billing" },
  { key: "REPORTS", label: "Reports" },
  { key: "CASH_BANK", label: "Cash & Bank" },
  { key: "PARTIES", label: "Parties" },
  { key: "SHARED_LEDGER", label: "Shared Ledger" },
  { key: "EXPENSES", label: "Expenses" },
  { key: "VENDORS", label: "Vendors" },
  { key: "STAFF", label: "Users & Staff" },
  { key: "ATTENDANCE", label: "Attendance" },
  { key: "LEAVE", label: "Leave" },
  { key: "PAYROLL", label: "Salary & Payroll" },
  { key: "STAFF_REWARDS", label: "Staff Rewards" },
  { key: "SERVICES", label: "Services" },
  { key: "INVENTORY", label: "Inventory" },
  { key: "BRANCHES", label: "Branch" },
  { key: "PERFORMANCE", label: "Performance" },
  { key: "MECHANICS", label: "Mechanics" },
  { key: "ANALYTICS", label: "Analytics" },
  { key: "ADVANCED_REPORTS", label: "Advanced Reports" },
  { key: "ACTIVITY", label: "Activity Log" },
  { key: "MESSAGES", label: "Messages Log" },
  { key: "SETTINGS", label: "Settings" },
] as const;

export type GranularModuleKey = (typeof GRANULAR_PERMISSION_MODULES)[number]["key"];
export type GranularAction = "CREATE" | "VIEW" | "EDIT" | "DELETE";

/** Remaining modules shown as simple on/off checkboxes. */
export const SIMPLE_PERMISSIONS_FOR_UI = PERMISSIONS_FOR_UI.filter(
  (p) => !GRANULAR_PERMISSION_MODULES.some((m) => m.key === p.key)
);
