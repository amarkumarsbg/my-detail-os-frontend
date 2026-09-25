"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogMobileSheetContentClasses,
  dialogMobileSheetHeaderClasses,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  buildJobCardTemplateMessage,
  defaultWhatsAppTemplateForStatus,
  JOB_CARD_WHATSAPP_TEMPLATES,
  jobCardNotifyStatusLabel,
  type JobCardWhatsAppTemplateId,
} from "@/lib/job-card-whatsapp-templates";
import { cn } from "@/lib/utils";
import {
  isWhatsAppNotConfiguredError,
  openWhatsAppComposer,
  sendCustomerWhatsApp,
} from "@/lib/whatsapp-send";
import { getCustomerPortalAbsoluteUrl, getCustomerPortalLoginUrl } from "@/lib/customer-portal-url";
import { resolveWorkshopDisplayName } from "@/lib/workshop-display-name";
import { useNotificationStore } from "@/store/notification-store";
import type { JobCard } from "@/types";

export type JobCardWhatsAppNotifyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobCard: JobCard;
  businessName: string;
  invoiceNumber?: string | null;
};

function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

export function JobCardWhatsAppNotifyDialog({
  open,
  onOpenChange,
  jobCard,
  businessName,
  invoiceNumber,
}: JobCardWhatsAppNotifyDialogProps) {
  const [templateId, setTemplateId] = useState<JobCardWhatsAppTemplateId>("ready_for_pickup");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const displayName = resolveWorkshopDisplayName({ businessName });

  const buildOpts = useMemo(
    () => ({
      businessName: displayName,
      invoiceNumber: invoiceNumber ?? null,
      customerLoginUrl: getCustomerPortalLoginUrl({ origin: appOrigin() || null }),
      customerPhotosLink: jobCard.secureToken
        ? getCustomerPortalAbsoluteUrl(`/customer/job-card/${jobCard.secureToken}/photos`, {
            origin: appOrigin() || null,
          })
        : null,
    }),
    [displayName, invoiceNumber, jobCard.secureToken]
  );

  useEffect(() => {
    if (!open) return;
    const next = defaultWhatsAppTemplateForStatus(jobCard.status);
    setTemplateId(next);
    setMessage(buildJobCardTemplateMessage(next, jobCard, buildOpts));
  }, [open, jobCard, buildOpts]);

  const selectTemplate = (id: JobCardWhatsAppTemplateId) => {
    setTemplateId(id);
    setMessage(buildJobCardTemplateMessage(id, jobCard, buildOpts));
  };

  const phone = jobCard.customerPhone?.trim() ?? "";
  const canSend = Boolean(phone) && message.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    const body = message.trim();
    setSending(true);
    const pushStaffNotification = (channel: "api" | "composer") => {
      useNotificationStore.getState().addNotification({
        type: "whatsapp_sent",
        title: channel === "api" ? "WhatsApp sent to customer" : "WhatsApp composer opened",
        message:
          channel === "api"
            ? `${jobCard.jobNumber} — message sent to ${phone}.`
            : `${jobCard.jobNumber} — finish sending in WhatsApp (${phone}); API sender not configured.`,
        href: `/job-cards/${jobCard.id}`,
        branchId: jobCard.branchId,
      });
    };
    try {
      await sendCustomerWhatsApp(phone, body);
      toast.success("WhatsApp sent", { description: `Delivered to ${phone}` });
      pushStaffNotification("api");
      onOpenChange(false);
    } catch (e) {
      if (isWhatsAppNotConfiguredError(e)) {
        openWhatsAppComposer(phone, body);
        toast.info("WhatsApp opened", {
          description: "Server WhatsApp is not configured — complete the message in the WhatsApp app.",
        });
        pushStaffNotification("composer");
        onOpenChange(false);
        return;
      }
      toast.error("WhatsApp failed", {
        description: e instanceof ApiError ? e.message : "Could not send WhatsApp",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(dialogMobileSheetContentClasses, "max-h-[92dvh] sm:max-w-lg")}
        showClose
      >
        <DialogHeader
          className={cn(
            dialogMobileSheetHeaderClasses,
            "border-b-0 bg-emerald-50/90 dark:bg-emerald-950/40"
          )}
        >
          <div className="flex items-start gap-3 pr-6">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm dark:bg-emerald-900/60">
              <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base leading-snug">Notify Customer on WhatsApp</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {jobCard.customerName}
                {phone ? ` · ${phone}` : ""}
                {" · "}
                Status: {jobCardNotifyStatusLabel(jobCard.status)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-3">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Message template
            </p>
            <div className="flex flex-wrap gap-1.5">
              {JOB_CARD_WHATSAPP_TEMPLATES.map((t) => {
                const selected = templateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selectTemplate(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      selected
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-border bg-background text-foreground hover:bg-muted/60"
                    )}
                  >
                    <span aria-hidden>{t.emoji}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Message (editable)
            </p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="min-h-[11rem] resize-y text-sm leading-relaxed"
              placeholder="Type your WhatsApp message…"
            />
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {message.length} characters
            </p>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            disabled={!canSend}
            title={!phone ? "Customer phone number is required" : undefined}
            onClick={() => void handleSend()}
          >
            {sending ? "Sending…" : "Send on WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
