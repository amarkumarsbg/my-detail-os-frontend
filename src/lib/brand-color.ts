/** Default matches current product primary in globals.css. */
export const DEFAULT_BRAND_PRIMARY = "#14B8A6";

export type BrandPreset = {
  id: string;
  label: string;
  hex: string;
};

export const BRAND_COLOR_PRESETS: BrandPreset[] = [
  { id: "blue", label: "Blue", hex: "#3B82F6" },
  { id: "indigo", label: "Indigo", hex: "#6366F1" },
  { id: "purple", label: "Purple", hex: "#A855F7" },
  { id: "red", label: "Red", hex: "#EF4444" },
  { id: "orange", label: "Orange", hex: "#F97316" },
  { id: "amber", label: "Amber", hex: "#F59E0B" },
  { id: "green", label: "Green", hex: "#059669" },
  { id: "teal", label: "Teal", hex: "#14B8A6" },
  { id: "slate", label: "Slate", hex: "#475569" },
];

/** Expand #RGB → #RRGGBB and uppercase. Returns null if invalid. */
export function normalizeHex(raw: string): string | null {
  const s = String(raw ?? "").trim();
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(s);
  if (m3) {
    const [r, g, b] = m3[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(s);
  if (m6) return `#${m6[1]}`.toUpperCase();
  return null;
}

export function isValidHex(raw: string): boolean {
  return normalizeHex(raw) !== null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

/** Relative luminance (sRGB) 0–1. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const R = channel(rgb.r);
  const G = channel(rgb.g);
  const B = channel(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** White or near-black label color for text on the brand fill. */
export function contrastForeground(hex: string): string {
  // Bias toward white on mid-saturation brand fills (typical primary buttons).
  return relativeLuminance(hex) > 0.55 ? "#0F172A" : "#FFFFFF";
}

export function brandGlowDim(hex: string, alpha = 0.1): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(59, 130, 246, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Mix hex toward white (amount 0–1). */
export function lightenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return normalizeHex(hex) ?? DEFAULT_BRAND_PRIMARY;
  const t = Math.min(1, Math.max(0, amount));
  const r = Math.round(rgb.r + (255 - rgb.r) * t);
  const g = Math.round(rgb.g + (255 - rgb.g) * t);
  const b = Math.round(rgb.b + (255 - rgb.b) * t);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * Only very dark brand fills need a lift in dark mode.
 * Keep mid tones (teal, blue, etc.) so we don’t get neon mint + dark text.
 */
export function brandPrimaryForTheme(hex: string, isDark: boolean): string {
  const primary = normalizeHex(hex) ?? DEFAULT_BRAND_PRIMARY;
  if (!isDark) return primary;
  const lum = relativeLuminance(primary);
  if (lum >= 0.22) return primary;
  return lightenHex(primary, 0.22);
}

export type BrandCssVars = {
  primary: string;
  primaryForeground: string;
  ring: string;
  sidebarActive: string;
  sidebarActiveForeground: string;
  sidebarGlow: string;
  sidebarGlowDim: string;
  sidebarAccent: string;
};

export function resolveBrandCssVars(hex: string, isDark = false): BrandCssVars {
  const primary = brandPrimaryForTheme(hex, isDark);
  const primaryForeground = contrastForeground(primary);
  const glow = isDark ? lightenHex(primary, 0.18) : primary;
  return {
    primary,
    primaryForeground,
    ring: isDark ? glow : primary,
    sidebarActive: primary,
    sidebarActiveForeground: primaryForeground,
    sidebarGlow: glow,
    sidebarGlowDim: brandGlowDim(primary, isDark ? 0.14 : 0.1),
    sidebarAccent: brandGlowDim(primary, isDark ? 0.16 : 0.15),
  };
}

/** Apply brand tokens on :root so Tailwind `bg-primary` / sidebar active follow. */
export function applyBrandCssVars(
  hex: string,
  root: HTMLElement = document.documentElement,
  options?: { isDark?: boolean }
): void {
  const isDark =
    options?.isDark ??
    (typeof document !== "undefined" && root.classList.contains("dark"));
  const v = resolveBrandCssVars(hex, isDark);
  root.style.setProperty("--primary", v.primary);
  root.style.setProperty("--primary-foreground", v.primaryForeground);
  root.style.setProperty("--ring", v.ring);
  root.style.setProperty("--sidebar-active", v.sidebarActive);
  root.style.setProperty("--sidebar-active-foreground", v.sidebarActiveForeground);
  root.style.setProperty("--sidebar-glow", v.sidebarGlow);
  root.style.setProperty("--sidebar-glow-dim", v.sidebarGlowDim);
  root.style.setProperty("--sidebar-accent", v.sidebarAccent);
}

export function matchingBrandPresetId(hex: string): string | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return BRAND_COLOR_PRESETS.find((p) => p.hex === n)?.id ?? null;
}

/** Platform / company logo used as the tab favicon everywhere. */
export const PLATFORM_FAVICON_HREF = "/my-detail-os-mark.png";

/** @deprecated Kept for callers; favicon is always the platform logo now. */
export function buildBrandFaviconSvg(_hex: string): string {
  return "";
}

/** Keep the document favicon on the MY DETAIL OS logo (not a color-tinted glyph). */
export function applyBrandFavicon(_hex?: string): void {
  if (typeof document === "undefined") return;

  let link = document.querySelector<HTMLLinkElement>("link[data-brand-favicon]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.setAttribute("data-brand-favicon", "true");
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = PLATFORM_FAVICON_HREF;

  for (const el of document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"]'
  )) {
    if (el === link) continue;
    const href = el.getAttribute("href") || "";
    if (
      href.includes("/icon") ||
      href.includes("favicon") ||
      href.startsWith("data:image/svg")
    ) {
      el.type = "image/png";
      el.href = PLATFORM_FAVICON_HREF;
    }
  }
}
