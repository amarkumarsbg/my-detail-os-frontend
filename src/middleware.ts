import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isReservedSlug, looksLikeFileSegment } from "@/lib/tenant";

/**
 * Tenant URL rewrite: `/{orgSlug}/dashboard` → `/dashboard` (internal),
 * while keeping the browser URL. Sets `x-org-slug` for server consumers.
 *
 * Reserved first segments (login, saas-admin, customer, api, _next, …)
 * and file-like segments pass through unchanged.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (!first) {
    return NextResponse.next();
  }

  if (looksLikeFileSegment(first) || isReservedSlug(first)) {
    return NextResponse.next();
  }

  const rest = segments.slice(1).join("/");
  const rewritePathname = rest ? `/${rest}` : "/";

  const url = request.nextUrl.clone();
  url.pathname = rewritePathname;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-org-slug", first.toLowerCase());

  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all pathnames except Next internals and common static assets.
     * Org-slug rewriting still applies to app routes under /{slug}/….
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|css|js|map)$).*)",
  ],
};
