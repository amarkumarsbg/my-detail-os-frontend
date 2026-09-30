"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { buildApiUrl } from "@/lib/api-base";
import { markAuthHandoffFresh } from "@/lib/auth-handoff";
import { goToMarketingLogin } from "@/lib/marketing-site";
import { parseOrgSlugFromPathname, tenantPath } from "@/lib/tenant";
import { BootOverlay } from "@/components/shared/boot-overlay";
import type { Branch, User } from "@/types";

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

type MeBody = {
  data?: { user: User; branch: Branch | null } | null;
  error?: { message?: string } | null;
};

type OrgBody = {
  data?: { id: string; slug: string; isActive: boolean } | null;
};

function LoginHandoffPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const applyAuthPayload = useAuthStore((s) => s.applyAuthPayload);
  const [error, setError] = useState<string | null>(null);

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
        const mePromise = fetch(buildApiUrl("/api/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }).then(async (res) => {
          const body = (await res.json()) as MeBody;
          return { res, body };
        });

        const orgPromise = orgSlug
          ? fetch(
              buildApiUrl(
                `/api/public/organizations/by-slug/${encodeURIComponent(orgSlug)}`
              ),
              { cache: "no-store" }
            ).then(async (res) => {
              const body = (await res.json()) as OrgBody;
              return { res, body };
            })
          : Promise.resolve(null);

        const [me, org] = await Promise.all([mePromise, orgPromise]);
        if (cancelled) return;

        if (!me.res.ok || me.body.error || !me.body.data) {
          goToMarketingLogin();
          return;
        }

        // When landing on /{orgSlug}/login, verify JWT org matches URL tenant.
        if (orgSlug) {
          if (!org || !org.res.ok || !org.body.data) {
            goToMarketingLogin();
            return;
          }
          if (!org.body.data.isActive) {
            setError("This workshop is inactive.");
            return;
          }
          const userOrgId = me.body.data.user.organizationId;
          if (userOrgId && userOrgId !== org.body.data.id) {
            goToMarketingLogin();
            return;
          }
        }

        applyAuthPayload({
          accessToken: token,
          user: me.body.data.user,
          branch: me.body.data.branch ?? null,
        });
        markAuthHandoffFresh();

        const mustChange = me.body.data.user.mustChangePassword === true;
        const role = me.body.data.user.role;
        let dest = next;
        if (mustChange) dest = "/change-password";
        else if (role === "PLATFORM_OWNER") dest = "/saas-admin/organizations";
        else if (role === "CUSTOMER") dest = "/customer/dashboard";

        // Keep tenant prefix for staff/customer destinations (not saas-admin).
        if (role !== "PLATFORM_OWNER") {
          dest = tenantPath(orgSlug, dest);
        }

        // Soft nav — avoid a second full document load (biggest remaining prod delay).
        // Strip hash so the access token is not left in the address bar / history.
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`
        );
        router.replace(dest);
      } catch {
        if (!cancelled) {
          goToMarketingLogin();
        }
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
