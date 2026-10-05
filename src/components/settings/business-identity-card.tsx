"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FlipHorizontal2,
  Globe,
  IdCard,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings-store";
import { resolveUploadsPublicUrl } from "@/lib/api-base";
import { DEFAULT_BRAND_PRIMARY, normalizeHex } from "@/lib/brand-color";
import { buildBusinessCardHtml } from "@/lib/business-card-html";
import { cn } from "@/lib/utils";

const CAR_ARTWORK_SRC = "/business-card-car.svg";

function hexRgb(hex: string) {
  const n = (normalizeHex(hex) ?? DEFAULT_BRAND_PRIMARY).replace("#", "");
  return {
    r: Number.parseInt(n.slice(0, 2), 16),
    g: Number.parseInt(n.slice(2, 4), 16),
    b: Number.parseInt(n.slice(4, 6), 16),
  };
}

function mixHex(a: string, b: string, t: number) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  const r = Math.round(x.r + (y.r - x.r) * t);
  const g = Math.round(x.g + (y.g - x.g) * t);
  const bl = Math.round(x.b + (y.b - x.b) * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function BusinessIdentityCard(props?: {
  previewName?: string;
  previewContact?: string;
  previewPhone?: string;
  previewEmail?: string;
  previewAddress?: string;
}) {
  const businessName = useSettingsStore((s) => s.businessName);
  const businessLogo = useSettingsStore((s) => s.businessLogo);
  const businessTagline = useSettingsStore((s) => s.businessTagline);
  const businessPhone = useSettingsStore((s) => s.businessPhone);
  const businessEmail = useSettingsStore((s) => s.businessEmail);
  const businessAddress = useSettingsStore((s) => s.businessAddress);
  const businessWebsite = useSettingsStore((s) => s.businessWebsite);
  const identityContactName = useSettingsStore((s) => s.identityContactName);
  const brandPrimary = useSettingsStore((s) => s.brandPrimary);
  const brandPrimaryPreview = useSettingsStore((s) => s.brandPrimaryPreview);

  const [showBack, setShowBack] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const frontRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLElement>(null);

  const accent =
    normalizeHex(brandPrimaryPreview ?? brandPrimary) ?? DEFAULT_BRAND_PRIMARY;
  const deep = mixHex(accent, "#061018", 0.42);
  const soft = mixHex(accent, "#ffffff", 0.38);
  const logoSrc = resolveUploadsPublicUrl(businessLogo);
  const title = (props?.previewName ?? businessName).trim() || "MY DETAIL OS";
  const contactName =
    (props?.previewContact ?? identityContactName).trim() || title;
  const phone = (props?.previewPhone ?? businessPhone).trim();
  const email = (props?.previewEmail ?? businessEmail).trim();
  const address = (props?.previewAddress ?? businessAddress).trim();
  const website = businessWebsite.trim();
  const tagline = businessTagline.trim() || "Car wash & detailing";

  const contacts = [
    { key: "address", value: address, icon: MapPin },
    { key: "email", value: email, icon: Mail },
    { key: "phone", value: phone, icon: Phone },
    { key: "web", value: website, icon: Globe },
  ].filter((row) => row.value);

  const downloadCard = async () => {
    setDownloading(true);
    try {
      if (!frontRef.current || !backRef.current) throw new Error("Business card preview unavailable");
      const html = await buildBusinessCardHtml({
        front: frontRef.current,
        back: backRef.current,
        title: contactName,
      });
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `visiting-card-${contactName.replace(/[^\w.-]+/g, "-").toLowerCase() || "business"}.html`;
      a.click();
      const revokeObjectURL = URL.revokeObjectURL.bind(URL);
      setTimeout(() => revokeObjectURL(url), 1000);
      toast.success("Business card downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download card");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
            <IdCard className="h-4 w-4 text-primary" />
            Business card
          </h3>
          <p className="text-xs text-muted-foreground">
            Flip for brand on the front and contacts on the back.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-5 bg-[#eef1f5] px-4 py-8 sm:px-6">
        <div
          className="mx-auto w-full max-w-[440px] cursor-pointer [perspective:1200px]"
          onClick={() => setShowBack((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowBack((v) => !v);
            }
          }}
          aria-label={showBack ? "Show front of card" : "Show back of card"}
        >
          <div
            className={cn(
              "relative aspect-[3.5/2] w-full transition-transform duration-500 ease-out [transform-style:preserve-3d]",
              showBack && "[transform:rotateY(180deg)]"
            )}
          >
            <article
              ref={frontRef}
              data-business-card-face="front"
              className="absolute inset-0 overflow-hidden rounded-[16px] text-white shadow-[0_16px_40px_-18px_rgba(15,23,42,0.45)] [backface-visibility:hidden]"
              style={{ background: deep }}
            >
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-black/20 blur-2xl" />
              <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CAR_ARTWORK_SRC} alt="" width={360} height={120} className="h-auto w-[230px] max-w-full shrink-0 sm:w-[260px]" />
                <p className="mt-1 max-w-[92%] text-[22px] font-extrabold uppercase leading-tight tracking-[0.06em] sm:text-[26px]">
                  {title}
                </p>
                <p className="mt-2 text-[13px] font-medium capitalize tracking-wide text-white/80">
                  {tagline}
                </p>
              </div>
            </article>

            <article
              ref={backRef}
              data-business-card-face="back"
              className="absolute inset-0 overflow-hidden rounded-[16px] bg-white shadow-[0_16px_40px_-18px_rgba(15,23,42,0.45)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
            >
              <div className="relative h-[46%] overflow-hidden">
                <div className="absolute inset-0" style={{ background: deep }} />
                <div
                  className="absolute inset-0"
                  style={{
                    background: soft,
                    clipPath: "polygon(56% 0, 100% 0, 100% 100%, 40% 100%)",
                  }}
                />
                <div className="relative z-10 grid h-full grid-cols-[1.15fr_0.85fr] items-center gap-2 px-5">
                  <div className="min-w-0 text-white">
                    <p className="truncate text-[17px] font-extrabold uppercase tracking-[0.04em] sm:text-[18px]">
                      {contactName}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
                      {tagline}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    {logoSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoSrc}
                        alt=""
                        className="h-12 w-12 rounded-lg bg-white/25 object-contain p-1 sm:h-14 sm:w-14"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={CAR_ARTWORK_SRC} alt="" width={360} height={120} className="h-auto w-[120px] max-w-full shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid h-[54%] grid-cols-2 content-center gap-x-4 gap-y-3 px-5 py-3">
                {(contacts.length ? contacts : [{ key: "empty", value: "Add contact details in Business Profile", icon: MapPin }]).slice(0, 4).map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.key} data-contact-key={row.key} className="flex min-w-0 items-start gap-2">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ background: deep }}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <p className="line-clamp-2 pt-0.5 text-[11px] leading-snug" style={{ color: deep }}>
                        {row.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 bg-white"
            onClick={() => setShowBack((v) => !v)}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            {showBack ? "Show front" : "Show back"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={downloading}
            onClick={() => void downloadCard()}
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Preparing…" : "Download card"}
          </Button>
        </div>
        <p className="max-w-md text-center text-[11px] text-muted-foreground">
          Uses this workshop&apos;s brand color, logo, and contact details.
        </p>
      </div>
    </div>
  );
}
