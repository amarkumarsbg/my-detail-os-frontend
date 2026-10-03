"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, X } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { useTenantPath } from "@/components/tenant/tenant-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StudioBanner = {
  id: string;
  title: string;
  body: string;
  audience: "TRIAL" | "ACTIVE" | "ALL";
  ctaLabel: string;
  ctaUrl: string;
};

const DISMISS_KEY = "mydetailos_dismissed_banners";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function MarketingBanners() {
  const router = useRouter();
  const tenantHref = useTenantPath();
  const [banners, setBanners] = useState<StudioBanner[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());

  const load = useCallback(() => {
    void apiGet<{ banners: StudioBanner[] }>("/api/organization/banners")
      .then((data) => setBanners(data.banners ?? []))
      .catch(() => setBanners([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeDismissed(next);
      return next;
    });
  }

  function onCta(banner: StudioBanner) {
    const url = banner.ctaUrl.trim();
    if (!url) {
      window.dispatchEvent(new Event("subscription:open-renew"));
      return;
    }
    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const path = url.startsWith("/") ? url : `/${url}`;
    router.push(tenantHref(path));
  }

  const visible = banners.filter((b) => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-2.5 pt-2 sm:px-3 md:px-0">
      {visible.map((b) => (
        <div
          key={b.id}
          className={cn(
            "relative flex flex-col gap-2 rounded-lg border border-teal-200/90 bg-teal-50/80 px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between",
            "border-l-[3px] border-l-[#50B0A0] dark:border-teal-900/50 dark:bg-teal-950/30"
          )}
        >
          <div className="flex min-w-0 items-start gap-2.5 pr-7 sm:pr-0">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#50B0A0]/15 text-[#2F7A6E]">
              <Megaphone className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold text-teal-950 dark:text-teal-50">{b.title}</p>
              {b.body ? (
                <p className="mt-0.5 text-[11px] text-teal-900/75 dark:text-teal-100/70">{b.body}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            <Button
              type="button"
              size="sm"
              className="h-8 bg-[#50B0A0] px-3 text-xs hover:bg-[#459B8C]"
              onClick={() => onCta(b)}
            >
              {b.ctaLabel || "Upgrade"}
            </Button>
            <button
              type="button"
              aria-label="Dismiss banner"
              onClick={() => dismiss(b.id)}
              className="absolute right-2 top-2 rounded-md p-1 text-teal-800/50 hover:bg-teal-100 hover:text-teal-900 sm:static dark:hover:bg-teal-900/40"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
