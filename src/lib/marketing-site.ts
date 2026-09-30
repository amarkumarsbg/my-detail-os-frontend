/**
 * Public marketing website (MY DETAIL OS).
 * Staff login / signup / logout land here — not on the workshop app.
 * Override with NEXT_PUBLIC_MARKETING_SITE_URL when needed.
 */

const DEFAULT_PRODUCTION_MARKETING_URL = "https://www.mydetailos.com";

function trimSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Resolve marketing origin.
 * Prefer env when set; otherwise production defaults to www.mydetailos.com.
 */
export function marketingSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim();
  if (fromEnv) return trimSlash(fromEnv);
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3003";
  }
  return DEFAULT_PRODUCTION_MARKETING_URL;
}

export function marketingLoginUrl(): string {
  return `${marketingSiteUrl()}/login`;
}

export function marketingSignupUrl(): string {
  return `${marketingSiteUrl()}/signup`;
}

export function marketingForgotPasswordUrl(): string {
  return `${marketingSiteUrl()}/forgot-password`;
}

export function marketingHomeUrl(): string {
  return marketingSiteUrl();
}

/** Full-page navigation to marketing login (staff auth). */
export function goToMarketingLogin(): void {
  if (typeof window === "undefined") return;
  window.location.assign(marketingLoginUrl());
}

/** Full-page navigation to marketing home (after logout). */
export function goToMarketingHome(): void {
  if (typeof window === "undefined") return;
  window.location.assign(marketingHomeUrl());
}

/** Prefer login after staff logout so users can sign back in immediately. */
export function goToMarketingAfterLogout(): void {
  goToMarketingLogin();
}
