"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api-base";
import { goToMarketingLogin } from "@/lib/marketing-site";
import { useOrganizationStore } from "@/store/organization-store";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";
import { useTenantSlug } from "@/components/tenant/tenant-context";

type PublicOrgBySlug = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: string | null;
};

type GuardState =
  | { status: "skip" }
  | { status: "loading" }
  | { status: "ok"; org: PublicOrgBySlug }
  | { status: "inactive"; org: PublicOrgBySlug }
  | { status: "not_found" }
  | { status: "mismatch" }
  | { status: "error"; message: string };

type TenantGuardProps = {
  children: ReactNode;
  /** Staff dashboard waits for bootstrap entitlement; customer only validates public org. */
  mode?: "staff" | "customer";
};

async function fetchOrgBySlug(slug: string): Promise<PublicOrgBySlug | null> {
  const res = await fetch(buildApiUrl(`/api/public/organizations/by-slug/${encodeURIComponent(slug)}`), {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  const body = (await res.json()) as {
    data?: PublicOrgBySlug | null;
    error?: { message?: string } | null;
  };
  if (!res.ok || body.error || !body.data) return null;
  return body.data;
}

/** Prefetch branding so subsequent screens can use cached warm data (best-effort). */
async function prefetchBranding(slug: string): Promise<void> {
  try {
    await fetch(
      buildApiUrl(`/api/public/branding?slug=${encodeURIComponent(slug)}`),
      { cache: "no-store" }
    );
  } catch {
    /* ignore */
  }
}

function FriendlyMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * When the URL includes `/{orgSlug}/…`, validate the org exists / is active
 * and (for staff) that the authenticated JWT org matches the URL tenant.
 */
export function TenantGuard({ children, mode = "staff" }: TenantGuardProps) {
  const orgSlug = useTenantSlug();
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const bootstrapReady = useAppBootstrapStore((s) => s.ready);
  const bootstrapError = useAppBootstrapStore((s) => s.error);
  const [state, setState] = useState<GuardState>(
    orgSlug ? { status: "loading" } : { status: "skip" }
  );

  useEffect(() => {
    if (!orgSlug) {
      setState({ status: "skip" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const [org] = await Promise.all([
          fetchOrgBySlug(orgSlug),
          prefetchBranding(orgSlug),
        ]);
        if (cancelled) return;
        if (!org) {
          setState({ status: "not_found" });
          return;
        }
        if (!org.isActive) {
          setState({ status: "inactive", org });
          return;
        }
        setState({ status: "ok", org });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Could not verify organization",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgSlug]);

  // Staff: after bootstrap, compare JWT entitlement org with URL slug / id.
  useEffect(() => {
    if (mode !== "staff") return;
    if (state.status !== "ok") return;
    if (!orgSlug) return;
    // Wait until bootstrap settled (ready or failed) before comparing.
    if (!bootstrapReady && !bootstrapError) return;

    const entOrg = entitlement?.organization;
    if (!entOrg) return;

    const slugMatch =
      typeof entOrg.slug === "string" &&
      entOrg.slug.trim().toLowerCase() === orgSlug.toLowerCase();
    const idMatch = entOrg.id === state.org.id;

    if (!slugMatch && !idMatch) {
      toast.error("Organization mismatch", {
        description: "You are signed in to a different workshop than this URL.",
        id: "tenant-org-mismatch",
      });
      setState({ status: "mismatch" });
      goToMarketingLogin();
    }
  }, [mode, state, orgSlug, bootstrapReady, bootstrapError, entitlement]);

  if (!orgSlug || state.status === "skip") {
    return <>{children}</>;
  }

  if (state.status === "loading") {
    return <div className="min-h-screen bg-slate-950" aria-busy="true" aria-label="Loading" />;
  }

  if (state.status === "not_found") {
    return (
      <FriendlyMessage
        title="Workshop not found"
        description="This organization link is invalid or no longer exists. Check the URL or contact your administrator."
      />
    );
  }

  if (state.status === "inactive") {
    return (
      <FriendlyMessage
        title={`${state.org.name} is inactive`}
        description="This workshop account is currently inactive. Please contact support or your administrator for help."
      />
    );
  }

  if (state.status === "mismatch") {
    return (
      <FriendlyMessage
        title="Wrong organization"
        description="Your session belongs to a different workshop. Redirecting to sign in…"
      />
    );
  }

  if (state.status === "error") {
    return (
      <FriendlyMessage
        title="Could not load workshop"
        description={state.message}
      />
    );
  }

  // Staff: wait for bootstrap to settle so mismatch redirect can run
  // without flashing wrong-org content (still render if bootstrap failed).
  if (mode === "staff" && !bootstrapReady && !bootstrapError) {
    return <div className="min-h-screen bg-slate-950" aria-busy="true" aria-label="Loading" />;
  }

  return <>{children}</>;
}
