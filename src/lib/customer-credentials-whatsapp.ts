/**
 * WhatsApp message templates for customer communications.
 *
 * TRIGGER POINTS (backend must call these at the right moments):
 *
 * 1. JOB CARD CREATED (new customer):
 *    → buildCustomerCredentialsWhatsAppMessage()
 *    → Sends login credentials so customer can track the service
 *
 * 2. JOB CARD DELIVERED:
 *    → buildJobDeliveredWhatsAppMessage()
 *    → Notifies customer their vehicle is ready / has been delivered
 */

import { getCustomerPortalLoginUrl } from "@/lib/customer-portal-url";

export interface CustomerCredentialsMessageInput {
  customerName: string;
  phone: string;
  password: string;
  businessName: string;
  bookingReference?: string;
  customerPortalUrl?: string;
}

/**
 * Build WhatsApp message with customer login credentials.
 * To be used when customer account is created during booking wizard.
 */
export function buildCustomerCredentialsWhatsAppMessage(
  input: CustomerCredentialsMessageInput
): string {
  const {
    customerName,
    phone,
    password,
    businessName,
    bookingReference,
    customerPortalUrl,
  } = input;

  const firstName = customerName.split(" ")[0];

  const bookingLine = bookingReference
    ? `Your booking *${bookingReference}* has been confirmed. ✅`
    : `Your booking has been confirmed. ✅`;

  const lines = [
    `Hi *${firstName}*! 👋🎉`,
    ``,
    `Welcome to *${businessName}*! 🚗✨`,
    ``,
    bookingLine,
    ``,
    `Here are your account details to track your service:`,
    ``,
    `📱 Phone: ${phone}`,
    `🔑 Password: ${password}`,
    ``,
    ...(customerPortalUrl
      ? [
          `🔗 *Track your vehicle:*`,
          `${customerPortalUrl}`,
          ``,
          `🔐 Please change your password after your first login.`,
          ``,
        ]
      : []),
    `Thank you for choosing *${businessName}*! ❤️`,
  ];

  return lines.join("\n");
}

/**
 * Customer portal login URL with org slug when available
 * (e.g. http://localhost:3002/my-detail-os/customer/login).
 */
export function getCustomerPortalUrl(orgSlug?: string | null): string {
  return getCustomerPortalLoginUrl({ orgSlug });
}

// ---------------------------------------------------------------------------
// Trigger 2: Job Card Delivered
// ---------------------------------------------------------------------------

export interface JobDeliveredMessageInput {
  customerName: string;
  jobCardNumber: string;
  vehicleMakeModel: string;
  registrationNumber: string;
  businessName: string;
  customerPortalUrl?: string;
}

/**
 * Build WhatsApp message sent when a job card is marked as DELIVERED.
 * Backend should call this when job card status transitions to DELIVERED.
 */
export function buildJobDeliveredWhatsAppMessage(
  input: JobDeliveredMessageInput
): string {
  const {
    customerName,
    jobCardNumber,
    vehicleMakeModel,
    registrationNumber,
    businessName,
    customerPortalUrl,
  } = input;

  const firstName = customerName.split(" ")[0];

  const lines = [
    `Hi *${firstName}*! 🎉`,
    ``,
    `Your vehicle is *ready and delivered*. We hope you love the results! ✨`,
    ``,
    `🚗 Vehicle: ${vehicleMakeModel} (${registrationNumber})`,
    `📋 Job Card: *${jobCardNumber}*`,
    ``,
    ...(customerPortalUrl
      ? [
          `View your invoice and service details:`,
          `🔗 ${customerPortalUrl}`,
          ``,
        ]
      : []),
    `Thank you for choosing *${businessName}*! ❤️`,
    `We look forward to serving you again.`,
  ];

  return lines.join("\n");
}
