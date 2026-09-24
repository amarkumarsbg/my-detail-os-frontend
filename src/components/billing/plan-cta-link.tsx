"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Copy, Mail, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatSupportPhoneDisplay,
  isMailtoUrl,
  isPlaceholderPlanUrl,
  planCtaOpenMode,
  toTelHref,
} from "@/lib/plan-limits";

export function parseMailto(href: string): { email: string; subject: string | null } {
  const raw = href.trim();
  if (!/^mailto:/i.test(raw)) {
    return { email: "support@mydetailos.com", subject: null };
  }
  const withoutScheme = raw.slice("mailto:".length);
  const [addressPart, query = ""] = withoutScheme.split("?");
  const email = decodeURIComponent(addressPart || "").trim() || "support@mydetailos.com";
  const params = new URLSearchParams(query);
  const subject = params.get("subject");
  return { email, subject };
}

type SupportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  href: string;
  phone?: string | null;
  title?: string;
};

export function PlanSupportDialog({
  open,
  onOpenChange,
  href,
  phone,
  title = "Contact support",
}: SupportDialogProps) {
  const { email, subject } = parseMailto(
    isPlaceholderPlanUrl(href)
      ? "mailto:support@mydetailos.com?subject=Support%20request"
      : href
  );
  const mailto = subject
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${email}`;
  const phoneDisplay = phone?.trim() ? formatSupportPhoneDisplay(phone) : "";
  const telHref = phone?.trim() ? toTelHref(phone) : "";

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy email");
    }
  };

  const copyPhone = async () => {
    if (!phone?.trim()) return;
    try {
      await navigator.clipboard.writeText(phone.trim());
      toast.success("Phone number copied");
    } catch {
      toast.error("Could not copy phone");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Reach your software provider to add branches or upgrade your plan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 px-3 py-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Support email
            </p>
            <p className="mt-1 break-all font-medium">{email}</p>
            {subject ? (
              <p className="mt-2 text-muted-foreground">Subject: {subject}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void copyEmail()}>
                <Copy className="h-4 w-4" />
                Copy email
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={mailto}>
                  <Mail className="h-4 w-4" />
                  Email
                </a>
              </Button>
            </div>
          </div>

          {phoneDisplay && telHref ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Support phone
              </p>
              <p className="mt-1 font-medium">
                <a href={telHref} className="hover:underline">
                  {phoneDisplay}
                </a>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void copyPhone()}>
                  <Copy className="h-4 w-4" />
                  Copy number
                </Button>
                <Button type="button" size="sm" asChild>
                  <a href={telHref}>
                    <Phone className="h-4 w-4" />
                    Call now
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CtaProps = {
  href: string;
  phone?: string | null;
  children: ReactNode;
  className?: string;
  variant?: "default" | "outline" | "link" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  dialogTitle?: string;
};

/** Contact / Upgrade CTA that always shows an in-app dialog for mailto (mailto alone often does nothing). */
export function PlanCtaButton({
  href,
  phone,
  children,
  className,
  variant = "default",
  size = "default",
  dialogTitle,
}: CtaProps) {
  const [open, setOpen] = useState(false);
  const mode = planCtaOpenMode(href);

  if (mode === "external") {
    return (
      <Button type="button" variant={variant} size={size} className={className} asChild>
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <PlanSupportDialog
        open={open}
        onOpenChange={setOpen}
        href={href}
        phone={phone}
        title={dialogTitle}
      />
    </>
  );
}

/** Inline text-style CTA (banners). */
export function PlanCtaTextButton({
  href,
  phone,
  children,
  className,
  dialogTitle,
}: Omit<CtaProps, "variant" | "size">) {
  const [open, setOpen] = useState(false);
  const mode = planCtaOpenMode(href);

  if (mode === "external") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn("text-primary underline-offset-4 hover:underline", className)}
      >
        {children}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline p-0 m-0 border-0 bg-transparent text-primary underline-offset-4 hover:underline cursor-pointer",
          className
        )}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <PlanSupportDialog
        open={open}
        onOpenChange={setOpen}
        href={href}
        phone={phone}
        title={dialogTitle}
      />
    </>
  );
}

export function planCtaIsMailto(href: string): boolean {
  return isMailtoUrl(href);
}
