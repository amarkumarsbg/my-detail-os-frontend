/** Short-lived flag so dashboard layout can skip a duplicate `/api/auth/me` after SSO. */

const HANDOFF_KEY = "mdos-auth-handoff-at";
const HANDOFF_TTL_MS = 30_000;

/** Call after a successful `/login` handoff `/me` before navigating to the app shell. */
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
