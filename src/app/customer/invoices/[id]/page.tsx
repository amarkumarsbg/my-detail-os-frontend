"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useCustomerDashboardStore } from "@/store/customer-dashboard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, CheckCircle2, AlertCircle, ExternalLink, Download } from "lucide-react";
import Link from "next/link";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { apiGet } from "@/lib/api-client";
import { downloadInvoicePdfFile, type InvoicePdfOpts } from "@/lib/invoice-pdf";
import {
  buildTaxInvoicePrintHtml,
  formatInvoiceVehicleDetailsLine,
} from "@/lib/tax-invoice-format";
import { resolveMembershipInvoiceDetails } from "@/lib/membership-invoice";

function getTotalPaid(invoice: any): number {
  return (invoice.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  NEFT: "NEFT / Bank Transfer",
  WALLET: "Wallet",
};

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  ISSUED: "bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300",
};

type PublicInvoicePayload = {
  invoice: any;
  jobCard: any;
  vehicle?: {
    variant?: string;
    year?: number;
    fuelType?: string;
    color?: string;
    odometer?: number;
  } | null;
  businessSettings: any;
};

function buildPublicInvoicePdfOpts(
  data: PublicInvoicePayload,
  referralCode?: string
): InvoicePdfOpts {
  const { invoice, jobCard, vehicle, businessSettings } = data;
  const totalPaid =
    (invoice.payments ? invoice.payments.reduce((s: number, p: any) => s + p.amount, 0) : 0) +
    (invoice.walletAmountUsed || 0);
  const remainingBalance = Math.max(0, (invoice.grandTotal || 0) - totalPaid);
  const vehicleDetailsLine = formatInvoiceVehicleDetailsLine({
    variant: vehicle?.variant,
    year: vehicle?.year,
    fuelType: vehicle?.fuelType,
    color: vehicle?.color,
  });
  const odometerReading =
    invoice?.odometerReading != null && Number.isFinite(invoice.odometerReading)
      ? invoice.odometerReading
      : jobCard?.odometerReading != null && Number.isFinite(jobCard.odometerReading)
        ? jobCard.odometerReading
        : vehicle?.odometer;

  return {
    invoice,
    jobCard,
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    customerEmail: jobCard?.customerEmail ?? "",
    customerAddress: jobCard?.customerAddress ?? "",
    vehicleMakeModel: invoice.vehicleMakeModel || jobCard?.vehicleMakeModel || "—",
    vehicleDetailsLine: vehicleDetailsLine || undefined,
    odometerReading: odometerReading ?? undefined,
    business: {
      gstRegistrationStatus:
        businessSettings?.gstRegistrationStatus === "NOT_REGISTERED"
          ? "NOT_REGISTERED"
          : "REGISTERED",
      businessName: businessSettings?.businessName || "MY DETAIL OS",
      businessTagline: businessSettings?.businessTagline || "Car Wash & Detailing Studio",
      businessAddress:
        businessSettings?.businessAddress || "80 Feet Road, Koramangala, Bengaluru 560034",
      businessPhone: businessSettings?.businessPhone || "+91-80-4123-4567",
      businessWhatsApp: businessSettings?.businessWhatsApp || "+91-80-4123-4567",
      businessEmail: businessSettings?.businessEmail || "hello@mydetailos.com",
      businessWebsite: businessSettings?.businessWebsite || "www.mydetailos.com",
      gstin: businessSettings?.gstin || "29AABCT1234F1ZP",
      companyPan: businessSettings?.companyPan || "ABCDE1234F",
      bankName: businessSettings?.bankName || "",
      bankBranch: businessSettings?.bankBranch || "",
      bankAccountNumber: businessSettings?.bankAccountNumber || "",
      bankIfsc: businessSettings?.bankIfsc || "",
      bankUpi: businessSettings?.bankUpi || "",
    },
    payments: invoice.payments || [],
    totalPaid,
    remainingBalance,
    referralCode: referralCode || invoice.referralCodeUsed,
    referralRewardAmount: invoice.rewardDiscount || 0,
    newCustomerDiscount: invoice.discountAmount || 0,
    membershipId: invoice.membershipId,
    membershipPackageName: invoice.membershipPackageName,
    membershipDetails: resolveMembershipInvoiceDetails({ invoice }) ?? undefined,
  };
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { invoices, jobCards, customer } = useCustomerDashboardStore();
  const [downloading, setDownloading] = useState(false);

  const invoice = invoices.find((inv) => inv.id === id);

  if (!invoice) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl">
        <Link href="/customer/invoices">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Billing
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Invoice not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const paid = getTotalPaid(invoice);
  const outstanding = Math.max(0, (invoice.grandTotal || 0) - paid);
  const status = paid === 0 ? "ISSUED" : outstanding > 0.01 ? "PARTIALLY_PAID" : "PAID";
  const linkedJob = jobCards.find((j) => j.id === invoice.jobCardId);
  const publicInvoiceHref = `/public-invoice/${invoice.id}${
    customer?.referralCode ? `?ref=${encodeURIComponent(customer.referralCode)}` : ""
  }`;

  function openPrintFallback(opts: InvoicePdfOpts) {
    const html = buildTaxInvoicePrintHtml(opts, { includePrintScript: true });
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked. Allow pop-ups to save the invoice as PDF.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    toast.message("Use Print → Save as PDF if the file download is unavailable.");
  }

  async function handleDownloadPdf() {
    if (downloading) return;
    setDownloading(true);
    try {
      // Public endpoint — no staff/customer JWT required.
      const data = await apiGet<PublicInvoicePayload>(
        `/api/public/invoices/${encodeURIComponent(invoice!.id)}`
      );
      if (!data?.invoice) {
        throw new Error("Invoice details could not be loaded.");
      }
      const opts = buildPublicInvoicePdfOpts(
        data,
        customer?.referralCode || undefined
      );
      try {
        await downloadInvoicePdfFile(opts);
        toast.success("Invoice PDF downloaded");
      } catch (pdfErr) {
        console.error("[customer/invoices] server PDF failed, using print fallback", pdfErr);
        openPrintFallback(opts);
      }
    } catch (err) {
      console.error("[customer/invoices] PDF download failed", err);
      toast.error(err instanceof Error ? err.message : "Could not download the invoice PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      {/* Back + header */}
      <div>
        <Link href="/customer/invoices">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Billing
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {invoice.invoiceNumber}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatDate(invoice.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <Badge className={cn(STATUS_COLORS[status] || "")}>
              {status.replace(/_/g, " ")}
            </Badge>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => void handleDownloadPdf()}
              disabled={downloading}
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? "Downloading…" : "Download PDF"}
            </Button>
            <Link href={publicInvoiceHref} target="_blank">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                View Invoice
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Amount summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold mt-0.5">{formatCurrency(invoice.grandTotal || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold mt-0.5 text-green-600">{formatCurrency(paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Due</p>
            <p className={cn("text-lg font-bold mt-0.5", outstanding > 0 ? "text-red-600" : "text-green-600")}>
              {formatCurrency(outstanding)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding alert */}
      {outstanding > 0 && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-200">
              Payment pending: {formatCurrency(outstanding)}
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
              Please contact the workshop to settle the balance.
            </p>
          </div>
        </div>
      )}

      {/* Billing breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Billing Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(invoice.subtotal || 0)}</span>
          </div>
          {(invoice.taxAmount || 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST ({invoice.taxRate || 18}%)</span>
              <span>{formatCurrency(invoice.taxAmount || 0)}</span>
            </div>
          )}
          {(invoice.discountAmount || 0) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>−{formatCurrency(invoice.discountAmount || 0)}</span>
            </div>
          )}
          {(invoice.walletAmountUsed || 0) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Wallet used</span>
              <span>−{formatCurrency(invoice.walletAmountUsed || 0)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold border-t pt-2 mt-2">
            <span>Grand Total</span>
            <span>{formatCurrency(invoice.grandTotal || 0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payments received */}
      {(invoice.payments || []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Payments Received
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(invoice.payments as any[]).map((pmt) => (
              <div key={pmt.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{METHOD_LABEL[pmt.method] || pmt.method}</p>
                  {pmt.referenceNumber && (
                    <p className="text-xs text-muted-foreground">Ref: {pmt.referenceNumber}</p>
                  )}
                  {pmt.paidAt && (
                    <p className="text-xs text-muted-foreground">{formatDate(pmt.paidAt)}</p>
                  )}
                </div>
                <p className="text-sm font-semibold text-green-600">{formatCurrency(pmt.amount)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Vehicle */}
      {invoice.vehicleRegNumber && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {invoice.vehicleMakeModel && <p className="font-medium">{invoice.vehicleMakeModel}</p>}
            <p className="text-muted-foreground">{invoice.vehicleRegNumber}</p>
          </CardContent>
        </Card>
      )}

      {/* Linked job */}
      {linkedJob && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Service Job</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/customer/jobs/${linkedJob.id}`}>
              <div className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer">
                <div>
                  <p className="font-medium text-sm">{linkedJob.jobNumber}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {linkedJob.vehicleMakeModel} · {linkedJob.status.replace(/_/g, " ")}
                  </p>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
