"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { AuthenticatedInspectionImage } from "@/components/inspections/authenticated-inspection-image";
import { InspectionChecklist, RatingBadge } from "@/components/inspections/inspection-checklist";
import { VehicleConditionSection } from "@/components/inspections/vehicle-condition-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { customerApiGetBlob, CustomerApiError } from "@/lib/customer-api";
import { customerInspectionApi } from "@/lib/customer-inspection-api";
import { inspectionAssetApiPath } from "@/lib/inspection-media";
import { inspectionRating, INSPECTION_RATING_LABELS } from "@/lib/inspection";
import { formatDate } from "@/lib/utils";
import type { InspectionReport } from "@/types/inspection";

async function loadCustomerInspectionPhotoBlob(url: string): Promise<Blob> {
  const apiPath = inspectionAssetApiPath(url);
  if (!apiPath) throw new Error("Inspection photo is unavailable.");
  return customerApiGetBlob(apiPath);
}

export default function CustomerInspectionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void customerInspectionApi
      .get(id)
      .then((result) => {
        if (cancelled) return;
        setReport(result.item);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof CustomerApiError ? err.message : "Could not load this inspection report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const downloadPdf = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      await customerInspectionApi.downloadPdf(report);
    } catch (err) {
      toast.error(err instanceof CustomerApiError ? err.message : "Could not download the PDF.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <div className="h-8 w-40 animate-pulse rounded bg-muted/50" />
        <div className="h-40 animate-pulse rounded-lg bg-muted/50" />
        <div className="h-64 animate-pulse rounded-lg bg-muted/50" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <Link href="/customer/inspections">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Inspections
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-12 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{error ?? "Inspection report not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overall = report.overallOverride ?? inspectionRating(report.sections ?? []);
  const photos = report.photos ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <Link href="/customer/inspections">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Inspections
          </Button>
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{report.reportNumber}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatDate(report.inspectedAt)}
              {report.inspectorName ? ` · Inspected by ${report.inspectorName}` : ""}
              {` · Revision ${report.revision}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">Final</Badge>
            <RatingBadge rating={overall} />
            <Button type="button" size="sm" variant="outline" disabled={downloading} onClick={() => void downloadPdf()}>
              <Download className="mr-1.5 h-4 w-4" />
              {downloading ? "Downloading…" : "PDF"}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vehicle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Registration</p>
            <p className="font-medium">{report.vehicleRegistration || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Make / model</p>
            <p className="font-medium">
              {report.vehicleMakeModel || "—"}
              {report.vehicleYear ? ` (${report.vehicleYear})` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Odometer</p>
            <p className="font-medium">
              {report.odometer == null ? "—" : `${report.odometer.toLocaleString()} km`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Overall rating</p>
            <p className="font-medium">{INSPECTION_RATING_LABELS[overall]}</p>
          </div>
        </CardContent>
      </Card>

      <VehicleConditionSection
        overallCondition={report.overallPreDriveCondition ?? null}
        conditions={report.vehicleConditions ?? []}
        editable={false}
        onOverallConditionChange={() => undefined}
        onConditionsChange={() => undefined}
        onClearAll={() => undefined}
      />

      <div>
        <h2 className="mb-3 text-base font-semibold">Checklist</h2>
        <InspectionChecklist
          sections={report.sections ?? []}
          editable={false}
          onChange={() => undefined}
          onRemove={() => undefined}
        />
      </div>

      {report.notes?.trim() ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inspection notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{report.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      {report.terms?.trim() ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Terms and conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{report.terms}</p>
          </CardContent>
        </Card>
      ) : null}

      {photos.length > 0 ? (
        <div>
          <h2 className="mb-3 text-base font-semibold">Inspection photos ({photos.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {photos.map((photo) => (
              <Card key={photo.id} className="overflow-hidden">
                <div className="aspect-video bg-muted">
                  <AuthenticatedInspectionImage
                    src={photo.url}
                    alt={photo.caption || "Inspection photo"}
                    className="h-full w-full object-contain"
                    loadBlob={loadCustomerInspectionPhotoBlob}
                  />
                </div>
                {photo.caption?.trim() ? (
                  <CardContent className="py-2">
                    <p className="truncate text-xs text-muted-foreground">{photo.caption}</p>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
