import type { JobCard, JobCardStatus } from "@/types";

export type JobCardWhatsAppTemplateId =
  | "booking_confirmed"
  | "vehicle_arrived"
  | "work_started"
  | "qc_passed"
  | "ready_for_pickup"
  | "invoice_ready"
  | "job_closed"
  | "custom";

export type JobCardWhatsAppTemplateDef = {
  id: JobCardWhatsAppTemplateId;
  label: string;
  emoji: string;
};

export const JOB_CARD_WHATSAPP_TEMPLATES: JobCardWhatsAppTemplateDef[] = [
  { id: "booking_confirmed", label: "Booking Confirmed", emoji: "✅" },
  { id: "vehicle_arrived", label: "Vehicle Arrived", emoji: "🚗" },
  { id: "work_started", label: "Work Started", emoji: "🔧" },
  { id: "qc_passed", label: "QC Passed", emoji: "✅" },
  { id: "ready_for_pickup", label: "Ready for Pickup", emoji: "✅" },
  { id: "invoice_ready", label: "Invoice Ready", emoji: "📄" },
  { id: "job_closed", label: "Job Closed", emoji: "🔓" },
  { id: "custom", label: "Custom Message", emoji: "📝" },
];

const STATUS_NOTIFY_LABEL: Record<JobCardStatus, string> = {
  RECEIVED: "Received",
  INSPECTION: "Inspection",
  AWAITING_SERVICE: "In Service",
  QUALITY_CHECK: "Quality Check",
  READY: "Ready for Billing",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function jobCardNotifyStatusLabel(status: JobCardStatus): string {
  return STATUS_NOTIFY_LABEL[status] ?? status;
}

/** Pick a sensible default template from current job status. */
export function defaultWhatsAppTemplateForStatus(status: JobCardStatus): JobCardWhatsAppTemplateId {
  switch (status) {
    case "RECEIVED":
      return "vehicle_arrived";
    case "INSPECTION":
      return "vehicle_arrived";
    case "AWAITING_SERVICE":
      return "work_started";
    case "QUALITY_CHECK":
      return "qc_passed";
    case "READY":
      return "ready_for_pickup";
    case "DELIVERED":
      return "job_closed";
    case "CANCELLED":
    default:
      return "custom";
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full.trim();
}

function serviceSummary(job: JobCard): string {
  const names = job.services.map((s) => s.name).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} (+${names.length - 3} more)`;
}

function vehicleLine(job: JobCard): string {
  return `${job.vehicleMakeModel} ${job.vehicleRegNumber}`.replace(/\s+/g, " ").trim();
}

export type BuildJobCardTemplateMessageOpts = {
  businessName: string;
  invoiceNumber?: string | null;
  customerLoginUrl?: string | null;
  customerPhotosLink?: string | null;
};

function joinMessage(lines: Array<string | false | null | undefined>): string {
  return lines.filter((l): l is string => typeof l === "string").join("\n");
}

export function buildJobCardTemplateMessage(
  templateId: JobCardWhatsAppTemplateId,
  job: JobCard,
  opts: BuildJobCardTemplateMessageOpts
): string {
  const { buildBeforePhotosReadyWhatsAppMessage, buildJobReadyForPickupWhatsAppMessage, buildJobDeliveredWhatsAppMessage, buildJobCardCustomerWhatsAppMessage, buildInvoiceWhatsAppMessage } = require("@/lib/whatsapp-customer-messages");
  const { buildBookingWhatsAppMessageCompact } = require("@/lib/booking-confirmation-message");
  
  const bizName = opts.businessName.trim() || "MY DETAIL OS";

  switch (templateId) {
    case "booking_confirmed":
      // Re-use booking confirmation logic
      return buildBookingWhatsAppMessageCompact(
        {
          id: job.id,
          bookingId: job.jobNumber,
          customerId: job.customerId,
          customerName: job.customerName,
          customerPhone: job.customerPhone,
          whatsappPhone: job.customerPhone,
          vehicleId: job.vehicleId,
          vehicleRegNumber: job.vehicleRegNumber,
          vehicleMakeModel: job.vehicleMakeModel,
          serviceType: job.services.map((s: any) => s.name).filter(Boolean).join(" + ") || "Service",
          date: job.createdAt,
          time: "00:00",
          status: "CONFIRMED",
          whatsappSent: true,
          createdAt: job.createdAt,
          customerFirstName: job.customerName.trim().split(/\s+/)[0],
        } as any,
        {
          branchName: bizName,
          businessName: bizName,
          address: "",
          phone: "",
          email: "",
        }
      );

    case "vehicle_arrived":
      return buildBeforePhotosReadyWhatsAppMessage(job, {
        businessName: bizName,
        portalUrl: opts.customerLoginUrl ?? undefined,
        customerPhone: job.customerPhone,
      });

    case "work_started":
    case "qc_passed":
      return buildJobCardCustomerWhatsAppMessage(job, {
        portalUrl: opts.customerLoginUrl ?? undefined,
      });

    case "ready_for_pickup":
      return buildJobReadyForPickupWhatsAppMessage(job, {
        businessName: bizName,
        portalUrl: opts.customerLoginUrl ?? undefined,
      });

    case "invoice_ready":
      return buildInvoiceWhatsAppMessage(
        {
          id: job.id,
          jobCardId: job.id,
          invoiceNumber: opts.invoiceNumber ?? "N/A",
          jobNumber: job.jobNumber,
          customerId: job.customerId,
          customerName: job.customerName,
          customerPhone: job.customerPhone,
          vehicleId: job.vehicleId,
          vehicleRegNumber: job.vehicleRegNumber,
          lineItems: job.services.map((s: any) => ({ description: s.name, total: s.price })),
          grandTotal: job.estimatedAmount ?? 0,
          status: "ISSUED",
          payments: [],
          taxRate: 0,
          createdAt: job.createdAt,
        } as any,
        {
          businessName: bizName,
          remainingBalance: job.estimatedAmount ?? 0,
          invoiceLabel: "invoice",
        }
      );

    case "job_closed":
      return buildJobDeliveredWhatsAppMessage(job, {
        businessName: bizName,
        portalUrl: opts.customerLoginUrl ?? undefined,
      });

    case "custom":
    default:
      const name = job.customerName.trim() || "there";
      const vehicle = `${job.vehicleMakeModel} ${job.vehicleRegNumber}`.replace(/\s+/g, " ").trim();
      return joinMessage([
        `Hi *${name}*! 👋`,
        ``,
        `Regarding Job *${job.jobNumber}* — ${vehicle} at *${bizName}*.`,
        ``,
        ``,
        `— *${bizName}*`,
      ]);
  }
}
