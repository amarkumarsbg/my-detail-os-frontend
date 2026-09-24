"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { buildApiUrl } from "@/lib/api-base";
import { goToMarketingLogin } from "@/lib/marketing-site";
import { parseOrgSlugFromPathname, tenantPath } from "@/lib/tenant";

/**
 * Staff login UI lives on the public marketing website.
 * This route only completes SSO handoff: /login#accessToken=...&next=/dashboard
 * (or /{orgSlug}/login#… with tenant rewrite). Without a token, users are sent
 * to the marketing login page.
 */
function readHandoffFromLocation(searchParams: URLSearchParams): {
  token: string | null;
  next: string;
} {
  if (typeof window === "undefined") {
    return {
      token: searchParams.get("accessToken"),
      next: searchParams.get("next") || "/dashboard",
    };
  }
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return {
    token: hashParams.get("accessToken") || searchParams.get("accessToken"),
    next: hashParams.get("next") || searchParams.get("next") || "/dashboard",
  };
}

function resolveOrgSlug(pathname: string): string | null {
  const fromPath = parseOrgSlugFromPathname(pathname);
  if (fromPath) return fromPath;
  if (typeof window !== "undefined") {
    return parseOrgSlugFromPathname(window.location.pathname);
  }
  return null;
}

function LoginHandoffPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const applyAuthPayload = useAuthStore((s) => s.applyAuthPayload);
  const [message, setMessage] = useState("Opening your workshop…");

  useEffect(() => {
    const { token, next } = readHandoffFromLocation(searchParams);
    const orgSlug = resolveOrgSlug(pathname);
    if (!token) {
      goToMarketingLogin();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(buildApiUrl("/api/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = (await res.json()) as {
          data?: {
            user: import("@/types").User;
            branch: import("@/types").Branch | null;
          } | null;
          error?: { message?: string } | null;
        };
        if (cancelled) return;
        if (!res.ok || body.error || !body.data) {
          setMessage("Session expired. Redirecting to sign in…");
          goToMarketingLogin();
          return;
        }

        // When landing on /{orgSlug}/login, verify JWT org matches URL tenant.
        if (orgSlug) {
          const orgRes = await fetch(
            buildApiUrl(`/api/public/organizations/by-slug/${encodeURIComponent(orgSlug)}`),
            { cache: "no-store" }
          );
          const orgBody = (await orgRes.json()) as {
            data?: { id: string; slug: string; isActive: boolean } | null;
          };
          if (!orgRes.ok || !orgBody.data) {
            setMessage("Workshop not found. Redirecting…");
            goToMarketingLogin();
            return;
          }
          if (!orgBody.data.isActive) {
            setMessage("This workshop is inactive.");
            return;
          }
          const userOrgId = body.data.user.organizationId;
          if (userOrgId && userOrgId !== orgBody.data.id) {
            setMessage("You are signed in to a different workshop. Redirecting…");
            goToMarketingLogin();
            return;
          }
        }

        applyAuthPayload({
          accessToken: token,
          user: body.data.user,
          branch: body.data.branch ?? null,
        });
        const mustChange = body.data.user.mustChangePassword === true;
        const role = body.data.user.role;
        let dest = next;
        if (mustChange) dest = "/change-password";
        else if (role === "PLATFORM_OWNER") dest = "/saas-admin/organizations";
        else if (role === "CUSTOMER") dest = "/customer/dashboard";

        // Keep tenant prefix for staff/customer destinations (not saas-admin).
        if (role !== "PLATFORM_OWNER") {
          dest = tenantPath(orgSlug, dest);
        }
        window.location.replace(dest);
      } catch {
        if (!cancelled) {
          setMessage("Could not complete sign-in. Redirecting…");
          goToMarketingLogin();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-slate-50 via-white to-teal-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="h-11 w-11 rounded-full border-2 border-teal-600/30 border-t-teal-600 animate-spin" />
        <div className="space-y-1.5">
          <p className="text-lg font-semibold tracking-tight text-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">
            Staff sign-in is handled on the MY DETAIL OS website.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-11 w-11 rounded-full border-2 border-teal-600/30 border-t-teal-600 animate-spin" />
        </div>
      }
    >
      <LoginHandoffPage />
    </Suspense>
  );
}
