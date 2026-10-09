"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import {
  applyBrandCssVars,
  applyBrandFavicon,
  DEFAULT_BRAND_PRIMARY,
  normalizeHex,
} from "@/lib/brand-color";
import { useSettingsStore } from "@/store/settings-store";

const BRAND_FAVICON_CACHE_KEY = "prime-brand-primary";

/**
 * Keeps CSS primary / sidebar-active tokens and favicon in sync with company brandPrimary.
 * Mount once under ThemeProvider (root layout).
 * Re-applies a lifted brand fill when dark mode is active so accents stay vivid.
 */
export function BrandThemeApplier() {
  const brandPrimary = useSettingsStore((s) => s.brandPrimary);
  const brandPrimaryPreview = useSettingsStore((s) => s.brandPrimaryPreview);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const hex =
      normalizeHex(brandPrimaryPreview ?? brandPrimary) ?? DEFAULT_BRAND_PRIMARY;
    const isDark = resolvedTheme === "dark";
    applyBrandCssVars(hex, document.documentElement, { isDark });
    applyBrandFavicon(hex);
    try {
      if (!brandPrimaryPreview) {
        localStorage.setItem(BRAND_FAVICON_CACHE_KEY, hex);
      }
    } catch {
      /* ignore */
    }
  }, [brandPrimary, brandPrimaryPreview, resolvedTheme]);

  return null;
}

export { BRAND_FAVICON_CACHE_KEY };
