"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import type { SubscriptionBillRow } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatPaymentStatus } from "@/lib/subscription-export-lock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";

function paymentStatusVariant(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  switch (status) {
    case "PAID": return "default";
    case "PENDING": return "secondary";
    case "PROCESSING": return "secondary";
    case "FAILED": return "destructive";
    default: return "outline";
  }
}

function openSubscriptionBillPrint(bill: SubscriptionBillRow & { organizationName?: string }) {
  const orgName = bill.organizationName ?? "Business";
  const formatAmt = (n: number | null | undefined) =>
    n != null ? formatCurrency(n) : "—";
  const html = `<!DOCTYPE html><html><head><title>${bill.billNumber}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a}
  h1{font-size:20px;margin:0 0 8px}
  .muted{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  td{padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
  td:first-child{color:#64748b;width:44%}
  .total td{font-weight:600;font-size:15px;border-top:2px solid #0f172a;padding-top:12px}
  .foot{margin-top:28px;font-size:12px;color:#64748b}
</style></head><body>
  <h1>Subscription Bill</h1>
  <p class="muted">${bill.billNumber} &middot; ${orgName}</p>
  <table>
    <tr><td>Plan</td><td>${bill.planName}</td></tr>
    <tr><td>Term</td><td>${bill.termLabel} (${bill.termMonths} months)</td></tr>
    <tr><td>Period start</td><td>${formatDate(bill.periodStart)}</td></tr>
    <tr><td>Expiry / period end</td><td><strong>${formatDate(bill.periodEnd)}</strong></td></tr>
    <tr><td>Base subscription</td><td>${formatAmt(bill.baseAmount)}</td></tr>
    ${bill.extraBranchCost ? `<tr><td>Extra branches</td><td>${formatAmt(bill.extraBranchCost)}</td></tr>` : ""}
    ${bill.extraUserCost ? `<tr><td>Extra users</td><td>${formatAmt(bill.extraUserCost)}</td></tr>` : ""}
    ${bill.onboardingFee ? `<tr><td>Onboarding fee</td><td>${formatAmt(bill.onboardingFee)}</td></tr>` : ""}
    ${bill.referralDiscount ? `<tr><td>Referral discount</td><td>- ${formatAmt(bill.referralDiscount)}</td></tr>` : ""}
    <tr><td>GST (${bill.gstPercent ?? 18}%)</td><td>${formatAmt(bill.gstAmount)}</td></tr>
    <tr class="total"><td>Total amount</td><td>${formatAmt(bill.totalAmount ?? bill.amount)} ${bill.currency}</td></tr>
  </table>
  <table style="margin-top:16px">
    <tr><td>Payment status</td><td>${formatPaymentStatus(bill.paymentStatus)}</td></tr>
    ${bill.txnReference ? `<tr><td>Transaction reference</td><td>${bill.txnReference}</td></tr>` : ""}
    <tr><td>Issued on</td><td>${formatDate(bill.createdAt)}</td></tr>
  </table>
  <p class="foot">This receipt covers SaaS subscription access for the term above. Business data is retained after expiry; exports may be locked until renewal.</p>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Allow pop-ups to download the bill");
    return;
  }
  w.document.write(html);
  w.document.close();
}

export function SubscriptionBillsSection({ refreshKey = 0 }: { refreshKey?: number }) {
  const [bills, setBills] = useState<SubscriptionBillRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<{ bills: SubscriptionBillRow[] }>(
          "/api/organization/subscription/bills"
        );
        if (!cancelled) setBills(data.bills ?? []);
      } catch {
        if (!cancelled) setBills([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading subscription bills…</p>;
  }

  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No subscription bills yet. Bills are generated after a payment is verified.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2.5">Bill #</th>
            <th className="px-3 py-2.5">Date</th>
            <th className="px-3 py-2.5">Plan</th>
            <th className="px-3 py-2.5">Term</th>
            <th className="px-3 py-2.5">Expires</th>
            <th className="px-3 py-2.5 text-right">Amount</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {bills.map((b) => (
            <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2.5 font-mono text-xs font-medium">{b.billNumber}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{formatDate(b.createdAt)}</td>
              <td className="px-3 py-2.5">{b.planName}</td>
              <td className="px-3 py-2.5">{b.termLabel}</td>
              <td className="px-3 py-2.5">{formatDate(b.periodEnd)}</td>
              <td className="px-3 py-2.5 text-right font-medium">
                {b.totalAmount != null
                  ? formatCurrency(b.totalAmount)
                  : b.amount != null
                    ? formatCurrency(b.amount)
                    : "—"}
              </td>
              <td className="px-3 py-2.5">
                <Badge variant={paymentStatusVariant(b.paymentStatus)} className="text-xs">
                  {formatPaymentStatus(b.paymentStatus)}
                </Badge>
              </td>
              <td className="px-3 py-2.5 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    void (async () => {
                      try {
                        const full = await apiGet<SubscriptionBillRow>(
                          `/api/organization/subscription/bills/${encodeURIComponent(b.id)}`
                        );
                        openSubscriptionBillPrint(full);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not open bill");
                      }
                    })();
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

