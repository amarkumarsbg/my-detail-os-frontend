import type {
  Appointment,
  Invoice,
  JobCard,
  MembershipTier,
  PaymentMethod,
  PickupDropRequest,
  Quotation,
} from "@/types";
import type { BookingConfirmationBusiness } from "@/lib/booking-confirmation-message";
import { buildReservationConfirmedMessage } from "@/lib/appointment-messages";
import { getAppointmentDisplayId } from "@/lib/appointment-ids";
import { reminderMessageFor } from "@/lib/appointment-reminders";
import { useSettingsStore } from "@/store/settings-store";
import {
  buildBeforePhotosReadyWhatsAppMessage,
  buildInvoiceWhatsAppMessage,
  buildJobDeliveredWhatsAppMessage,
  buildJobReadyForPickupWhatsAppMessage,
  buildPickupAndDropScheduledWhatsAppMessage,
  buildPickupDropWhatsAppMessage,
  buildQuotationConvertedWhatsAppMessage,
  buildMembershipWelcomeWhatsAppMessage,
  buildHighEndAdvanceReceiptWhatsAppMessage,
} from "@/lib/whatsapp-customer-messages";
import { executeCustomerWhatsAppAutomation } from "@/lib/whatsapp-automation-flow";
import { useJobCardStore } from "@/store/job-card-store";
import { getCustomerPortalLoginUrl } from "@/lib/customer-portal-url";
import { resolveWorkshopDisplayName } from "@/lib/workshop-display-name";

function branchIdForJobCardId(jobCardId: string | undefined): string | undefined {
  if (!jobCardId) return undefined;
  return useJobCardStore.getState().jobCards.find((j) => j.id === jobCardId)?.branchId;
}

export function notifyBeforePhotosReadyWhatsApp(
  job: JobCard,
  businessName: string,
  opts?: { temporaryPassword?: string }
): void {
  const phone = job.customerPhone?.trim();
  if (!phone) return;
  const portalUrl = getCustomerPortalLoginUrl();
  const message = buildBeforePhotosReadyWhatsAppMessage(job, {
    businessName: resolveWorkshopDisplayName({ businessName }),
    portalUrl,
    temporaryPassword: opts?.temporaryPassword,
    customerPhone: phone,
  });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Check-in photos — WhatsApp sent",
      composer: "Check-in photos — WhatsApp composer",
    },
    notificationSummary: `${job.jobNumber} → ${phone}`,
    href: `/job-cards/${job.id}`,
    branchId: job.branchId,
    activityLog: {
      entityType: "JOB_CARD",
      entityId: job.id,
      entityLabel: job.jobNumber,
      details: `Before photos WhatsApp sent to ${job.customerName}`,
    },
  });
}

export function notifyJobReadyWhatsApp(job: JobCard, businessName: string): void {
  const phone = job.customerPhone?.trim();
  if (!phone) return;
  // Retrieve temp password stored during new customer creation (same browser session only)
  const sessionKey = `customer-temp-pass:${job.customerId}`;
  const temporaryPassword = typeof sessionStorage !== "undefined"
    ? sessionStorage.getItem(sessionKey) ?? undefined
    : undefined;
  const message = buildJobReadyForPickupWhatsAppMessage(job, {
    businessName: resolveWorkshopDisplayName({ businessName }),
    portalUrl: getCustomerPortalLoginUrl(),
    temporaryPassword,
  });
  // Clear after use
  if (temporaryPassword && typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(sessionKey);
  }
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Ready for pickup — WhatsApp sent",
      composer: "Ready for pickup — WhatsApp composer",
    },
    notificationSummary: `${job.jobNumber} → ${phone}`,
    href: `/job-cards/${job.id}`,
    branchId: job.branchId,
    activityLog: {
      entityType: "JOB_CARD",
      entityId: job.id,
      entityLabel: job.jobNumber,
      details: `Automated ready-for-pickup WhatsApp to ${job.customerName}`,
    },
  });
}

export function notifyJobDeliveredWhatsApp(job: JobCard, businessName: string): void {
  const phone = job.customerPhone?.trim();
  if (!phone) return;
  const portalUrl = getCustomerPortalLoginUrl();
  // Retrieve stored temp password if still in session (cleared after use)
  const sessionKey = `customer-temp-pass:${job.customerId}`;
  const temporaryPassword = typeof sessionStorage !== "undefined"
    ? sessionStorage.getItem(sessionKey) ?? undefined
    : undefined;
  if (temporaryPassword && typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(sessionKey);
  }
  // Optional review URL can be wired from settings once a dedicated field exists.
  const googleReviewUrl: string | undefined = undefined;
  const message = buildJobDeliveredWhatsAppMessage(job, {
    businessName,
    portalUrl,
    temporaryPassword,
    googleReviewUrl,
  });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Delivered — WhatsApp sent",
      composer: "Delivered — WhatsApp composer",
    },
    notificationSummary: `${job.jobNumber} → ${phone}`,
    href: `/job-cards/${job.id}`,
    branchId: job.branchId,
    activityLog: {
      entityType: "JOB_CARD",
      entityId: job.id,
      entityLabel: job.jobNumber,
      details: `Automated delivered confirmation WhatsApp to ${job.customerName}`,
    },
  });
}

