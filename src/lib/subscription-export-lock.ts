import type { OrganizationEntitlement, SubscriptionPaymentStatus } from "@/types";

/** Days before expiry when export/download is locked until renew. */
export const EXPORT_LOCK_DAYS_BEFORE_EXPIRY = 30;

export type GraceOrLockStatus = "OK" | "EXPORT_LOCKED" | "EXPIRED";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysUntilExpiry(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): number | null {
  if (!expiresAt) return null;
  const end = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);
}

export function graceOrLockStatus(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): GraceOrLockStatus {
  const days = daysUntilExpiry(expiresAt, now);
  if (days === null) return "OK";
  if (days < 0) return "EXPIRED";
  if (days <= EXPORT_LOCK_DAYS_BEFORE_EXPIRY) return "EXPORT_LOCKED";
  return "OK";
}

export function isExportLockedFromExpiry(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  return graceOrLockStatus(expiresAt, now) !== "OK";
}

export function isExportLocked(
  entitlement: OrganizationEntitlement | null | undefined,
  now: Date = new Date()
): boolean {
  if (!entitlement) return false;
  if (typeof entitlement.subscription.exportLocked === "boolean") {
    return entitlement.subscription.exportLocked;
  }
  if (typeof entitlement.canExportData === "boolean") {
    return !entitlement.canExportData;
  }
  return isExportLockedFromExpiry(
    entitlement.subscription.expiresAt ?? entitlement.subscription.currentPeriodEnd,
    now
  );
}

export function canExportData(
  entitlement: OrganizationEntitlement | null | undefined,
  now: Date = new Date()
): boolean {
  return !isExportLocked(entitlement, now);
}

export function termLabelFromMonths(termMonths: number): string {
  const years = termMonths / 12;
  if (Number.isInteger(years) && years >= 1) {
    return years === 1 ? "1 year" : `${years} years`;
  }
  if (termMonths === 1) return "1 month";
  return `${termMonths} months`;
}

export function formatPaymentStatus(status: SubscriptionPaymentStatus | string | null | undefined): string {
  if (!status) return "—";
  switch (status) {
    case "PAID":
      return "Paid";
    case "PENDING":
      return "Pending";
    case "PROCESSING":
      return "Processing";
    case "FAILED":
      return "Failed";
    default:
      return String(status);
  }
}
