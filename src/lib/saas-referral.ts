"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const KEY = "mydetailos_saas_ref";

export function captureSaasReferralFromLocation(): string | null {
  if (typeof window === "undefined") return peekSaasReferral();
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get("ref") || params.get("referral") || "").trim().toUpperCase();
  if (/^[A-Z0-9-]{4,24}$/.test(raw)) {
    try {
      sessionStorage.setItem(KEY, raw);
    } catch {
      /* ignore */
    }
    return raw;
  }
  return peekSaasReferral();
}

export function peekSaasReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(KEY);
    return v && /^[A-Z0-9-]{4,24}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function CaptureSaasReferral() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    captureSaasReferralFromLocation();
  }, [pathname, search]);
  return null;
}
