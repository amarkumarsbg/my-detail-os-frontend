import type { Invoice, InvoiceLineItem, JobCard, Payment } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { invoicePrintDocumentTitle } from "@/lib/invoice-source";
import QRCode from "qrcode-svg";

/** Default SAC for motor vehicle repair / maintenance services (demo). */
export const DEFAULT_SERVICE_HSN = "998714";

export const TAX_INVOICE_DISCLAIMER = `No detailing service is perfect. Most complaints arise from pre-existing conditions that become visible after cleaning. Our team is not liable for any mechanical or electrical issues revealed post-service. Sensitive areas (engine bay, infotainment, cameras) are avoided. Your presence during the service is required. Please remove all valuables before handover.
(a) GST invoice provided digitally. (b) Services subject to availability. (c) Advance is non-refundable on customer cancellation. (d) Pickup/visit charges: Rs. 200 min + Rs. 10/km beyond 10 km.
This is a computer-generated document. No signature required.  |  Quality Never Goes Out of Cost — MY DETAIL OS`;

export function escapeHtml(s: string | number | null | undefined): string {
  const text = s == null ? "" : String(s);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function splitCgstSgst(taxAmount: number): { cgst: number; sgst: number } {
  const half = taxAmount / 2;
  return { cgst: half, sgst: half };
}

/**
 * Normalize GST rate to a fraction (e.g. 0.18).
 * Seed/demo data sometimes stores percent (18); app create paths store 0.18.
 */
export function taxRateAsFraction(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return rate > 1 ? rate / 100 : rate;
}

/** Human-readable GST percent label, e.g. "18%". */
export function taxRateAsPercentLabel(rate: number): string {
  return `${Math.round(taxRateAsFraction(rate) * 100)}%`;
}

export function gstHalfPercentLabel(taxRate: number): string {
  return `${Math.round(taxRateAsFraction(taxRate) * 50)}%`;
}

/** List / MRP style rate before line discount (falls back to line total when no line discount). */
export function lineRateDisplay(li: InvoiceLineItem): number {
  const d = li.lineDiscount ?? 0;
  return li.total + d;
}

function lineQuantityDisplay(li: InvoiceLineItem): string {
  const qty = Number.isFinite(li.quantity) ? li.quantity : 0;
  return Number.isInteger(qty)
    ? qty.toLocaleString("en-IN")
    : qty.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function splitServiceAndDescription(raw: string | null | undefined): {
  service: string;
  description: string;
} {
  const text = String(raw ?? "").replace(/\r/g, "").trim();
  if (!text) return { service: "—", description: "—" };

  const lineBreakAt = text.indexOf("\n");
  if (lineBreakAt > -1) {
    const service = text.slice(0, lineBreakAt).trim() || "—";
    const description = text.slice(lineBreakAt + 1).trim() || "—";
    return { service, description };
  }

  for (const sep of [" — ", " - ", " : "]) {
    const idx = text.indexOf(sep);
    if (idx > -1) {
      const service = text.slice(0, idx).trim() || "—";
      const description = text.slice(idx + sep.length).trim() || "—";
      return { service, description };
    }
  }

  return { service: text, description: "—" };
}

function serviceDisplayLines(service: string): string[] {
  return service
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function lineGrandWithTax(
  li: InvoiceLineItem,
  invoice: Invoice
): number {
  if (invoice.subtotal <= 0) return li.total;
  return li.total + (invoice.taxAmount * li.total) / invoice.subtotal;
}

/** Net value before GST (matches line subtotal minus invoice-level reductions). */
export function netTaxableForDisplay(invoice: Invoice): number {
  return invoice.grandTotal - invoice.taxAmount;
}

/** Sum of invoice discount, rewards, referral, wallet (derived so it ties to totals). */
export function additionalDiscountTotal(invoice: Invoice): number {
  return invoice.subtotal - invoice.grandTotal + invoice.taxAmount;
}

export interface TaxInvoiceBusinessBlock {
  gstRegistrationStatus?: "REGISTERED" | "NOT_REGISTERED";
  businessName: string;
  businessTagline: string;
  businessAddress: string;
  businessPhone: string;
  businessWhatsApp: string;
  businessEmail: string;
  businessWebsite: string;
  gstin: string;
  companyPan: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankUpi: string;
}

/** Compact vehicle meta for invoice header (e.g. "EX · 2026 · Diesel · Blue"). */
export function formatInvoiceVehicleDetailsLine(parts: {
  variant?: string | null;
  year?: number | string | null;
  fuelType?: string | null;
  color?: string | null;
}): string {
  const bits: string[] = [];
  const variant = parts.variant?.trim();
  if (variant) bits.push(variant);
  if (parts.year != null && String(parts.year).trim() !== "") {
    bits.push(String(parts.year).trim());
  }
  const fuel = parts.fuelType?.trim();
  if (fuel) {
    bits.push(
      fuel.toUpperCase() === "CNG"
        ? "CNG"
        : fuel.charAt(0).toUpperCase() + fuel.slice(1).toLowerCase()
    );
  }
  const color = parts.color?.trim();
  if (color && color !== "—") bits.push(color);
  return bits.join(" · ");
}

export type TaxInvoiceDocumentOpts = {
  invoice: Invoice;
  jobCard: JobCard | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerWhatsApp?: string;
  vehicleMakeModel: string;
  /** Variant · year · fuel · color under vehicle name */
  vehicleDetailsLine?: string;
  /** Odometer at service time (km) */
  odometerReading?: number;
  business: TaxInvoiceBusinessBlock;
  payments: Payment[];
  totalPaid: number;
  remainingBalance: number;
  /** Shown in booking details; default Visit Outlet */
  serviceModeLabel?: string;
  /** Referral promo block (matches on-screen invoice) */
  referralCode?: string;
  referralRewardAmount?: number;
  newCustomerDiscount?: number;
  /** Active membership subscription id for this customer/vehicle (Bill To). */
  membershipId?: string;
  /** Optional package name shown next to membership id. */
  membershipPackageName?: string;
  /** Dedicated Membership Details block (membership invoices only). */
  membershipDetails?: {
    packageName: string;
    validFrom: string;
    validUntil: string;
    vehicleName: string;
    vehicleRegNumber: string;
    membershipId: string;
  };
};

export function numberToWords(amount: number): string {
  const num = Math.floor(amount);
  if (num === 0) return "Zero Rupees Only";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function g(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
  }

  function h(n: number): string {
    let out = "";
    if (n >= 100) {
      out += a[Math.floor(n / 100)] + " Hundred";
      n %= 100;
      if (n > 0) out += " and ";
    }
    if (n > 0) {
      out += g(n);
    }
    return out;
  }

  let temp = num;
  let words = "";

  // Crore
  if (temp >= 10000000) {
    words += h(Math.floor(temp / 10000000)) + " Crore ";
    temp %= 10000000;
  }
  // Lakh
  if (temp >= 100000) {
    words += h(Math.floor(temp / 100000)) + " Lakh ";
    temp %= 100000;
  }
  // Thousand
  if (temp >= 1000) {
    words += h(Math.floor(temp / 1000)) + " Thousand ";
    temp %= 1000;
  }
  // Hundreds & tens
  if (temp > 0) {
    words += h(temp);
  }

  return words.trim() + " Rupees Only";
}

export function buildTaxInvoicePrintHtml(
  opts: TaxInvoiceDocumentOpts,
  options?: { includePrintScript?: boolean }
): string {
  const {
    invoice,
    jobCard,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerWhatsApp,
    vehicleMakeModel,
    vehicleDetailsLine = "",
    odometerReading,
    business,
    payments,
    totalPaid,
    remainingBalance,
    serviceModeLabel = "Visit Outlet",
    referralCode,
    referralRewardAmount = 0,
    newCustomerDiscount = 0,
    membershipId,
    membershipPackageName,
    membershipDetails,
  } = opts;
  const vehicleDetailsTrimmed = vehicleDetailsLine.trim();
  const odometerLabel =
    odometerReading != null && Number.isFinite(odometerReading)
      ? `${Math.round(odometerReading).toLocaleString("en-IN")} km`
      : "";

  const isGstRegistered = business.gstRegistrationStatus !== "NOT_REGISTERED";
  const isDedicatedMembershipInvoice = invoice.source === "MEMBERSHIP";
  const displayTaxRate = isGstRegistered ? invoice.taxRate : 0;
  const displayTaxAmount = isGstRegistered ? invoice.taxAmount : 0;
  const displayGrandTotal = isGstRegistered
    ? invoice.grandTotal
    : Math.max(0, invoice.grandTotal - invoice.taxAmount);
  const displayTotalPaid = Math.max(0, Math.min(totalPaid, displayGrandTotal));
  const displayBalanceDue = Math.max(
    0,
    Math.round((displayGrandTotal - displayTotalPaid) * 100) / 100
  );
  const { cgst, sgst } = splitCgstSgst(displayTaxAmount);

  // Generate UPI QR Code SVG if a UPI ID is configured.
  const rawUpi = business.bankUpi?.trim();
  const isUpiConfigured = rawUpi && rawUpi.length > 0 && !rawUpi.includes("[UPI ID");

  let qrCodeSvgHtml = "";
  if (isUpiConfigured) {
    try {
      let upiContent = `upi://pay?pa=${encodeURIComponent(rawUpi)}&pn=${encodeURIComponent(business.businessName.trim())}&cu=INR`;
      if (displayBalanceDue > 0) {
        upiContent += `&am=${displayBalanceDue.toFixed(2)}`;
      }
      const qr = new QRCode({
        content: upiContent,
        padding: 0,
        width: 80,
        height: 80,
        container: "svg-viewbox",
        join: true,
        xmlDeclaration: false,
        pretty: false,
      });
      qrCodeSvgHtml = qr.svg();
    } catch (err) {
      console.error("[tax-invoice-format] Failed to generate QR code SVG", err);
    }
  }
  const gstPct = Math.round(displayTaxRate * 100);
  const bookingRef = jobCard?.jobNumber ?? invoice.jobNumber;
  const bookingWhen = jobCard?.createdAt
    ? formatDateTime(jobCard.createdAt)
    : formatDateTime(invoice.createdAt);
  const expectedDel = jobCard?.expectedDelivery
    ? formatDate(jobCard.expectedDelivery)
    : "—";
  const dash = (value: string) => {
    const t = value.trim();
    return t ? escapeHtml(t) : "—";
  };
  const membershipDetailsHtml = membershipDetails
    ? `<div class="membership-details">
    <h4>Membership Details</h4>
    <div class="membership-details-grid">
      <div>
        <div class="lbl">Package</div>
        <div class="val">${dash(membershipDetails.packageName)}</div>
      </div>
      <div>
        <div class="lbl">Valid From</div>
        <div class="val">${membershipDetails.validFrom ? escapeHtml(formatDate(membershipDetails.validFrom)) : "—"}</div>
      </div>
      <div>
        <div class="lbl">Valid Until</div>
        <div class="val">${membershipDetails.validUntil ? escapeHtml(formatDate(membershipDetails.validUntil)) : "—"}</div>
      </div>
      <div>
        <div class="lbl">Vehicle</div>
        <div class="val" style="text-transform:capitalize;">${dash(membershipDetails.vehicleName)}</div>
      </div>
      <div>
        <div class="lbl">Vehicle Number</div>
        <div class="val" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${dash(membershipDetails.vehicleRegNumber)}</div>
      </div>
      <div>
        <div class="lbl">Membership ID</div>
        <div class="val" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${dash(membershipDetails.membershipId)}</div>
      </div>
    </div>
  </div>`
    : "";
  const taxable = displayGrandTotal - displayTaxAmount;
  const termsText = TAX_INVOICE_DISCLAIMER;
  const notesText =
    [invoice.notes, jobCard?.notes, invoice.termsAndConditions, jobCard?.termsAndConditions]
      .filter((x): x is string => Boolean(x && x.trim()))
      .join("\n\n") || undefined;
  const termsList = [
    "No detailing service is perfect. Complaints often arise from pre-existing conditions visible post-cleaning.",
    "We are not liable for mechanical/electrical issues revealed after the service.",
    "Sensitive areas (engine bay, screen, cameras) are avoided; customer presence is required.",
    "Please remove all valuables before handover.",
    isGstRegistered
      ? "GST invoices are provided digitally. Services are subject to availability."
      : "Invoices are provided digitally. Services are subject to availability.",
    "Advance payment is non-refundable upon customer cancellation.",
    "Pickup/visit charges: Rs. 200 minimum + Rs. 10/km beyond 10 km.",
    "This is a computer-generated document. No signature is required."
  ];

  const termsHtml = `<ul style="margin: 4px 0 0 12px; padding: 0; list-style-type: disc; text-align: left; color: #525252; font-size: 8px; line-height: 1.45;">` +
    termsList.map(item => `<li style="margin-bottom: 2px;">${escapeHtml(item)}</li>`).join("") +
    `</ul>`;

  const notesHtml = notesText
    ? `<div style="margin-top: 8px; border-top: 1px dashed #d4d4d4; padding-top: 6px;">` +
      `<strong style="color: #404040; font-size: 8.5px; display: block; margin-bottom: 3px;">NOTES & SPECIAL INSTRUCTIONS</strong>` +
      `<ul style="margin: 0 0 0 12px; padding: 0; list-style-type: circle; text-align: left; color: #525252; font-size: 8px; line-height: 1.45;">` +
      notesText.split("\n").filter(line => line.trim()).map(line => `<li style="margin-bottom: 2px;">${escapeHtml(line)}</li>`).join("") +
      `</ul></div>`
    : "";

  const referralTrim = referralCode?.trim();
  const referralBlockHtml =
    referralTrim
      ? `<div class="referral-box">
  <p class="ref-title">YOUR REFERRAL CODE</p>
  <p class="ref-code">${escapeHtml(referralTrim)}</p>
  <p class="ref-note">Share this code with friends. When they book their <strong>first service</strong> using your code, they receive <span class="ref-save">${formatCurrency(newCustomerDiscount)}</span> and you receive <span class="ref-earn">${formatCurrency(referralRewardAmount)}</span> in your wallets.</p>
</div>`
      : "";

  const lineRows = (() => {
    let renderedRowNumber = 0;
    return (
      invoice.lineItems
        .map((li) => {
          const { service, description } = splitServiceAndDescription(li.description);
          const serviceLines = serviceDisplayLines(service);
          const hsn = li.hsnSac ?? DEFAULT_SERVICE_HSN;
          const disc = li.lineDiscount ?? 0;
          const lineTaxShare =
            invoice.subtotal > 0 ? (displayTaxAmount * li.total) / invoice.subtotal : 0;
          const gTot = li.total + lineTaxShare;
          const discCell =
            disc > 0
              ? li.description.includes("Membership benefit")
                ? `<span class="disc-lbl">Membership</span><br>${formatCurrency(disc)}`
                : formatCurrency(disc)
              : "—";

          return serviceLines
            .map((line, serviceIndex) => {
              renderedRowNumber += 1;
              const isFirstServiceRow = serviceIndex === 0;
              return `<tr>
        <td class="c">${renderedRowNumber}</td>
        <td class="svc">
          <div style="font-weight:600; color:#171717;">${escapeHtml(line)}</div>
        </td>
        <td class="desc">
          <div style="color:#404040;">${isFirstServiceRow ? escapeHtml(description) : "—"}</div>
        </td>
        <td class="c">${isFirstServiceRow ? lineQuantityDisplay(li) : "—"}</td>
        ${isGstRegistered ? `<td class="c">${isFirstServiceRow ? escapeHtml(hsn) : "—"}</td>` : ""}
        <td class="r">${isFirstServiceRow ? formatCurrency(lineRateDisplay(li)) : "—"}</td>
        <td class="r">${isFirstServiceRow ? discCell : "—"}</td>
        <td class="r">${isFirstServiceRow ? formatCurrency(li.total) : "—"}</td>
        ${isGstRegistered ? `<td class="c">${isFirstServiceRow ? `${gstPct}%` : "—"}</td>` : ""}
        <td class="r b">${isFirstServiceRow ? formatCurrency(gTot) : "—"}</td>
      </tr>`;
            })
            .join("");
        })
        .join("") ?? ""
    );
  })();

  const payRows =
    payments.length > 0
      ? payments
          .map(
            (p) => `<div class="pay-row"><span>${formatDateTime(p.paidAt)} · ${escapeHtml(p.method)}${p.referenceNumber ? ` · ${escapeHtml(p.referenceNumber)}` : ""}</span><span>${formatCurrency(p.amount)}</span></div>`
          )
          .join("")
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${invoicePrintDocumentTitle(invoice, isGstRegistered)} ${escapeHtml(invoice.invoiceNumber)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
@page { margin: 8mm; size: A4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Outfit', system-ui, sans-serif; font-size: 10.5px; color: #171717; background: #fafafa; line-height: 1.4; padding: 20px 0; }
.wrap { max-width: 800px; margin: 0 auto; padding: 24px; border: 1.5px solid #3b82f6; background: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border-radius: 8px; }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
.brand-row { display: flex; align-items: center; gap: 16px; min-width: 0; }
.brand-logo {
  width: 56px;
  height: 56px;
  min-width: 56px;
  min-height: 56px;
  max-width: 56px;
  max-height: 56px;
  flex-shrink: 0;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  border: 2px solid #3b82f6;
  display: block;
  overflow: hidden;
}
.brand-text { min-width: 0; }
.metadata-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin: 16px 0; padding: 10px 12px; border-top: 1.5px solid #3b82f6; border-bottom: 1.5px solid #3b82f6; background: #eff6ff; border-radius: 2px; }
.metadata-bar.membership { grid-template-columns: repeat(2, 1fr); }
.metadata-item div:first-child { color: #737373; font-weight: 500; text-transform: uppercase; font-size: 8px; margin-bottom: 2px; letter-spacing: 0.5px; }
.metadata-item > div:nth-child(2) { font-weight: 700; color: #171717; font-size: 10px; }
.metadata-item .vehicle-meta { font-weight: 500; color: #525252; font-size: 8.5px; margin-top: 2px; line-height: 1.35; text-transform: none; }
.membership-details { border: 1px solid #d4d4d4; border-radius: 4px; padding: 10px 12px; margin-bottom: 12px; background: #fafafa; }
.membership-details h4 { font-size: 9.5px; font-weight: 700; color: #3b82f6; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
.membership-details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
.membership-details-grid .lbl { color: #737373; font-size: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
.membership-details-grid .val { font-weight: 700; color: #171717; font-size: 10px; }
.bill-to { margin-bottom: 16px; font-size: 10px; }
.bill-to h3 { font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
table.inv { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; border: 1px solid #d4d4d4; }
table.inv th { background: #f1f5f9; border: 1px solid #d4d4d4; padding: 8px 6px; font-weight: 700; text-align: center; color: #1e3a8a; text-transform: uppercase; font-size: 9px; }
table.inv th.svc, table.inv th.desc { text-align: left; }
table.inv td { border: 1px solid #e5e5e5; padding: 8px 6px; vertical-align: top; color: #262626; }
table.inv tbody tr:nth-child(even) { background: #fafafa; }
table.inv td.svc, table.inv td.desc { text-align: left; }
table.inv .c { text-align: center; }
table.inv .r { text-align: right; font-variant-numeric: tabular-nums; }
table.inv .b { font-weight: 700; color: #171717; }
.footer-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 16px; margin-top: 12px; }
.box { border: 1px solid #d4d4d4; border-radius: 4px; overflow: hidden; background: #ffffff; }
.box h3 { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; margin: 0; padding: 6px 10px; color: #fff; background: #404040; text-transform: uppercase; }
.box-inner { padding: 8px 10px; }
.box p { font-size: 9.5px; color: #404040; margin-bottom: 4px; line-height: 1.45; }
.box .lbl { color: #737373; font-size: 8.5px; width: 80px; display: inline-block; }
.tot { font-size: 10px; padding: 10px; border-radius: 4px; background: #fafafa; border: 1px solid #d4d4d4; }
.tot-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e5e5e5; color: #404040; }
.tot-row span:last-child { font-weight: 600; color: #171717; }
.tot-row.grand { font-weight: 700; font-size: 11.5px; border: 1px solid #3b82f6; margin-top: 4px; padding: 6px 8px; border-radius: 3px; background: #eff6ff; color: #1e3a8a !important; }
.tot-row.grand span { color: #1e3a8a !important; }
.tot-row.balance { font-weight: 700; color: #b45309; }
.disclaimer { font-size: 8px; color: #737373; line-height: 1.5; white-space: pre-wrap; margin-top: 10px; padding: 8px; border: 1px solid #e5e5e5; border-radius: 4px; background: #fafafa; }
.disclaimer strong { color: #404040; font-size: 9px; display: block; margin-bottom: 2px; }
.pay-block { margin-top: 8px; font-size: 9px; padding: 8px; border-radius: 4px; background: #fafafa; border: 1px dashed #3b82f6; color: #404040; }
.pay-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #d4d4d4; }
.referral-box { margin-top: 10px; padding: 10px; border: 1px solid #d4d4d4; border-radius: 4px; background: #eff6ff; text-align: center; }
.ref-title { font-size: 8px; font-weight: 700; letter-spacing: 0.06em; color: #3b82f6; margin-bottom: 4px; text-transform: uppercase; }
.ref-code { font-size: 16px; font-weight: 700; font-family: monospace; letter-spacing: 0.08em; color: #171717; margin-bottom: 4px; }
.ref-note { font-size: 8.5px; color: #525252; line-height: 1.4; max-width: 550px; margin: 0 auto; }
@media (max-width: 640px) {
  body { padding: 8px 0; font-size: 10px; }
  .wrap { padding: 14px 12px; border-radius: 6px; margin: 0 4px; }
  .top { flex-direction: column; gap: 10px; }
  .brand-row { gap: 10px; align-items: flex-start; }
  .brand-logo {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    max-width: 44px;
    max-height: 44px;
  }
  .brand-name { font-size: 16px !important; }
  .brand-sub { font-size: 9px !important; }
  .invoice-title-block { align-items: flex-start !important; height: auto !important; text-align: left !important; }
  .invoice-title-block .doc-title { font-size: 14px !important; }
  .metadata-bar { grid-template-columns: 1fr 1fr; gap: 8px; }
  .membership-details-grid { grid-template-columns: 1fr 1fr; }
  .bill-booking-row { flex-direction: column !important; gap: 12px !important; }
  .footer-grid { grid-template-columns: 1fr; }
  table.inv { font-size: 9px; }
  table.inv th, table.inv td { padding: 6px 4px; }
}
@media print {
  body { background: #ffffff; padding: 0 !important; font-size: 8.5px !important; line-height: 1.25 !important; }
  .wrap { box-shadow: none; border: 1.2px solid #3b82f6 !important; padding: 12px 16px !important; }
  .top { margin-bottom: 6px !important; }
  .brand-logo { width: 48px !important; height: 48px !important; min-width: 48px !important; min-height: 48px !important; }
  .metadata-bar { margin: 8px 0 !important; padding: 6px 8px !important; gap: 4px !important; }
  .metadata-item div:first-child { font-size: 7px !important; margin-bottom: 1px !important; }
  .metadata-item div:last-child { font-size: 8.5px !important; }
  .bill-to { margin-bottom: 8px !important; font-size: 8.5px !important; }
  .bill-to h3 { font-size: 9px !important; margin-bottom: 2px !important; }
  table.inv { margin-bottom: 6px !important; }
  table.inv th { padding: 4px 3px !important; font-size: 8px !important; }
  table.inv td { padding: 4px 3px !important; font-size: 8.5px !important; }
  .footer-grid { gap: 10px !important; margin-top: 6px !important; }
  .box { margin-top: 5px !important; }
  .box h3 { padding: 3px 6px !important; font-size: 8px !important; }
  .box-inner { padding: 4px 6px !important; }
  .box p { font-size: 8.5px !important; margin-bottom: 2px !important; }
  .box .lbl { font-size: 7.5px !important; width: 65px !important; }
  .tot { padding: 6px !important; }
  .tot-row { padding: 2.5px 0 !important; }
  .tot-row.grand { font-size: 9.5px !important; padding: 4px 6px !important; margin-top: 2px !important; }
  .disclaimer { font-size: 7.5px !important; padding: 5px !important; margin-top: 0 !important; }
  .disclaimer strong { font-size: 8px !important; }
  .referral-box { margin-top: 6px !important; padding: 6px !important; }
  .ref-title { font-size: 7px !important; margin-bottom: 2px !important; }
  .ref-code { font-size: 12px !important; margin-bottom: 2px !important; }
  .ref-note { font-size: 8px !important; }
  .pay-block { margin-top: 6px !important; padding: 6px !important; }
  .pay-row { padding: 2px 0 !important; }
}
</style></head><body>
<div class="wrap">
  <div class="top">
    <div class="brand-row">
      <svg class="brand-logo" width="56" height="56" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <!-- Background rect element so color is printed even when print background graphics settings is unchecked -->
        <rect x="0" y="0" width="100" height="100" fill="#1e3a8a"/>
        <circle cx="50" cy="50" r="44" fill="none" stroke="#3b82f6" stroke-width="1.2" stroke-dasharray="3 3"/>
        <path d="M 72 26 L 73.5 28 L 75.5 28.5 L 73.5 29 L 72 31 L 70.5 29 L 68.5 28.5 L 70.5 28 Z" fill="#3b82f6"/>
        <path d="M 24 74 L 25 75 L 26.5 75.3 L 25 75.6 L 24 77 L 23 75.6 L 21.5 75.3 L 23 75 Z" fill="#38bdf8"/>
        <!-- Sleek Sports Car outline -->
        <path d="M 22 51 C 28 44, 36 39, 48 38 C 54 32, 66 32, 74 38 C 82 40, 85 45, 87 51 L 13 51 Z" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="32" cy="51" r="5" fill="#1e3a8a" stroke="#38bdf8" stroke-width="1.5"/>
        <circle cx="68" cy="51" r="5" fill="#1e3a8a" stroke="#38bdf8" stroke-width="1.5"/>
        <path d="M 8 56 L 92 56" stroke="#3b82f6" stroke-width="1" opacity="0.6"/>
        <text x="50" y="82" fill="#3b82f6" font-size="8.5" font-family="'Outfit', sans-serif" font-weight="800" text-anchor="middle" letter-spacing="1.5">PRIME</text>
      </svg>
      <div class="brand-text">
        <div class="brand-name" style="font-size: 22px; font-weight: 700; color: #1e3a8a; letter-spacing: -0.5px;">${escapeHtml(business.businessName)}</div>
        <div class="brand-sub" style="font-size: 10px; font-weight: 500; color: #3b82f6; letter-spacing: 0.5px; margin-top: 1px;">${escapeHtml(business.businessTagline)}</div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 9px; color: #525252; margin-top: 6px; font-weight: 500;">
          <span style="display: flex; align-items: center; gap: 3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11"/></svg>${escapeHtml(business.businessPhone)}</span>
          <span style="display: flex; align-items: center; gap: 3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>${escapeHtml(business.businessEmail)}</span>
          <span style="display: flex; align-items: center; gap: 3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>${escapeHtml(business.businessAddress.split(',').slice(0, 3).join(','))}</span>
        </div>
      </div>
    </div>
    <div class="invoice-title-block" style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; height: 56px;">
      <div class="doc-title" style="font-size: 20px; font-weight: 700; color: #1e3a8a; letter-spacing: 1.5px; text-transform: uppercase;">${
        invoicePrintDocumentTitle(invoice, isGstRegistered)
      }</div>
      <div style="font-size: 8.5px; font-weight: 600; color: #3b82f6; border: 1px solid #3b82f6; padding: 3px 6px; border-radius: 3px; background: #eff6ff; text-transform: uppercase; letter-spacing: 0.5px;">Original for Recipient</div>
    </div>
  </div>

  <div class="metadata-bar${isDedicatedMembershipInvoice && membershipDetails ? " membership" : ""}">
    <div class="metadata-item">
      <div>Invoice No.</div>
      <div>${escapeHtml(invoice.invoiceNumber)}</div>
    </div>
    <div class="metadata-item">
      <div>Invoice Date</div>
      <div>${escapeHtml(formatDate(invoice.createdAt))}</div>
    </div>
    ${
      isDedicatedMembershipInvoice && membershipDetails
        ? ""
        : `<div class="metadata-item">
      <div>Due Date</div>
      <div>${escapeHtml(expectedDel)}</div>
    </div>
    <div class="metadata-item">
      <div>Vehicle Name</div>
      <div>
        <div style="text-transform: capitalize;">${escapeHtml(vehicleMakeModel)}</div>
        ${
          vehicleDetailsTrimmed
            ? `<div class="vehicle-meta">${escapeHtml(vehicleDetailsTrimmed)}</div>`
            : ""
        }
      </div>
    </div>
    <div class="metadata-item">
      <div>Vehicle Number</div>
      <div style="font-family: monospace;">${escapeHtml(invoice.vehicleRegNumber)}</div>
    </div>
    ${
      odometerLabel
        ? `<div class="metadata-item">
      <div>Odometer</div>
      <div>${escapeHtml(odometerLabel)}</div>
    </div>`
        : ""
    }`
    }
  </div>

  <div class="bill-booking-row" style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 12px;">
    <div class="bill-to" style="flex: 1.25;">
      <h3>Bill To</h3>
      <div style="font-size: 13px; font-weight: 700; color: #0b1329; margin-bottom: 4px;">${escapeHtml(customerName)}</div>
      <p><span style="color:#737373;">Mobile:</span> <strong>${escapeHtml(customerPhone)}</strong></p>
      ${customerWhatsApp ? `<p><span style="color:#737373;">WhatsApp:</span> <strong>${escapeHtml(customerWhatsApp)}</strong></p>` : ""}
      ${customerEmail ? `<p><span style="color:#737373;">Email:</span> <strong>${escapeHtml(customerEmail)}</strong></p>` : ""}
      ${customerAddress ? `<p><span style="color:#737373;">Address:</span> <strong>${escapeHtml(customerAddress)}</strong></p>` : ""}
      ${
        membershipDetails && isGstRegistered
          ? `<p><span style="color:#737373;">GSTIN:</span> <strong>${escapeHtml(business.gstin)}</strong></p>`
          : ""
      }
      ${
        membershipId && !membershipDetails
          ? `<p><span style="color:#737373;">Membership ID:</span> <strong style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${escapeHtml(membershipId)}</strong>${
              membershipPackageName
                ? ` <span style="color:#737373; font-weight:500;">(${escapeHtml(membershipPackageName)})</span>`
                : ""
            }</p>`
          : ""
      }
    </div>
    ${
      isDedicatedMembershipInvoice && membershipDetails
        ? ""
        : `<div style="flex: 1; border: 1px solid #d4d4d4; border-radius: 4px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; background: #fafafa;">
      <h4 style="font-size: 9.5px; font-weight: 700; color: #3b82f6; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px;">Booking Details</h4>
      <p style="font-size: 9.5px; color: #404040; margin-bottom: 2px;"><span style="color:#737373; font-size:8.5px; width:100px; display:inline-block;">Booking Ref:</span> <strong>${escapeHtml(bookingRef)}</strong></p>
      <p style="font-size: 9.5px; color: #404040; margin-bottom: 2px;"><span style="color:#737373; font-size:8.5px; width:100px; display:inline-block;">Booking Date:</span> <strong>${escapeHtml(bookingWhen)}</strong></p>
      <p style="font-size: 9.5px; color: #404040; margin-bottom: 2px;"><span style="color:#737373; font-size:8.5px; width:100px; display:inline-block;">Service Mode:</span> <strong>${escapeHtml(serviceModeLabel)}</strong></p>
      ${isGstRegistered ? `<p style="font-size: 9.5px; color: #404040;"><span style="color:#737373; font-size:8.5px; width:100px; display:inline-block;">GSTIN:</span> <strong>${escapeHtml(business.gstin)}</strong></p>` : ""}
    </div>`
    }
  </div>

  ${membershipDetailsHtml}

  <table class="inv">
    <thead>
      <tr>
        <th style="width:28px">#</th>
        <th class="svc" style="width:210px">Service</th>
        <th class="desc">Description</th>
        <th style="width:52px">Qty</th>
        ${isGstRegistered ? `<th style="width:52px">HSN/SAC</th>` : ""}
        <th style="width:72px">Rate (Rs.)</th>
        <th style="width:64px">Discount</th>
        <th style="width:72px">Price</th>
        ${isGstRegistered ? `<th style="width:44px">GST %</th>` : ""}
        <th style="width:80px">G-Total</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="footer-grid">
    <div>
      <div class="disclaimer" style="margin-top: 0;">
        <strong>DISCLAIMER & TERMS</strong>
        ${termsHtml}${notesHtml}
      </div>
      
      <div class="box" style="margin-top: 10px;">
        <h3>BANK DETAILS</h3>
        <div class="box-inner">
          <p><span class="lbl">Bank Name:</span> <strong>${escapeHtml(business.bankName)}</strong></p>
          <p><span class="lbl">Branch:</span> <strong>${escapeHtml(business.bankBranch)}</strong></p>
          <p><span class="lbl">Account No:</span> <strong>${escapeHtml(business.bankAccountNumber)}</strong></p>
          <p><span class="lbl">IFSC Code:</span> <strong>${escapeHtml(business.bankIfsc)}</strong></p>
          <p><span class="lbl">UPI / PayTM:</span> <strong>${escapeHtml(business.bankUpi)}</strong></p>
        </div>
      </div>

      ${isUpiConfigured ? `
      <div class="box" style="margin-top: 10px; display: flex; align-items: center; gap: 12px; padding: 10px; border: 1.5px solid #3b82f6; border-radius: 4px; background: #eff6ff;">
        <div style="width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; background: #fff; padding: 4px; border: 1px solid #3b82f6; border-radius: 4px; shrink-0;">
          ${qrCodeSvgHtml}
        </div>
        <div style="flex: 1;">
          <h4 style="font-size: 11px; font-weight: 700; color: #0b1329; margin-bottom: 4px;">Payment QR Code</h4>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
            <!-- PhonePe Official SVG Logo -->
            <span style="display: inline-flex; align-items: center; gap: 3px; vertical-align: middle;">
              <svg viewBox="0 0 512 512" width="14" height="14" style="display: block;">
                <circle cx="-25.926" cy="41.954" r="29.873" fill="#5f259f" transform="rotate(-76.714 -48.435 5.641) scale(8.56802)"/>
                <path d="M372.164 189.203c0-10.008-8.576-18.593-18.584-18.593h-34.323l-78.638-90.084c-7.154-8.577-18.592-11.439-30.03-8.577l-27.17 8.577c-4.292 1.43-5.723 7.154-2.862 10.007l85.8 81.508H136.236c-4.293 0-7.154 2.861-7.154 7.154v14.292c0 10.016 8.585 18.592 18.592 18.592h20.015v68.639c0 51.476 27.17 81.499 72.931 81.499 14.292 0 25.739-1.431 40.03-7.146v45.753c0 12.87 10.016 22.886 22.885 22.886h20.015c4.293 0 8.577-4.293 8.577-8.586V210.648h32.893c4.292 0 7.145-2.861 7.145-7.145v-14.3zM280.65 312.17c-8.576 4.292-20.015 5.723-28.591 5.723-22.886 0-34.324-11.438-34.324-37.176v-68.639h62.915v100.092z" fill="#fff" fill-rule="nonzero"/>
              </svg>
              <span style="color: #5f259f; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 9.5px; line-height: 1; letter-spacing: -0.2px;">PhonePe</span>
            </span>

            <!-- Paytm Official SVG Logo -->
            <svg viewBox="0 0 122.88 38.52" width="42" height="13" style="display: inline-block; vertical-align: middle;">
              <g>
                <path d="M122.47,11.36c-1.12-3.19-4.16-5.48-7.72-5.48h-0.08c-2.32,0-4.41,0.97-5.9,2.52 c-1.49-1.55-3.58-2.52-5.9-2.52h-0.07c-2.04,0-3.91,0.75-5.34,1.98V7.24c-0.05-0.63-0.56-1.12-1.2-1.12h-5.48 c-0.67,0-1.21,0.54-1.21,1.21v29.74c0,0.67,0.54,1.21,1.21,1.21h5.48c0.61,0,1.12-0.46,1.19-1.04l0-21.35c0-0.08,0-0.14,0.01-0.21 c0.09-0.95,0.79-1.74,1.89-1.83h1.01c0.46,0.04,0.85,0.2,1.15,0.45c0.48,0.38,0.74,0.96,0.74,1.6l0.02,21.24 c0,0.67,0.54,1.22,1.21,1.22h5.48c0.65,0,1.17-0.51,1.2-1.15l0-21.33c0-0.7,0.32-1.34,0.89-1.71c0.28-0.18,0.62-0.3,1.01-0.34h1.01 c1.19,0.1,1.9,1,1.9,2.05l0.02,21.22c0,0.67,0.54,1.21,1.21,1.21h5.48c0.64,0,1.17-0.5,1.21-1.13V13.91 C122.86,12.6,122.69,11.99,122.47,11.36L122.47,11.36z M85.39,6.2h-3.13V1.12c0-0.01,0-0.01,0-0.02C82.26,0.5,81.77,0,81.15,0 c-0.07,0-0.14,0.01-0.21,0.02c-3.47,0.95-2.78,5.76-9.12,6.17h-0.61c-0.09,0-0.18,0.01-0.27,0.03h-0.01l0.01,0 C70.41,6.35,70,6.83,70,7.41v5.48c0,0.67,0.54,1.21,1.21,1.21h3.3l-0.01,23.22c0,0.66,0.54,1.2,1.2,1.2h5.42 c0.66,0,1.2-0.54,1.2-1.2l0-23.22h3.07c0.66,0,1.21-0.55,1.21-1.21V7.41C86.6,6.74,86.06,6.2,85.39,6.2L85.39,6.2z" fill="#00BAF2"/>
                <path d="M65.69,6.2h-5.48C59.55,6.2,59,6.74,59,7.41v11.33c-0.01,0.7-0.58,1.26-1.28,1.26h-2.29 c-0.71,0-1.29-0.57-1.29-1.28L54.12,7.41c0-0.67-0.54-1.21-1.21-1.21h-5.48c-0.67,0-1.21,0.54-1.21,1.21v12.41 c0,4.71,3.36,8.08,8.08,8.08c0,0,3.54,0,3.65,0.02c0.64,0.07,1.13,0.61,1.13,1.27c0,0.65-0.48,1.19-1.12,1.27 c-0.03,0-0.06,0.01-0.09,0.02l-8.01,0.03c-0.67,0-1.21,0.54-1.21,1.21v5.47c0,0.67,0.54,1.21,1.21,1.21h8.95 c4.72,0,8.08-3.36,8.08-8.07V7.41C66.9,6.74,66.36,6.2,65.69,6.2L65.69,6.2z M34.53,6.23h-7.6c-0.67,0-1.22,0.51-1.22,1.13v2.13 c0,0.01,0,0.03,0,0.04c0,0.02,0,0.03,0,0.05v2.92c0,0.66,0.58,1.21,1.29,1.21h7.24c0.57,0.09,1.02,0.51,1.09,1.16v0.71 c-0.06,0.62-0.51,1.07-1.06,1.12h-3.58c-4.77,0-8.16,3.17-8.16,7.61v6.37c0,4.42,2.92,7.56,7.65,7.56h9.93 c1.78,0,3.23-1.35,3.23-3.01V14.45C43.34,9.41,40.74,6.23,34.53,6.23L34.53,6.23z M35.4,29.09v0.86c0,0.07-0.01,0.14-0.02,0.2 c-0.01,0.06-0.03,0.12-0.05,0.18c-0.17,0.48-0.65,0.83-1.22,0.83h-2.28c-0.71,0-1.29-0.54-1.29-1.21v-1.03c0-0.01,0-0.03,0-0.04 l0-2.75v-0.86l0-0.01c0-0.66,0.58-1.2,1.29-1.2h2.28c0.71,0,1.29,0.54,1.29,1.21V29.09L35.4,29.09z M13.16,6.19H1.19 C0.53,6.19,0,6.73,0,7.38v5.37c0,0.01,0,0.02,0,0.03c0,0.03,0,0.05,0,0.07v24.29c0,0.66,0.49,1.2,1.11,1.21h5.58 c0.67,0,1.21-0.54,1.21-1.21l0.02-8.32h5.24c4.38,0,7.44-3.04,7.44-7.45v-7.72C20.6,9.25,17.54,6.19,13.16,6.19L13.16,6.19z M12.68,16.23v3.38c0,0.71-0.57,1.29-1.28,1.29l-3.47,0v-6.77h3.47c0.71,0,1.28,0.57,1.28,1.28V16.23L12.68,16.23z" fill="#20336B"/>
              </g>
            </svg>
            <!-- UPI Official SVG Logo -->
            <svg viewBox="0 0 122.88 45.88" width="40" height="15" style="display: inline-block; vertical-align: middle;">
              <g>
                <polygon points="114.56,0.06 122.88,16.61 105.38,33.17 107.46,25.66 117.03,16.61 112.48,7.56 114.56,0.06" fill="#0E8635" fill-rule="evenodd" clip-rule="evenodd"/>
                <polygon points="108.71,0.06 117.03,16.61 99.52,33.17 108.71,0.06" fill="#E97208" fill-rule="evenodd" clip-rule="evenodd"/>
                <path d="M1.28,39.45h0.97l-0.9,3.75c-0.13,0.56-0.11,0.98,0.08,1.26c0.18,0.28,0.53,0.42,1.03,0.42 c0.5,0,0.9-0.14,1.22-0.42c0.32-0.28,0.54-0.7,0.68-1.26l0.9-3.75h0.98L5.31,43.3c-0.2,0.84-0.56,1.46-1.07,1.88 c-0.51,0.42-1.18,0.62-2.01,0.62c-0.83,0-1.4-0.21-1.71-0.62c-0.31-0.41-0.36-1.04-0.16-1.88L1.28,39.45L1.28,39.45z M94.04,33.03 h-6.58L96.61,0h6.58L94.04,33.03L94.04,33.03z M39.34,30.96c-0.36,1.3-1.56,2.22-2.91,2.22H2.5c-0.93,0-1.62-0.32-2.07-0.94 c-0.45-0.63-0.55-1.41-0.28-2.34L8.42,0.09l6.58,0L7.62,26.72h26.33l7.39-26.63l6.58,0L39.34,30.96L39.34,30.96L39.34,30.96z M90.63,1.04c-0.45-0.63-1.16-0.94-2.11-0.94l-36.17,0l-1.78,6.48l32.9,0l-1.92,6.91H55.22v-0.02h-6.58l-5.46,19.72l6.58,0 l3.66-13.23h29.58c0.93,0,1.8-0.31,2.61-0.94c0.81-0.63,1.35-1.41,1.6-2.34l3.66-13.23C91.17,2.46,91.08,1.67,90.63,1.04 L90.63,1.04L90.63,1.04z M117.8,45.63l1.48-6.18h3.36l-0.2,0.85h-2.38l-0.37,1.55h2.38l-0.21,0.88h-2.38l-0.48,2h2.38l-0.21,0.9 H117.8L117.8,45.63z M117.7,40.95c-0.22-0.24-0.47-0.42-0.75-0.54c-0.28-0.12-0.59-0.18-0.93-0.18c-0.66,0-1.25,0.22-1.76,0.65 c-0.52,0.43-0.86,1-1.02,1.69c-0.16,0.67-0.09,1.22,0.21,1.65c0.3,0.43,0.75,0.65,1.37,0.65c0.36,0,0.71-0.07,1.06-0.2 c0.35-0.13,0.71-0.33,1.07-0.59l-0.27,1.14c-0.31,0.19-0.63,0.34-0.96,0.43s-0.68,0.14-1.04,0.14c-0.46,0-0.87-0.08-1.22-0.23 c-0.35-0.15-0.64-0.38-0.87-0.68c-0.22-0.29-0.37-0.64-0.43-1.04c-0.06-0.4-0.04-0.83,0.07-1.28s0.29-0.88,0.54-1.28 c0.25-0.4,0.57-0.75,0.94-1.05c0.37-0.3,0.77-0.53,1.19-0.69c0.42-0.16,0.86-0.23,1.31-0.23c0.35,0,0.68,0.05,0.97,0.16 s0.57,0.27,0.82,0.48L117.7,40.95L117.7,40.95z M110.29,45.63l-0.3-1.59h-2.39l-1.08,1.59h-1.03l4.46-6.43l1.38,6.43H110.29 L110.29,45.63z M108.16,43.2h1.68l-0.28-1.41c-0.01-0.09-0.03-0.19-0.04-0.31s-0.02-0.25-0.02-0.39c-0.07,0.13-0.13,0.26-0.2,0.38c-0.06,0.12-0.13,0.22-0.19,0.32L108.16,43.2L108.16,43.2z M102.19,45.63l1.48-6.18h3.36l-0.2,0.85h-2.38l-0.37,1.54h2.38l-0.21,0.88h-2.38l-0.7,2.91H102.19L102.19,45.63z M99.04,42.87l-0.66,2.77h-0.92l1.48-6.18h1.37c0.4,0,0.7,0.03,0.91,0.08 c0.21,0.05,0.38,0.14,0.5,0.27c0.15,0.15,0.25,0.34,0.29,0.58c0.04,0.24,0.03,0.5-0.03,0.78c-0.12,0.5-0.33,0.88-0.63,1.16 c-0.3,0.28-0.69,0.45-1.15,0.5l1.4,2.81h-1.11l-1.34-2.77H99.04L99.04,42.87z M99.29,42.08h0.18c0.52,0,0.88-0.06,1.08-0.19 c0.2-0.12,0.34-0.34,0.41-0.66c0.08-0.34,0.05-0.58-0.1-0.72c-0.15-0.14-0.47-0.21-0.96-0.21h-0.18L99.29,42.08L99.29,42.08z M92.98,45.63l1.48-6.18h3.36l-0.2,0.85h-2.38l-0.37,1.55h2.38l-0.21,0.88h-2.38l-0.48,2h2.38l-0.22,0.9H92.98L92.98,45.63z M91.91,40.3l-1.28,5.33h-0.98l1.28-5.33h-1.6l0.2-0.85h4.17l-0.2,0.85H91.91L91.91,40.3z M81.92,45.63l1.54-6.43l2.92,3.78 c0.08,0.11,0.16,0.22,0.23,0.34c0.08,0.12,0.16,0.26,0.24,0.41l1.03-4.29h0.91l-1.54,6.42l-2.99-3.85 c-0.08-0.1-0.15-0.21-0.22-0.33c-0.07-0.12-0.13-0.24-0.19-0.36l-1.03,4.3H81.92L81.92,45.63z M79.53,45.63l1.48-6.18h0.98 l-1.48,6.18H79.53L79.53,45.63z M72.29,44.39l0.87-0.37c0.01,0.28,0.09,0.49,0.26,0.63c0.16,0.14,0.4,0.22,0.71,0.22 c0.29,0,0.54-0.08,0.75-0.25s0.35-0.39,0.42-0.67c0.09-0.36-0.13-0.69-0.65-0.97c-0.07-0.04-0.13-0.07-0.17-0.09 c-0.58-0.33-0.96-0.63-1.11-0.9c-0.16-0.27-0.19-0.6-0.09-0.99c0.12-0.5,0.38-0.91,0.79-1.22c0.41-0.31,0.88-0.47,1.42-0.47 c0.44,0,0.79,0.09,1.05,0.26c0.26,0.18,0.4,0.43,0.44,0.76l-0.86,0.41c-0.08-0.19-0.17-0.34-0.3-0.43 c-0.12-0.09-0.28-0.13-0.46-0.13c-0.26,0-0.49,0.07-0.68,0.21c-0.19,0.14-0.31,0.33-0.37,0.57c-0.09,0.37,0.17,0.72,0.77,1.04 c0.05,0.03,0.08,0.04,0.11,0.06c0.53,0.28,0.87,0.56,1.03,0.83c0.16,0.27,0.19,0.6,0.09,1.01c-0.14,0.59-0.43,1.05-0.87,1.4 c-0.44,0.34-0.97,0.52-1.58,0.52c-0.51,0-0.91-0.12-1.17-0.36C72.42,45.19,72.29,44.85,72.29,44.39L72.29,44.39z M71.27,40.3 L70,45.63h-0.98l1.28-5.33h-1.6l0.21-0.85h4.17l-0.2,0.85H71.27L71.27,40.3z M61.28,45.63l1.54-6.43l2.92,3.78 c0.08,0.11,0.16,0.22,0.23,0.34c0.08,0.12,0.16,0.26,0.24,0.41l1.03-4.29h0.91l-1.54,6.42l-2.99-3.85 c-0.08-0.1-0.15-0.21-0.22-0.33c-0.07-0.12-0.13-0.24-0.19-0.36l-1.03,4.3H61.28L61.28,45.63z M56.79,45.63l1.48-6.18h3.36 l-0.2,0.85h-2.38l-0.37,1.55h2.38l-0.21,0.88h-2.38l-0.48,2h2.38l-0.22,0.9H56.79L56.79,45.63z M55.16,42.58 c0-0.05,0.01-0.18,0.04-0.4c0.02-0.18,0.04-0.33,0.05-0.45c-0.06,0.14-0.13,0.28-0.21,0.42c-0.08,0.14-0.17,0.28-0.27,0.43 l-2.37,3.29l-0.77-3.36c-0.03-0.14-0.06-0.27-0.07-0.4c-0.02-0.13-0.03-0.26-0.03-0.38c-0.03,0.13-0.08,0.26-0.13,0.41 c-0.05,0.14-0.11,0.29-0.19,0.45l-1.38,3.04h-0.9l2.97-6.45l0.84,3.9c0.01,0.06,0.03,0.17,0.05,0.31c0.02,0.14,0.05,0.32,0.08,0.53 c0.1-0.18,0.24-0.4,0.43-0.68c0.05-0.07,0.09-0.13,0.11-0.17l2.67-3.9l-0.09,6.45H55.1L55.16,42.58L55.16,42.58z M45.82,45.63 l0.68-2.83l-1.23-3.35h1.03l0.76,2.1c0.02,0.05,0.04,0.13,0.06,0.21c0.02,0.09,0.05,0.18,0.07,0.28c0.06-0.1,0.13-0.19,0.19-0.28 s0.13-0.17,0.19-0.24l1.79-2.07h0.98l-2.88,3.35l-0.68,2.83H45.82L45.82,45.63z M43.38,45.63l-0.3-1.59h-2.39l-1.08,1.59h-1.03 l4.46-6.43l1.38,6.43H43.38L43.38,45.63z M41.25,43.2h1.68l-0.28-1.41c-0.01-0.09-0.03-0.19-0.04-0.31 c-0.01-0.12-0.02-0.25-0.02-0.39c-0.06,0.13-0.13,0.26-0.2,0.38c-0.06,0.12-0.13,0.22-0.19,0.32L41.25,43.2L41.25,43.2z M36.96,42.86l-0.66,2.78h-0.92l1.48-6.18h1.48c0.44,0,0.76,0.02,0.95,0.07c0.19,0.05,0.36,0.13,0.48,0.24 c0.15,0.14,0.26,0.34,0.3,0.58c0.05,0.24,0.04,0.51-0.03,0.8c-0.07,0.29-0.19,0.56-0.35,0.81c-0.17,0.25-0.36,0.44-0.58,0.58 c-0.18,0.11-0.38,0.19-0.6,0.24s-0.55,0.07-0.99,0.07H36.96L36.96,42.86z M37.21,42.03h0.25c0.54,0,0.92-0.06,1.13-0.18 c0.21-0.12,0.35-0.33,0.43-0.64c0.08-0.33,0.04-0.56-0.12-0.7s-0.5-0.2-1.02-0.2h-0.25L37.21,42.03L37.21,42.03z M26.59,45.63 l1.48-6.18h1.32c0.86,0,1.45,0.04,1.78,0.13c0.33,0.09,0.6,0.24,0.81,0.45c0.28,0.27,0.46,0.62,0.54,1.05 c0.08,0.43,0.05,0.92-0.08,1.47c-0.13,0.55-0.34,1.04-0.62,1.46s-0.63,0.77-1.04,1.05c-0.31,0.21-0.65,0.36-1.01,0.45 c-0.36,0.09-0.89,0.13-1.6,0.13H26.59L26.59,45.63z M27.79,44.72h0.82c0.45,0,0.8-0.03,1.04-0.09c0.24-0.06,0.46-0.17,0.67-0.31 c0.28-0.2,0.51-0.45,0.69-0.75c0.19-0.3,0.33-0.64,0.42-1.04c0.09-0.39,0.12-0.74,0.08-1.04c-0.04-0.3-0.15-0.55-0.33-0.75 c-0.14-0.15-0.31-0.25-0.54-0.31c-0.22-0.06-0.59-0.09-1.09-0.09h-0.71L27.79,44.72L27.79,44.72z M22.1,45.63l1.48-6.18h3.36 l-0.2,0.85h-2.38l-0.37,1.55h2.38l-0.21,0.88h-2.38l-0.48,2h2.38l-0.22,0.9H22.1L22.1,45.63z M19.71,45.63l1.48-6.18h0.98 l-1.48,6.18H19.71L19.71,45.63z M15.27,45.63l1.48-6.18h3.36l-0.2,0.85h-2.38l-0.37,1.54h2.38l-0.21,0.88h-2.38l-0.7,2.91H15.27 L15.27,45.63z M12.89,45.63l1.48-6.18h0.98l-1.48,6.18H12.89L12.89,45.63z M6.1,45.63l1.54-6.43l2.92,3.78 c0.08,0.11,0.16,0.22,0.23,0.34c0.08,0.12,0.16,0.26,0.24,0.41l1.03-4.29h0.91l-1.54,6.42l-2.98-3.85 c-0.08-0.1-0.15-0.21-0.22-0.33c-0.07-0.12-0.13-0.24-0.19-0.36L7,45.63H6.1L6.1,45.63z" fill="#66686C"/>
              </g>
            </svg>
          </div>
          <p style="font-size: 8px; color: #737373; font-family: monospace; word-break: break-all; margin-bottom: 2px;">UPI ID: ${escapeHtml(rawUpi)}</p>
          ${remainingBalance > 0
            ? `<p style="font-size: 9.5px; font-weight: 700; color: #171717;">Pay Amount: ${formatCurrency(Math.round(remainingBalance))}</p>`
            : `<p style="font-size: 9.5px; font-weight: 700; color: #171717;">Scan to Pay Custom Amount</p>`
          }
        </div>
      </div>` : ""}
    </div>

    <div>
      <div class="tot">
        <div class="tot-row"><span>Sub-Total:</span><span>${formatCurrency(invoice.subtotal)}</span></div>
        ${(invoice.discountAmount || 0) > 0 ? `<div class="tot-row"><span>Flat Discount:</span><span>- ${formatCurrency(invoice.discountAmount || 0)}</span></div>` : ""}
        ${(invoice.rewardDiscount || 0) > 0 ? `<div class="tot-row"><span>Reward Points Discount:</span><span>- ${formatCurrency(invoice.rewardDiscount || 0)}</span></div>` : ""}
        ${(invoice.referralDiscount || 0) > 0 ? `<div class="tot-row"><span>Referral Discount:</span><span>- ${formatCurrency(invoice.referralDiscount || 0)}</span></div>` : ""}
        ${isGstRegistered ? `<div class="tot-row"><span>Taxable Amount:</span><span>${formatCurrency(taxable)}</span></div>` : ""}
        ${isGstRegistered ? `<div class="tot-row cgst"><span>CGST (${gstHalfPercentLabel(displayTaxRate)}):</span><span>${formatCurrency(cgst)}</span></div>` : ""}
        ${isGstRegistered ? `<div class="tot-row sgst"><span>SGST (${gstHalfPercentLabel(displayTaxRate)}):</span><span>${formatCurrency(sgst)}</span></div>` : ""}
        <div class="tot-row grand"><span>GRAND TOTAL:</span><span>${formatCurrency(displayGrandTotal)}</span></div>
        ${displayTotalPaid > 0 && displayBalanceDue > 0.01 ? `<div class="tot-row"><span>Advance Paid:</span><span>${formatCurrency(displayTotalPaid)}</span></div>` : ""}
        <div class="tot-row balance"><span>Balance Due:</span><span>${formatCurrency(displayBalanceDue)}</span></div>
      </div>

      <div style="margin-top: 10px; padding: 8px 10px; border: 1px solid #d4d4d4; border-radius: 4px; background: #fafafa; font-size: 9px;">
        <span style="color:#737373; font-weight: 500; text-transform: uppercase; font-size: 7.5px; display: block; margin-bottom: 2px; letter-spacing: 0.5px;">Total Amount (in words)</span>
        <span style="font-weight: 700; color: #171717;">${numberToWords(Math.round(displayGrandTotal))}</span>
      </div>

      <div style="margin-top: 14px; border: 1px solid #d4d4d4; border-radius: 4px; padding: 12px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #ffffff;">
        <svg width="120" height="40" viewBox="0 0 120 40" style="margin-bottom: 4px;">
          <path d="M 15 28 C 35 12, 45 4, 55 18 C 65 32, 70 36, 85 14 C 95 6, 105 14, 100 26 C 95 34, 110 20, 115 18" fill="none" stroke="#0b1329" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #737373;">Authorized Signatory</div>
        <div style="font-size: 9px; font-weight: 700; color: #0b1329; margin-top: 2px;">${escapeHtml(business.businessName)}</div>
      </div>
    </div>
  </div>

  ${payments.length > 0 ? `<div class="pay-block"><strong>Payments</strong>${payRows}</div>` : ""}

  ${referralBlockHtml}
</div>
${options?.includePrintScript !== false ? '<script>window.onload=function(){window.print();}</script>' : ""}
</body></html>`;
}

/** Short HTML body for customer email — full invoice is attached as PDF. */
export function buildInvoiceEmailHtml(opts: {
  customerName: string;
  invoiceNumber: string;
  businessName: string;
  invoiceLabel?: string;
  grandTotal: number;
  remainingBalance: number;
  vehicleRegNumber: string;
  attachmentFilename: string;
}): string {
  const {
    customerName,
    invoiceNumber,
    businessName,
    invoiceLabel = "Tax Invoice",
    grandTotal,
    remainingBalance,
    vehicleRegNumber,
    attachmentFilename,
  } = opts;
  const balanceNote =
    remainingBalance > 0
      ? `<p style="margin:0 0 12px;color:#404040;">Balance due: <strong>${formatCurrency(remainingBalance)}</strong></p>`
      : `<p style="margin:0 0 12px;color:#166534;">This invoice is paid in full. Thank you!</p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Segoe UI,system-ui,sans-serif;font-size:14px;color:#171717;line-height:1.5;margin:0;padding:24px;">
<p style="margin:0 0 12px;">Dear ${escapeHtml(customerName)},</p>
<p style="margin:0 0 12px;color:#404040;">Please find your ${escapeHtml(invoiceLabel.toLowerCase())} <strong>${escapeHtml(invoiceNumber)}</strong> from <strong>${escapeHtml(businessName)}</strong> attached to this email.</p>
<p style="margin:0 0 8px;color:#404040;">Vehicle: <strong>${escapeHtml(vehicleRegNumber)}</strong></p>
<p style="margin:0 0 8px;color:#404040;">Grand total: <strong>${formatCurrency(grandTotal)}</strong></p>
${balanceNote}
<p style="margin:0 0 16px;padding:12px 14px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:6px;color:#262626;">
  <strong>Download your invoice:</strong> Open the attachment <strong>${escapeHtml(attachmentFilename)}</strong> to view, save, or print the full invoice document.
</p>
<p style="margin:0;color:#737373;font-size:12px;">If you have questions, reply to this email or contact ${escapeHtml(businessName)}.</p>
</body></html>`;
}
