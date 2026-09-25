/**
 * Route prefix → domain resources to load into Zustand.
 * Keep packs coarse so pages keep working without per-page rewrites.
 */

import { stripOrgSlugFromPath } from "@/lib/tenant";

export type DomainResource =
  | "customers"
  | "vehicles"
  | "staff"
  | "staffDirectory"
  | "jobCards"
  | "invoices"
  | "quotations"
  | "appointments"
  | "expenses"
  | "activityLogs"
  | "communications"
  | "serviceReminders"
  | "walletTransactions"
  | "serviceCatalog"
  | "parts"
  | "stockMovements"
  | "productPurchases"
  | "branchStocks"
  | "stockTransfers"
  | "partCategories"
  | "followUps"
  | "serviceCategories"
  | "notifications"
  | "pickupDropRequests"
  | "dashboardStats"
  | "expenseMeta"
  | "cashBank"
  | "payroll"
  | "leave"
  | "staffRewards"
  | "membership"
  | "appSettings"
  | "referralProgram"
  | "customerRewardSettings"
  | "balanceSheetManual"
  | "highEndServices"
  | "reportSchedules"
  | "vehicleCatalog";

const DASHBOARD_CORE: DomainResource[] = [
  "jobCards",
  "invoices",
  "expenses",
  "appointments",
  "serviceReminders",
  "customers",
  "parts",
  "stockMovements",
  "dashboardStats",
  "notifications",
  "staffDirectory",
];

const OPS_CORE: DomainResource[] = [
  "jobCards",
  "customers",
  "vehicles",
  "staffDirectory",
  "serviceCatalog",
  "serviceCategories",
  "appointments",
  "invoices",
  "membership",
  "notifications",
  /** GST / tax registration — required before job card, booking, and invoice pricing. */
  "appSettings",
];

