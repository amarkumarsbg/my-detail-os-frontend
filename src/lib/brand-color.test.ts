// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  applyBrandFavicon,
  brandPrimaryForTheme,
  contrastForeground,
  DEFAULT_BRAND_PRIMARY,
  isValidHex,
  lightenHex,
  matchingBrandPresetId,
  normalizeHex,
  PLATFORM_FAVICON_HREF,
  resolveBrandCssVars,
} from "./brand-color";

describe("brand-color", () => {
  afterEach(() => {
    document.head.replaceChildren();
  });

  it("normalizes #RGB and #RRGGBB", () => {
    expect(normalizeHex("#0a9")).toBe("#00AA99");
    expect(normalizeHex("#059669")).toBe("#059669");
    expect(normalizeHex("  #3b82f6 ")).toBe("#3B82F6");
  });

  it("rejects invalid hex", () => {
    expect(isValidHex("059669")).toBe(false);
    expect(isValidHex("#GG0000")).toBe(false);
    expect(isValidHex("#12")).toBe(false);
    expect(normalizeHex("")).toBeNull();
  });

  it("picks readable foreground", () => {
    expect(contrastForeground("#000000")).toBe("#FFFFFF");
    expect(contrastForeground("#FFFFFF")).toBe("#0F172A");
    expect(contrastForeground("#059669")).toBe("#FFFFFF");
    expect(contrastForeground("#FDE68A")).toBe("#0F172A");
  });

  it("resolves CSS var bundle with default fallback", () => {
    const v = resolveBrandCssVars("not-a-color");
    expect(v.primary).toBe(DEFAULT_BRAND_PRIMARY);
    expect(v.ring).toBe(DEFAULT_BRAND_PRIMARY);
  });

  it("keeps mid-tone brand primary in dark mode; only lifts very dark fills", () => {
    expect(brandPrimaryForTheme("#14B8A6", false)).toBe("#14B8A6");
    expect(brandPrimaryForTheme("#14B8A6", true)).toBe("#14B8A6");
    expect(brandPrimaryForTheme("#475569", true)).toBe(lightenHex("#475569", 0.22));
    expect(resolveBrandCssVars("#14B8A6", true).primaryForeground).toBe("#FFFFFF");
  });

  it("matches presets", () => {
    expect(matchingBrandPresetId("#059669")).toBe("green");
    expect(matchingBrandPresetId("#112233")).toBeNull();
  });

  it("preserves framework-owned favicon nodes when applying the platform logo", () => {
    const icons = ["/favicon.png", "/icon.png", "data:image/svg+xml,test"].map(
      (href) => {
        const icon = document.createElement("link");
        icon.rel = href.startsWith("data:") ? "shortcut icon" : "icon";
        icon.href = href;
        document.head.appendChild(icon);
        return icon;
      }
    );
    const appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.href = "/apple-touch-icon.png";
    document.head.appendChild(appleIcon);

    applyBrandFavicon();
    applyBrandFavicon();

    for (const icon of icons) {
      expect(icon.parentNode).toBe(document.head);
      expect(icon.getAttribute("href")).toBe(PLATFORM_FAVICON_HREF);
      expect(icon.type).toBe("image/png");
    }
    expect(document.querySelectorAll("link[data-brand-favicon]")).toHaveLength(1);
    expect(appleIcon.getAttribute("href")).toBe("/apple-touch-icon.png");
    expect(appleIcon.parentNode).toBe(document.head);
  });
});
