import type { OrganizationEntitlement } from "@/types";
import { canExportData, isExportLocked } from "@/lib/subscription-export-lock";

export function isUnlimitedBranches(max: number | null | undefined): boolean {
  return max === null;
}

export function canCreateBranchFromEntitlement(
  entitlement: OrganizationEntitlement | null | undefined
): boolean {
  if (!entitlement) return false;
  return entitlement.canCreateBranch;
}

export function branchLimitLabel(max: number | null | undefined): string {
  if (max === null || max === undefined) return "Unlimited";
  return String(max);
}

export function isAtOrOverBranchLimit(
  entitlement: OrganizationEntitlement | null | undefined
): boolean {
  if (!entitlement) return true;
  const max = entitlement.subscription.effectiveMaxBranches;
  if (max === null || max === undefined) return false;
  return entitlement.usage.branchesUsed >= max;
}

export function canExportDataFromEntitlement(
  entitlement: OrganizationEntitlement | null | undefined
): boolean {
  return canExportData(entitlement);
}

export function isExportLockedFromEntitlement(
  entitlement: OrganizationEntitlement | null | undefined
): boolean {
  return isExportLocked(entitlement);
}

export function resolveContactUsUrl(entitlement: OrganizationEntitlement | null | undefined): string {
  return (
    entitlement?.subscription.contactUsUrl ||
    process.env.NEXT_PUBLIC_CONTACT_US_URL ||
    "mailto:support@mydetailos.com?subject=Branch%20limit%20help"
  );
}

export function resolveSupportPhone(
  entitlement: OrganizationEntitlement | null | undefined
): string {
  return (
    entitlement?.subscription.contactPhone?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() ||
    "+919876543210"
  );
}

/** Digits for tel: href; keeps leading + for international dial. */
export function toTelHref(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `tel:+${digits}` : `tel:${digits}`;
}

export function formatSupportPhoneDisplay(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return trimmed;
}

export function resolveUpgradeUrl(entitlement: OrganizationEntitlement | null | undefined): string {
  return (
    entitlement?.subscription.upgradeUrl ||
    process.env.NEXT_PUBLIC_UPGRADE_URL ||
    "mailto:support@mydetailos.com?subject=Upgrade%20plan%20request"
  );
}

export function isMailtoUrl(url: string): boolean {
  return /^mailto:/i.test(url.trim());
}

/** Docs placeholders that look “broken” in the browser (blank mailto tab / example.com). */
export function isPlaceholderPlanUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return true;
  if (u.includes("example.com")) return true;
  if (u === "mailto:sales@example.com" || u.startsWith("mailto:sales@example.com?")) return true;
  return false;
}

export function planCtaOpenMode(url: string): "mailto" | "external" | "placeholder" {
  if (isPlaceholderPlanUrl(url)) return "placeholder";
  if (isMailtoUrl(url)) return "mailto";
  return "external";
}
