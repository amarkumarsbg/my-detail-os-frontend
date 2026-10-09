import type { InspectionReport } from "@/types/inspection";
import { customerApiGet, customerApiGetBlob } from "@/lib/customer-api";
import { inspectionPdfFilename } from "@/lib/inspection-pdf";

type InspectionPage = { items: InspectionReport[]; total: number; totalPages: number };

export const customerInspectionApi = {
  list: (query?: URLSearchParams) =>
    customerApiGet<InspectionPage>(`/api/customer/inspections${query?.toString() ? `?${query}` : ""}`),
  get: (id: string) =>
    customerApiGet<{ item: InspectionReport }>(`/api/customer/inspections/${encodeURIComponent(id)}`),
  downloadPdf: async (report: InspectionReport) => {
    const revision = Number.isInteger(report.revision) && report.revision > 0 ? report.revision : 1;
    const path =
      report.pdfUrl?.startsWith("/api/customer/inspections/")
        ? report.pdfUrl
        : `/api/customer/inspections/${encodeURIComponent(report.id)}/pdf?revision=${revision}`;
    const blob = await customerApiGetBlob(path);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = inspectionPdfFilename(report.reportNumber, revision);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  },
};