export function notifyInvoiceCreatedWhatsApp(inv: Invoice, businessName: string): void {
  const phone = inv.customerPhone?.trim();
  if (!phone) return;
  const totalPaid = inv.payments.reduce((s, p) => s + p.amount, 0) + (inv.walletAmountUsed || 0);
  const remainingBalance = Math.max(0, inv.grandTotal - totalPaid);
  const invoiceLabel = inv.taxRate > 0 ? "tax invoice" : "invoice";
  const message = buildInvoiceWhatsAppMessage(inv, {
    businessName,
    remainingBalance,
    invoiceLabel,
  });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "New invoice — WhatsApp sent",
      composer: "New invoice — WhatsApp composer",
    },
    notificationSummary: `${inv.invoiceNumber} → ${phone}`,
    href: `/billing/${inv.id}`,
    branchId: branchIdForJobCardId(inv.jobCardId),
    activityLog: {
      entityType: "INVOICE",
      entityId: inv.id,
      entityLabel: inv.invoiceNumber,
      details: `Automated invoice summary WhatsApp for ${inv.customerName}`,
    },
  });
}

export function notifyReservationConfirmedWhatsApp(
  apt: Appointment,
  business: BookingConfirmationBusiness | string
): void {
  const phone = (apt.whatsappPhone ?? apt.customerPhone)?.trim();
  if (!phone) return;
  const message = buildReservationConfirmedMessage(apt, business);
  const ref = getAppointmentDisplayId(apt);
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Confirmation sent — WhatsApp",
      composer: "Confirmation — WhatsApp composer",
    },
    notificationSummary: `${ref} → ${phone}`,
    href: apt.kind === "APPOINTMENT" ? "/appointments" : "/bookings",
    branchId: apt.branchId,
    activityLog: {
      entityType: "APPOINTMENT",
      entityId: apt.id,
      entityLabel: ref,
      details: `Confirmation WhatsApp for ${apt.customerName}`,
    },
  });
}

/** @deprecated Use notifyReservationConfirmedWhatsApp for new bookings. */
export function notifyAppointmentScheduledWhatsApp(
  apt: Appointment,
  business: BookingConfirmationBusiness
): void {
  notifyReservationConfirmedWhatsApp(apt, business.businessName ?? business.branchName);
}

export function notifyReservationReminderWhatsApp(apt: Appointment): void {
  const phone = (apt.whatsappPhone ?? apt.customerPhone)?.trim();
  if (!phone) return;
  const message = reminderMessageFor(apt);
  const ref = getAppointmentDisplayId(apt);
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Booking reminder sent",
      composer: "Booking reminder — WhatsApp composer",
    },
    notificationSummary: `${ref} reminder → ${phone}`,
    href: apt.kind === "APPOINTMENT" ? "/appointments" : "/bookings",
    branchId: apt.branchId,
    activityLog: {
      entityType: "APPOINTMENT",
      entityId: apt.id,
      entityLabel: ref,
      details: `Day-of reminder WhatsApp for ${apt.customerName}`,
    },
  });
}

export function notifyQuotationConvertedWhatsApp(
  q: Quotation,
  jobNumber: string,
  jobId: string,
  businessName: string
): void {
  const phone = q.customerPhone?.trim();
  if (!phone) return;
  const message = buildQuotationConvertedWhatsAppMessage(q, jobNumber, businessName);
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Estimate converted — WhatsApp sent",
      composer: "Estimate converted — WhatsApp composer",
    },
    notificationSummary: `${q.quotationNumber} → ${jobNumber} → ${phone}`,
    href: `/job-cards/${jobId}`,
    branchId: branchIdForJobCardId(jobId),
    activityLog: {
      entityType: "QUOTATION",
      entityId: q.id,
      entityLabel: q.quotationNumber,
      details: `Quotation converted — WhatsApp to ${q.customerName} (${jobNumber})`,
    },
  });
}

