import { useOrganizationStore } from "@/store/organization-store";
import { useSettingsStore } from "@/store/settings-store";

/** Platform / seed defaults — not a real workshop trade name. */
const PLATFORM_DEFAULT_BUSINESS_NAMES = new Set([
  "my detail os",
  "prime detailer",
]);

/**
 * Workshop name for customer-facing copy (WhatsApp, SMS, etc.).
 * Prefers branding `businessName` when customized; otherwise organization.name
 * so orgs without appSettings don't show the platform brand.
 */
export function resolveWorkshopDisplayName(opts?: {
  businessName?: string | null;
  organizationName?: string | null;
}): string {
  const fromSettings =
    (opts?.businessName ?? useSettingsStore.getState().businessName)?.trim() || "";
  const fromOrg =
    (
      opts?.organizationName ??
      useOrganizationStore.getState().entitlement?.organization?.name
    )?.trim() || "";

  if (
    fromSettings &&
    !PLATFORM_DEFAULT_BUSINESS_NAMES.has(fromSettings.toLowerCase())
  ) {
    return fromSettings;
  }
  return fromOrg || fromSettings || "MY DETAIL OS";
}
