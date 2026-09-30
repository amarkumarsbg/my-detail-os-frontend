"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  completeStaffAuthHandoff,
  readAccessTokenFromLocation,
} from "@/lib/auth-handoff";
import { goToMarketingLogin } from "@/lib/marketing-site";
import { parseOrgSlugFromPathname, tenantPath } from "@/lib/tenant";
import { BootOverlay } from "@/components/shared/boot-overlay";

/**
 * Legacy SSO entry: /login#accessToken=…&next=/dashboard
 * Prefer marketing → /{slug}/dashboard#accessToken=… (one page load).
 * Kept so old bookmarks still work.
 */
function readNextParam(searchParams: URLSearchParams): string {
  if (typeof window === "undefined") {
    return searchParams.get("next") || "/dashboard";
  }
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hashParams.get("next") || searchParams.get("next") || "/dashboard";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readAccessTokenFromLocation() || searchParams.get("accessToken");
    const orgSlug = resolveOrgSlug(pathname);
    const next = readNextParam(searchParams);
    if (!token) {
      goToMarketingLogin();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await completeStaffAuthHandoff(token, orgSlug);
        if (cancelled) return;
        if (!result.ok) {
          if (result.reason === "inactive") {
            setError("This workshop is inactive.");
            return;
          }
          goToMarketingLogin();
          return;
        }

        const mustChange = result.user.mustChangePassword === true;
        const role = result.user.role;
        let dest = next;
        if (mustChange) dest = "/change-password";
        else if (role === "PLATFORM_OWNER") dest = "/saas-admin/organizations";
        else if (role === "CUSTOMER") dest = "/customer/dashboard";

        if (role !== "PLATFORM_OWNER") {
          dest = tenantPath(orgSlug, dest);
        }

        // Hard navigation — soft nav to dashboard was slower in prod (RSC + bundle).
        window.location.replace(dest);
      } catch {
        if (!cancelled) goToMarketingLogin();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <p className="text-sm text-slate-600">{error}</p>
      </div>
    );
  }

  return <BootOverlay />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<BootOverlay />}>
      <LoginHandoffPage />
    </Suspense>
  );
}
