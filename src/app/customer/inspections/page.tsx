"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, ClipboardCheck, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { customerInspectionApi } from "@/lib/customer-inspection-api";
import { CustomerApiError } from "@/lib/customer-api";
import { inspectionRating, INSPECTION_RATING_LABELS } from "@/lib/inspection";
import { formatDate } from "@/lib/utils";
import type { InspectionReport } from "@/types/inspection";
import { toast } from "sonner";

const RATING_COLORS: Record<string, string> = {
  GOOD: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  AVERAGE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  BAD: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  NA: "bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300",
  NOT_CHECKED: "bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-300",
};

export default function CustomerInspectionsPage() {
  const [items, setItems] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void customerInspectionApi
      .list()
      .then((page) => {
        if (cancelled) return;
        setItems(page.items ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof CustomerApiError ? err.message : "Could not load inspection reports.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadPdf = async (report: InspectionReport) => {
    setDownloadingId(report.id);
    try {
      await customerInspectionApi.downloadPdf(report);
    } catch (err) {
      toast.error(err instanceof CustomerApiError ? err.message : "Could not download the PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/50" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-4">
        <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">
        {items.length} inspection report{items.length !== 1 ? "s" : ""}
      </p>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No inspection reports yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Finalized vehicle inspections from your workshop will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((report) => {
            const rating = report.overallOverride ?? inspectionRating(report.sections ?? []);
            return (
              <Card key={report.id} className="overflow-hidden transition-colors hover:bg-muted/30">
                <CardContent className="p-0">
                  <div className="flex items-stretch gap-2">
                    <Link href={`/customer/inspections/${report.id}`} className="min-w-0 flex-1 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{report.reportNumber}</p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {report.vehicleRegistration}
                            {report.vehicleMakeModel ? ` · ${report.vehicleMakeModel}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDate(report.inspectedAt)}
                            {report.inspectorName ? ` · ${report.inspectorName}` : ""}
                            {` · Rev ${report.revision}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge className={RATING_COLORS[rating] ?? RATING_COLORS.NOT_CHECKED}>
                            {INSPECTION_RATING_LABELS[rating]}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center border-l px-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        aria-label={`Download PDF for ${report.reportNumber}`}
                        disabled={downloadingId === report.id}
                        onClick={() => void downloadPdf(report)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
