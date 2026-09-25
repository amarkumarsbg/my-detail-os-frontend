"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
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

/** Re-check public org status without waiting for a hard refresh. */
const ORG_STATUS_POLL_MS = 10_000;

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

function isOrgBlocked(org: PublicOrgBySlug): boolean {
  return !org.isActive || org.subscriptionStatus === "CANCELLED";
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
  const pathname = usePathname();
  const entitlement = useOrganizationStore((s) => s.entitlement);
  const bootstrapReady = useAppBootstrapStore((s) => s.ready);
  const bootstrapError = useAppBootstrapStore((s) => s.error);
  const [state, setState] = useState<GuardState>(
    orgSlug ? { status: "loading" } : { status: "skip" }
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const applyOrg = useCallback((org: PublicOrgBySlug | null, soft: boolean) => {
    if (!org) {
      setState({ status: "not_found" });
      return;
    }
    if (isOrgBlocked(org)) {
      setState({ status: "inactive", org });
      return;
    }
    if (soft && stateRef.current.status === "ok" && stateRef.current.org.id === org.id) {
      setState({ status: "ok", org });
      return;
    }
    setState({ status: "ok", org });
  }, []);

  const revalidate = useCallback(
    async (opts?: { soft?: boolean; prefetch?: boolean }) => {
      const soft = opts?.soft === true;
      const slug = orgSlug;
      if (!slug) {
        setState({ status: "skip" });
        return;
      }
      if (!soft) setState({ status: "loading" });
      try {
        const tasks: Promise<unknown>[] = [fetchOrgBySlug(slug)];
        if (opts?.prefetch) tasks.push(prefetchBranding(slug));
        const [org] = (await Promise.all(tasks)) as [PublicOrgBySlug | null];
        applyOrg(org, soft);
      } catch (e) {
        if (soft && stateRef.current.status === "ok") return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Could not verify organization",
        });
      }
    },
    [orgSlug, applyOrg]
  );

  // Initial + slug change
  useEffect(() => {
    void revalidate({ soft: false, prefetch: true });
  }, [revalidate]);

  // Soft nav within the same org (SPA) — re-check without hard refresh
  useEffect(() => {
    if (!orgSlug) return;
    void revalidate({ soft: true });
  }, [pathname, orgSlug, revalidate]);

  // Tab focus / poll — catch suspend while the tab stays open
  useEffect(() => {
    if (!orgSlug) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") void revalidate({ soft: true });
    };
    document.addEventListener("visibilitychange", onVisible);

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (stateRef.current.status === "inactive") return;
      void revalidate({ soft: true });
    }, ORG_STATUS_POLL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [orgSlug, revalidate]);

  // Bootstrap entitlement can learn CANCELLED before the next public poll
  useEffect(() => {
    if (state.status !== "ok") return;
    if (entitlement?.subscription?.status !== "CANCELLED") return;
    setState({
      status: "inactive",
      org: {
        ...state.org,
        isActive: false,
        subscriptionStatus: "CANCELLED",
      },
    });
  }, [entitlement?.subscription?.status, state]);

  // Staff: after bootstrap, compare JWT entitlement org with URL slug / id.
  useEffect(() => {
    if (mode !== "staff") return;
    if (state.status !== "ok") return;
    if (!orgSlug) return;
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

  if (mode === "staff" && !bootstrapReady && !bootstrapError) {
    return <BootOverlay />;
  }

  return <>{children}</>;
}
