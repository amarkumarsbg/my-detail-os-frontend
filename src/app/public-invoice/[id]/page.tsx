"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { buildTaxInvoicePrintHtml, formatInvoiceVehicleDetailsLine } from "@/lib/tax-invoice-format";
import { resolveMembershipInvoiceDetails } from "@/lib/membership-invoice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Printer,
  Download,
  CarFront,
  FileText,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Calendar,
  CreditCard,
  Car,
} from "lucide-react";

interface PublicInvoiceData {
  invoice: any;
  jobCard: any;
  vehicle?: {
    variant?: string;
    year?: number;
    fuelType?: string;
    color?: string;
    odometer?: number;
    make?: string;
    model?: string;
  } | null;
  businessSettings: any;
}

export default function PublicInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const customerRefCode = searchParams.get("ref") || undefined;

  const [data, setData] = useState<PublicInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiGet<PublicInvoiceData>(`/api/public/invoices/${id}`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Public invoice fetch error", err);
        setError("Invoice not found or failed to load");
        setLoading(false);
      });
  }, [id]);

  const previewHtml = useMemo(() => {
    if (!data) return "";
    const { invoice, jobCard, vehicle, businessSettings } = data;
    
    const totalPaid = (invoice.payments ? invoice.payments.reduce((s: number, p: any) => s + p.amount, 0) : 0) + (invoice.walletAmountUsed || 0);
    const remainingBalance = Math.max(0, invoice.grandTotal - totalPaid);

    const business = {
      gstRegistrationStatus:
        businessSettings?.gstRegistrationStatus === "NOT_REGISTERED"
          ? "NOT_REGISTERED"
          : "REGISTERED",
    } as const;

    const businessDetails = {
      ...business,
      businessName: businessSettings?.businessName || "MY DETAIL OS",
      businessTagline: businessSettings?.businessTagline || "Car Wash & Detailing Studio",
      businessAddress: businessSettings?.businessAddress || "80 Feet Road, Koramangala, Bengaluru 560034",
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
    };

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

    return buildTaxInvoicePrintHtml(
      {
        invoice,
        jobCard,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        customerEmail: jobCard?.customerEmail ?? "",
        customerAddress: jobCard?.customerAddress ?? "",
        vehicleMakeModel: invoice.vehicleMakeModel || jobCard?.vehicleMakeModel || "—",
        vehicleDetailsLine: vehicleDetailsLine || undefined,
        odometerReading: odometerReading ?? undefined,
        business: businessDetails,
        payments: invoice.payments || [],
        totalPaid,
        remainingBalance,
        referralCode: customerRefCode || invoice.referralCodeUsed,
        referralRewardAmount: invoice.rewardDiscount || 0,
        newCustomerDiscount: invoice.discountAmount || 0,
        membershipId: invoice.membershipId,
        membershipPackageName: invoice.membershipPackageName,
        membershipDetails: resolveMembershipInvoiceDetails({ invoice }) ?? undefined,
      },
      { includePrintScript: false }
    );
  }, [data]);

  const handlePrint = () => {
    const iframe = document.getElementById("invoice-iframe") as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-100 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
          </div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider animate-pulse mt-2">
            Loading secure document portal...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full shadow-xl border border-slate-100/80 rounded-2xl overflow-hidden">
          <div className="h-1.5 bg-rose-500 w-full" />
          <CardContent className="pt-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-500 shadow-inner">
              <FileText className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Invoice Unresolved</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              {error || "We couldn't retrieve the invoice details. Please contact support or request a new link."}
            </p>
            <Button className="w-full bg-slate-850 hover:bg-slate-900 text-white font-semibold h-10 rounded-xl" onClick={() => router.push("/")}>
              Return to Website
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invoice, jobCard, vehicle, businessSettings } = data;

  const totalPaid = (invoice.payments ? invoice.payments.reduce((s: number, p: any) => s + p.amount, 0) : 0) + (invoice.walletAmountUsed || 0);
  const isPaid = invoice.status === "PAID" || totalPaid >= invoice.grandTotal;
  const remainingBalance = Math.max(0, invoice.grandTotal - totalPaid);

  const businessName = businessSettings?.businessName || "MY DETAIL OS";
  const businessPhone = businessSettings?.businessPhone || "+91-80-4123-4567";
  const businessWhatsApp = businessSettings?.businessWhatsApp || "+91-80-4123-4567";
  const vehicleDetailsLine = formatInvoiceVehicleDetailsLine({
    variant: vehicle?.variant,
    year: vehicle?.year,
    fuelType: vehicle?.fuelType,
    color: vehicle?.color,
  });
  const odometerDisplay =
    invoice?.odometerReading != null
      ? invoice.odometerReading
      : jobCard?.odometerReading != null
        ? jobCard.odometerReading
        : vehicle?.odometer != null
          ? vehicle.odometer
          : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#fbfbfe] text-slate-800 antialiased relative overflow-hidden pb-12">
      {/* Decorative Radial Background Mesh */}
      <div className="absolute top-0 left-0 right-0 h-[480px] bg-gradient-to-tr from-indigo-100/30 via-violet-50/15 to-emerald-50/20 blur-3xl -z-10" />
      <div className="absolute top-[20%] left-[-100px] w-[350px] h-[350px] rounded-full bg-indigo-200/10 blur-3xl -z-10" />

      {/* Branded Glassmorphic Top Bar */}
      <header className="h-16 bg-white/70 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200/50">
            <CarFront className="w-5.5 h-5.5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-800 uppercase leading-none">
              {businessName}
            </span>
            <span className="text-[10px] text-indigo-600 font-bold tracking-wider uppercase mt-1">
              Customer Bill Pay
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-2 text-slate-700 border-slate-200 bg-white hover:bg-white hover:text-slate-800 shadow-sm rounded-lg"
            onClick={handlePrint}
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="inline">Print Invoice</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-2 text-slate-700 border-slate-200 bg-white hover:bg-white hover:text-slate-800 shadow-sm rounded-lg"
            onClick={handlePrint}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="inline">Download</span>
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Dynamic Widget Dashboard Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Card 1: Total Amount & Status */}
          <Card className="border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-shadow duration-300 rounded-xl">
            <CardContent className="p-3 sm:py-3 sm:px-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                isPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              }`}>
                <CreditCard className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total Due</p>
                <p className="text-lg font-black text-slate-800">
                  ₹{invoice.grandTotal.toLocaleString("en-IN")}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isPaid ? "bg-emerald-400" : "bg-amber-400"
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      isPaid ? "bg-emerald-500" : "bg-amber-500"
                    }`}></span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase">
                    {isPaid ? "Settled" : "Pending"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Vehicle details */}
          <Card className="border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-shadow duration-300 rounded-xl">
            <CardContent className="p-3 sm:py-3 sm:px-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner">
                <Car className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Vehicle</p>
                <p className="text-sm font-bold text-slate-800 truncate max-w-[150px]" title={jobCard?.vehicleMakeModel}>
                  {jobCard?.vehicleMakeModel || "Customer Vehicle"}
                </p>
                {vehicleDetailsLine ? (
                  <p className="text-[10px] text-slate-500 truncate max-w-[180px]">
                    {vehicleDetailsLine}
                  </p>
                ) : null}
                {odometerDisplay != null && (
                  <p className="text-[10px] text-slate-500 font-medium">
                    Odo: {odometerDisplay.toLocaleString("en-IN")} km
                  </p>
                )}
                {invoice.vehicleRegNumber && (
                  <div className="mt-1">
                    <span className="px-2 py-0.5 border border-slate-700/80 rounded font-mono text-[9px] bg-slate-900 text-amber-400 font-black tracking-wider uppercase inline-block shadow-sm">
                      {invoice.vehicleRegNumber}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Date & Details */}
          <Card className="border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-shadow duration-300 rounded-xl">
            <CardContent className="p-3 sm:py-3 sm:px-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 shadow-inner">
                <Calendar className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Billing Date</p>
                <p className="text-sm font-bold text-slate-800">
                  {new Date(invoice.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
                  Invoice #{invoice.invoiceNumber}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice PDF Frame Presentation */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_20px_50px_rgba(8,_112,_184,_0.04)] overflow-hidden">
          {/* SECURE HEADER BADGE BAR */}
          <div className="h-10 bg-slate-50 border-b border-slate-100 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Verified Secure Document</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            </div>
          </div>
          
          <div className="p-0.5 bg-slate-100/20">
            {previewHtml ? (
              <iframe
                id="invoice-iframe"
                title="Secure Invoice View"
                className="h-[min(85vh,900px)] w-full border-0 rounded-b-2xl bg-white"
                srcDoc={previewHtml}
              />
            ) : (
              <div className="p-16 text-center text-sm text-slate-400 flex flex-col items-center gap-3">
                <Clock className="w-6 h-6 text-slate-350 animate-spin" />
                <span>Loading secure billing details...</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto pt-8 text-center space-y-1">
        <p className="text-[11px] font-semibold text-slate-400">
          Thank you for trusting <span className="text-slate-500 font-bold">{businessName}</span>
        </p>
        <p className="text-[9px] text-slate-400 font-medium">
          Secure Customer Gateway · Encrypted Connection · Verified Safe
        </p>
      </footer>
    </div>
  );
}
