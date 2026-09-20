/**
 * Public marketing website (prime-detailers-website).
 * Staff login / signup / logout land here — not on the workshop app.
 */

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
  return "https://www.primedetailers.com";
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
