/** SSO handoff helpers: hash token → session, skip duplicate `/me` after landing. */

import { buildApiUrl } from "@/lib/api-base";
import { useAuthStore } from "@/store/auth-store";
import type { Branch, User } from "@/types";

const HANDOFF_KEY = "mdos-auth-handoff-at";
const HANDOFF_TTL_MS = 30_000;

/** Call after a successful handoff `/me` before the app shell continues. */
export function markAuthHandoffFresh(): void {
  try {
    sessionStorage.setItem(HANDOFF_KEY, String(Date.now()));
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * Returns true once if handoff completed within TTL, then clears the flag.
 * Used by `ensureValidSession` to skip an immediate second `/me`.
 */
export function consumeFreshAuthHandoff(): boolean {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(HANDOFF_KEY);
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < HANDOFF_TTL_MS;
  } catch {
    return false;
  }
}

export function readAccessTokenFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const fromHash = hashParams.get("accessToken");
  if (fromHash) return fromHash;
  return new URLSearchParams(window.location.search).get("accessToken");
}

/** Remove accessToken from the address bar without a navigation. */
export function clearAuthTokenFromLocation(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("accessToken");
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  hashParams.delete("accessToken");
  hashParams.delete("next");
  const nextHash = hashParams.toString();
  url.hash = nextHash ? `#${nextHash}` : "";
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

type MeBody = {
  data?: { user: User; branch: Branch | null } | null;
  error?: { message?: string } | null;
};

type OrgBody = {
  data?: { id: string; slug: string; isActive: boolean } | null;
};

export type StaffHandoffResult =
  | { ok: true; user: User; branch: Branch | null }
  | { ok: false; reason: "invalid" | "inactive" | "mismatch" };

/**
 * Validate JWT via `/me` (+ optional tenant slug check), then persist session.
 * Runs `/me` and by-slug in parallel when `orgSlug` is set.
 */
export async function completeStaffAuthHandoff(
  token: string,
  orgSlug: string | null
): Promise<StaffHandoffResult> {
  const mePromise = fetch(buildApiUrl("/api/auth/me"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).then(async (res) => {
    const body = (await res.json()) as MeBody;
    return { res, body };
  });

  const orgPromise = orgSlug
    ? fetch(
        buildApiUrl(`/api/public/organizations/by-slug/${encodeURIComponent(orgSlug)}`),
        { cache: "no-store" }
      ).then(async (res) => {
        const body = (await res.json()) as OrgBody;
        return { res, body };
      })
    : Promise.resolve(null);

  const [me, org] = await Promise.all([mePromise, orgPromise]);

  if (!me.res.ok || me.body.error || !me.body.data) {
    return { ok: false, reason: "invalid" };
  }

  if (orgSlug) {
    if (!org || !org.res.ok || !org.body.data) {
      return { ok: false, reason: "invalid" };
    }
    if (!org.body.data.isActive) {
      return { ok: false, reason: "inactive" };
    }
    const userOrgId = me.body.data.user.organizationId;
    if (userOrgId && userOrgId !== org.body.data.id) {
      return { ok: false, reason: "mismatch" };
    }
  }

  useAuthStore.getState().applyAuthPayload({
    accessToken: token,
    user: me.body.data.user,
    branch: me.body.data.branch ?? null,
  });
  markAuthHandoffFresh();
  clearAuthTokenFromLocation();

  return {
    ok: true,
    user: me.body.data.user,
    branch: me.body.data.branch ?? null,
  };
}
