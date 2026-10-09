import {
  buildTaxInvoicePrintHtml,
  type TaxInvoiceDocumentOpts,
} from "@/lib/tax-invoice-format";
import { sendInvoiceEmail } from "@/lib/invoice-email-send";
import {
  getStoredPdfAttachment,
  persistInvoicePdf,
} from "@/lib/invoice-pdf-storage";
import { requireCanExportData } from "@/lib/assert-can-export";

export type InvoicePdfOpts = TaxInvoiceDocumentOpts;

type ClientPdfEntry = { content: string; filename: string };
const clientPdfCache = new Map<string, ClientPdfEntry>();
const prefetchInflight = new Map<string, Promise<ClientPdfEntry | null>>();

export function invoicePdfFilename(
  invoiceNumber: string,
  gstRegistrationStatus: "REGISTERED" | "NOT_REGISTERED" = "REGISTERED"
): string {
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "_").slice(0, 48);
  const prefix = gstRegistrationStatus === "NOT_REGISTERED" ? "Invoice" : "Tax-Invoice";
  return `${prefix}-${safe}.pdf`;
}

/** Stable key so repeat emails reuse the cached PDF when the invoice unchanged. */
export function buildInvoicePdfCacheKey(opts: InvoicePdfOpts): string {
  const inv = opts.invoice;
  const lines = (inv.lineItems ?? [])
    .map((l) => `${l.id}:${l.total}:${l.unitPrice}`)
    .join(",");
  const pays = (inv.payments ?? opts.payments ?? [])
    .map((p) => `${p.id}:${p.amount}`)
    .join(",");
  const gstMode = opts.business.gstRegistrationStatus ?? "REGISTERED";
  const mem = opts.membershipDetails;
  return `${inv.id}:${inv.grandTotal}:${inv.subtotal}:${inv.taxAmount}:${inv.status}:${gstMode}:${lines}:${pays}:${mem?.membershipId ?? ""}:${mem?.validFrom ?? ""}:${mem?.vehicleName ?? ""}:${opts.vehicleDetailsLine ?? ""}:${opts.odometerReading ?? ""}`;
}

function buildPrintHtml(opts: InvoicePdfOpts): string {
  return buildTaxInvoicePrintHtml(opts, { includePrintScript: false });
}

/** Fire-and-forget: warm Chrome + build PDF while user views the invoice. */
export function warmInvoicePdfEngine(): void {
  void fetch("/api/invoice/warm").catch(() => undefined);
}

async function fetchPrintQualityPdfBase64(
  html: string,
  cacheKey: string
): Promise<string> {
  const res = await fetch("/api/invoice/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, cacheKey }),
  });

  let payload: { content?: string; error?: string };
  try {
    payload = (await res.json()) as { content?: string; error?: string };
  } catch {
    throw new Error(`PDF generation failed (${res.status})`);
  }

  if (!res.ok || !payload.content) {
    throw new Error(payload.error ?? `PDF generation failed (${res.status})`);
  }

  return payload.content;
}

async function savePdfToDatabase(
  opts: InvoicePdfOpts,
  cacheKey: string,
  filename: string,
  content: string,
  persistToDb = true
): Promise<void> {
  clientPdfCache.set(cacheKey, { content, filename });
  if (!persistToDb) return;
  try {
    await persistInvoicePdf(opts.invoice.id, {
      filename,
      contentBase64: content,
      cacheKey,
    });
  } catch (e) {
    console.warn("[invoice-pdf] could not persist PDF to database", e);
  }
}

/** Prefetch PDF and save to database (call when invoice page loads). */
export function prefetchInvoicePdf(opts: InvoicePdfOpts): void {
  const cacheKey = buildInvoicePdfCacheKey(opts);
  const stored = getStoredPdfAttachment(opts.invoice, cacheKey);
  if (stored) {
    clientPdfCache.set(cacheKey, stored);
    return;
  }
  if (clientPdfCache.has(cacheKey) || prefetchInflight.has(cacheKey)) return;

  const html = buildPrintHtml(opts);
  const filename = invoicePdfFilename(opts.invoice.invoiceNumber, opts.business.gstRegistrationStatus);

  const task = fetchPrintQualityPdfBase64(html, cacheKey)
    .then(async (content) => {
      const entry = { content, filename };
      await savePdfToDatabase(opts, cacheKey, filename, content);
      return entry;
    })
    .catch(() => null)
    .finally(() => {
      prefetchInflight.delete(cacheKey);
    });

  prefetchInflight.set(cacheKey, task);
}

/** Resolve PDF: database → memory → generate and save. */
export async function ensureInvoicePdfAttachment(
  opts: InvoicePdfOpts,
  options?: { persistToDb?: boolean }
): Promise<{
  filename: string;
  content: string;
}> {
  const persistToDb = options?.persistToDb !== false;
  const cacheKey = buildInvoicePdfCacheKey(opts);
  const filename = invoicePdfFilename(opts.invoice.invoiceNumber, opts.business.gstRegistrationStatus);

  const fromDb = getStoredPdfAttachment(opts.invoice, cacheKey);
  if (fromDb) {
    clientPdfCache.set(cacheKey, fromDb);
    return fromDb;
  }

  const mem = clientPdfCache.get(cacheKey);
  if (mem) return mem;

  const inflight = prefetchInflight.get(cacheKey);
  if (inflight) {
    const entry = await inflight;
    if (entry) return entry;
  }

  const html = buildPrintHtml(opts);
  const content = await fetchPrintQualityPdfBase64(html, cacheKey);
  await savePdfToDatabase(opts, cacheKey, filename, content, persistToDb);
  return { filename, content };
}

/**
 * PDF attachment for download — same layout and engine as Print → Save as PDF.
 */
export async function buildInvoicePdfAttachment(
  opts: InvoicePdfOpts,
  options?: { persistToDb?: boolean }
): Promise<{
  filename: string;
  content: string;
}> {
  return ensureInvoicePdfAttachment(opts, options);
}

/** Trigger a browser file download from a generated invoice PDF (no export-lock check). */
export async function downloadInvoicePdfFile(
  opts: InvoicePdfOpts,
  options?: { persistToDb?: boolean }
): Promise<void> {
  // Customer/public downloads must not wait on staff invoice-store persistence.
  const { filename, content } = await buildInvoicePdfAttachment(opts, {
    persistToDb: options?.persistToDb ?? false,
  });
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  // Some browsers ignore click() unless the anchor is in the document.
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in Chrome/Safari.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/** Staff/workshop download — blocked when subscription export is locked. */
export async function downloadInvoicePdf(opts: InvoicePdfOpts): Promise<void> {
  requireCanExportData();
  await downloadInvoicePdfFile(opts, { persistToDb: true });
}

/**
 * Email invoice: uses PDF from database when available (fastest), else generates once and saves.
 */
export async function sendInvoiceEmailWithPdf(params: {
  pdfOpts: InvoicePdfOpts;
  to: string;
  subject: string;
  emailHtml: string;
  text?: string;
}): Promise<void> {
  const attachment = await ensureInvoicePdfAttachment(params.pdfOpts);
  await sendInvoiceEmail({
    to: params.to,
    subject: params.subject,
    html: params.emailHtml,
    text: params.text,
    attachments: [
      { filename: attachment.filename, content: attachment.content },
    ],
  });
}