/** Longest-prefix wins. */
const ROUTE_PACKS: { prefix: string; resources: DomainResource[] }[] = [
  { prefix: "/payroll", resources: ["payroll", "staff", "staffDirectory", "staffRewards"] },
  { prefix: "/cash-bank", resources: ["cashBank", "invoices", "expenses"] },
  { prefix: "/staff", resources: ["staff", "customers", "jobCards", "staffRewards", "invoices"] },
  { prefix: "/attendance", resources: ["staffDirectory", "staff"] },
  { prefix: "/leave", resources: ["leave", "staff", "staffDirectory"] },
  { prefix: "/rewards", resources: ["staffRewards", "staff", "staffDirectory", "jobCards"] },
  {
    prefix: "/settings",
    resources: [
      "appSettings",
      "vehicleCatalog",
      "staffRewards",
      "customerRewardSettings",
      "highEndServices",
      "serviceCategories",
      "serviceCatalog",
    ],
  },
  {
    prefix: "/shared-ledger",
    resources: ["balanceSheetManual", "invoices", "expenses", "cashBank", "customers"],
  },
  {
    prefix: "/accounting",
    resources: [
      "invoices",
      "expenses",
      "cashBank",
      "jobCards",
      "customers",
      "balanceSheetManual",
      "productPurchases",
      "membership",
      "payroll",
    ],
  },
  {
    prefix: "/reports",
    resources: [
      "invoices",
      "expenses",
      "jobCards",
      "customers",
      "parts",
      "productPurchases",
      "cashBank",
      "balanceSheetManual",
      "staffDirectory",
      "staff",
      "leave",
      "payroll",
      "staffRewards",
    ],
  },
  {
    prefix: "/advanced-reports",
    resources: ["reportSchedules", "customers", "invoices", "expenses", "jobCards", "appSettings"],
  },
  { prefix: "/messages", resources: ["communications", "customers"] },
  { prefix: "/activity", resources: ["activityLogs", "jobCards", "invoices", "expenses"] },
  { prefix: "/membership", resources: ["membership", "customers", "vehicles", "serviceCatalog", "invoices", "appSettings"] },
  { prefix: "/referrals", resources: ["referralProgram", "walletTransactions", "customers"] },
  { prefix: "/reminders", resources: ["serviceReminders", "notifications", "appSettings"] },
  { prefix: "/follow-ups", resources: ["followUps", "jobCards", "notifications"] },
  {
    prefix: "/inventory",
    resources: [
      "parts",
      "stockMovements",
      "productPurchases",
      "branchStocks",
      "stockTransfers",
      "partCategories",
      "serviceCatalog",
      "expenseMeta",
      "expenses",
      "staffDirectory",
      "cashBank",
    ],
  },
  {
    prefix: "/services",
    resources: ["serviceCatalog", "serviceCategories", "highEndServices", "parts"],
  },
  { prefix: "/expenses", resources: ["expenses", "expenseMeta"] },
  { prefix: "/vendors", resources: ["expenses", "expenseMeta", "productPurchases", "parts", "invoices", "cashBank"] },
  {
    prefix: "/billing",
    resources: [
      "invoices",
      "jobCards",
      "customers",
      "vehicles",
      "membership",
      "appSettings",
      "customerRewardSettings",
      "notifications",
      "cashBank",
      "parts",
      "stockMovements",
      "branchStocks",
    ],
  },
  {
    prefix: "/quotations",
    resources: [...OPS_CORE, "quotations", "vehicleCatalog"],
  },
  { prefix: "/appointments", resources: [...OPS_CORE, "vehicleCatalog"] },
  { prefix: "/bookings", resources: [...OPS_CORE, "vehicleCatalog"] },
  { prefix: "/booking", resources: [...OPS_CORE, "vehicleCatalog", "pickupDropRequests"] },
  {
    prefix: "/pickup-drop",
    resources: [...OPS_CORE, "pickupDropRequests", "vehicleCatalog"],
  },
  {
    prefix: "/counter-sale",
    resources: [
      "parts",
      "branchStocks",
      "stockMovements",
      "partCategories",
      "customers",
      "vehicles",
      "invoices",
      "appSettings",
      "cashBank",
    ],
  },
  {
    prefix: "/job-cards",
    resources: [
      ...OPS_CORE,
      "parts",
      "stockMovements",
      "branchStocks",
      "serviceReminders",
      "cashBank",
      "pickupDropRequests",
      "customerRewardSettings",
    ],
  },
  {
    prefix: "/customers",
    resources: [
      "customers",
      "vehicles",
      "walletTransactions",
      "jobCards",
      "invoices",
      "communications",
      "membership",
      "serviceCatalog",
      "vehicleCatalog",
      "notifications",
      "cashBank",
      "appSettings",
    ],
  },
  {
    prefix: "/vehicles",
    resources: ["vehicles", "customers", "serviceReminders", "jobCards", "vehicleCatalog"],
  },
  {
    prefix: "/branches",
    resources: ["staffDirectory", "jobCards", "expenses", "pickupDropRequests", "payroll"],
  },
  { prefix: "/mechanics", resources: ["staffDirectory", "jobCards"] },
  { prefix: "/performance", resources: ["staffDirectory", "jobCards", "staffRewards"] },
  {
    prefix: "/notifications",
    resources: ["notifications", "jobCards", "invoices", "expenses", "pickupDropRequests"],
  },
  {
    prefix: "/parties",
    resources: ["customers", "invoices", "expenses", "cashBank", "appSettings"],
  },
  { prefix: "/dashboard", resources: DASHBOARD_CORE },
];

export function resourcesForPath(pathname: string): DomainResource[] {
  // Tenant URLs are `/ {orgSlug}/activity` — match packs against the app path only.
  const path = stripOrgSlugFromPath(pathname.split("?")[0] || "/");
  const matched = ROUTE_PACKS.filter(
    (p) => path === p.prefix || path.startsWith(`${p.prefix}/`)
  );
  if (matched.length === 0) {
    return [...DASHBOARD_CORE];
  }
  matched.sort((a, b) => b.prefix.length - a.prefix.length);
  return [...new Set(matched[0]!.resources)];
}