export function notifyMembershipWelcomeWhatsApp(opts: {
  customerPhone: string;
  customerName: string;
  customerId: string;
  businessName: string;
  packageName: string;
  tier: MembershipTier;
  validUntilIso: string;
  vehicleReg?: string;
  includedServiceNames?: string[];
}): void {
  const phone = opts.customerPhone.trim();
  if (!phone) return;
  const message = buildMembershipWelcomeWhatsAppMessage({
    customerName: opts.customerName,
    businessName: opts.businessName,
    packageName: opts.packageName,
    tier: opts.tier,
    validUntilIso: opts.validUntilIso,
    vehicleReg: opts.vehicleReg,
    includedServiceNames: opts.includedServiceNames,
  });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Membership welcome — WhatsApp sent",
      composer: "Membership welcome — WhatsApp composer",
    },
    notificationSummary: `${opts.packageName} → ${phone}`,
    href: "/membership",
    activityLog: {
      entityType: "CUSTOMER",
      entityId: opts.customerId,
      entityLabel: opts.customerName,
      details: `Membership welcome WhatsApp — ${opts.packageName}`,
    }  });
}

export function notifyHighEndAdvanceRecordedWhatsApp(
  job: JobCard,
  businessName: string,
  amount: number,
  method: PaymentMethod,
  reference?: string
): void {
  const phone = job.customerPhone?.trim();
  if (!phone) return;
  const message = buildHighEndAdvanceReceiptWhatsAppMessage(job, {
    businessName,
    amount,
    method,
    reference,
  });
  void executeCustomerWhatsAppAutomation({
    phone,
    message,
    titles: {
      api: "Advance receipt — WhatsApp sent",
      composer: "Advance receipt — WhatsApp composer",
    },
    notificationSummary: `${job.jobNumber} → ${phone}`,
    href: `/job-cards/${job.id}`,
    branchId: job.branchId,
    activityLog: {
      entityType: "JOB_CARD",
      entityId: job.id,
      entityLabel: job.jobNumber,
      details: `Advance receipt WhatsApp (${amount} ${method})`,
    },
  });
}

function pickupDropPhone(req: PickupDropRequest): string | undefined {
  const direct = req.customerPhone?.trim();
  if (direct) return direct;
  const m = req.notes?.match(/Phone:\s*([^\n]+)/i);
  return m?.[1]?.trim() || undefined;
}

function pickupDropWhatsAppContext(req: PickupDropRequest) {
  const typeLabel = req.type === "PICKUP" ? "Pickup" : "Drop-off";
  return {
    href: "/pickup-drop",
    branchId: req.branchId,
    notificationSummary: `${typeLabel} ${req.id} → ${pickupDropPhone(req) ?? ""}`,
    activityLog: {
      entityType: "JOB_CARD" as const,
      entityId: req.jobCardId,
      entityLabel: req.jobNumber !== "NEW" ? req.jobNumber : req.id,
      details: `${typeLabel} WhatsApp to ${req.customerName}`,
    },
  };
}

export function notifyPickupDropWhatsApp(
  req: PickupDropRequest,
  opts: { branchName?: string; businessName?: string } = {}
): void {
  const phone = pickupDropPhone(req);
  if (!phone) return;
  const typeLabel = req.type === "PICKUP" ? "Pickup" : "Drop-off";
  const ctx = pickupDropWhatsAppContext(req);
  void executeCustomerWhatsAppAutomation({
    phone,
    message: buildPickupDropWhatsAppMessage(req, opts),
    titles: {
      api: `${typeLabel} — WhatsApp sent`,
      composer: `${typeLabel} — WhatsApp composer`,
    },
    ...ctx,
  });
}

export function notifyPickupDropCreatedWhatsApp(
  created: PickupDropRequest[],
  opts: { branchName?: string; businessName?: string } = {}
): void {
  const pickup = created.find((r) => r.type === "PICKUP");
  const drop = created.find((r) => r.type === "DROP");
  if (pickup && drop) {
    const phone = pickupDropPhone(pickup) ?? pickupDropPhone(drop);
    if (!phone) return;
    const ctx = pickupDropWhatsAppContext(pickup);
    void executeCustomerWhatsAppAutomation({
      phone,
      message: buildPickupAndDropScheduledWhatsAppMessage(pickup, drop, opts),
      titles: {
        api: "Pickup & drop-off — WhatsApp sent",
        composer: "Pickup & drop-off — WhatsApp composer",
      },
      ...ctx,
      activityLog: {
        ...ctx.activityLog,
        details: `Pickup & drop-off scheduled WhatsApp to ${pickup.customerName}`,
      },
    });
    return;
  }
  const only = pickup ?? drop;
  if (only) notifyPickupDropWhatsApp(only, opts);
}
