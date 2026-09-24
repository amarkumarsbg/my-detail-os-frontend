/**
 * Public marketing website (MY DETAIL OS).
 * Staff login / signup / logout land here — not on the workshop app.
 * Override with NEXT_PUBLIC_MARKETING_SITE_URL when needed.
 *
 * Production default uses the Vercel marketing deployment so logout/login
 * keep working when custom domains (e.g. mydetailos.com) are blocked by
 * corporate filters or not yet live.
 */

/** Reachable public marketing origin used for demos / Vercel production. */
const DEFAULT_PRODUCTION_MARKETING_URL =
  "https://prime-detailers-website.vercel.app";

function trimSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export function marketingSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim();
  if (fromEnv) return trimSlash(fromEnv);
  // Local default matches the marketing site port used in this monorepo setup.
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
