"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Mail, Phone, Unplug } from "lucide-react";
import { buildApiUrl } from "@/lib/api-base";
import { goToMarketingLogin } from "@/lib/marketing-site";
import {
  formatSupportPhoneDisplay,
  resolveSupportPhone,
  toTelHref,
} from "@/lib/plan-limits";
import { useOrganizationStore } from "@/store/organization-store";
import { useAppBootstrapStore } from "@/store/app-bootstrap-store";
import { useTenantSlug } from "@/components/tenant/tenant-context";
import { BootOverlay } from "@/components/shared/boot-overlay";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@mydetailos.com";

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
  contact,
  icon = "default",
}: {
  title: string;
  description: string;
  contact?: {
    orgName: string;
    email: string;
    phone: string;
  };
  icon?: "default" | "suspended";
}) {
  const mailto = contact
    ? `mailto:${contact.email}?subject=${encodeURIComponent(
        `Help restoring access — ${contact.orgName}`
      )}`
    : null;
  const telHref = contact?.phone ? toTelHref(contact.phone) : "";
  const phoneDisplay = contact?.phone ? formatSupportPhoneDisplay(contact.phone) : "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="space-y-3">
          <div className="flex justify-center">
            <span
              className={
                icon === "suspended"
                  ? "flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 ring-1 ring-rose-100"
                  : "flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
              }
              aria-hidden
            >
              <Unplug className="h-7 w-7" strokeWidth={1.75} />
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {contact && (
          <div className="rounded-xl border border-border bg-card px-4 py-4 text-left space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contact support
            </p>
            <div className="space-y-2">
              <a
                href={mailto || undefined}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-accent"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Email</span>
                  <span className="block truncate font-medium">{contact.email}</span>
                </span>
              </a>
              {telHref && phoneDisplay ? (
                <a
                  href={telHref}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">Phone</span>
                    <span className="block font-medium">{phoneDisplay}</span>
                  </span>
                </a>
              ) : null}
            </div>
          </div>
        )}
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
        if (!org.isActive || org.subscriptionStatus === "CANCELLED") {
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
    return <BootOverlay />;
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
    const suspended = state.org.subscriptionStatus === "CANCELLED";
    const supportPhone = resolveSupportPhone(entitlement);
    return (
      <FriendlyMessage
        title={suspended ? `${state.org.name} is suspended` : `${state.org.name} is inactive`}
        description={
          suspended
            ? "This workshop subscription has been suspended. Reach out to My Detail OS support to restore access."
            : "This workshop account is currently inactive. Reach out to My Detail OS support for help."
        }
        icon="suspended"
        contact={{
          orgName: state.org.name,
          email: SUPPORT_EMAIL,
          phone: supportPhone,
        }}
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
    return <BootOverlay />;
  }

  return <>{children}</>;
}
