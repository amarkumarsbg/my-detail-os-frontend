import { apiDelete, apiGet, apiPost, apiPut, apiPostForm, ApiError } from "./api-client";
import type { InspectionReport, InspectionSendLog, InspectionTemplate } from "@/types/inspection";

export type InspectionPage<T> = { items: T[]; total: number; totalPages: number };

export function inspectionApiError(error: unknown): string {
  if (error instanceof ApiError && (error.status === 404 || error.status === 501)) return "Vehicle inspection service is not available yet. Contact your administrator.";
  return error instanceof Error ? error.message : "Unable to complete this request.";
}

export const inspectionApi = {
  list: (query: URLSearchParams) => apiGet<InspectionPage<InspectionReport>>(`/api/inspections?${query}`),
  history: (query: URLSearchParams) => apiGet<InspectionPage<InspectionSendLog>>(`/api/inspections/send-history?${query}`),
  get: (id: string) => apiGet<{ item: InspectionReport }>(`/api/inspections/${encodeURIComponent(id)}`),
  delete: (id: string) => apiDelete<{ deleted: true }>(`/api/inspections/${encodeURIComponent(id)}`),
  save: (report: InspectionReport) => report.id
    ? apiPut<{ item: InspectionReport }>(`/api/inspections/${encodeURIComponent(report.id)}`, report)
    : apiPost<{ item: InspectionReport }>("/api/inspections", report),
  finalize: (report: InspectionReport) => apiPost<{ item: InspectionReport }>(`/api/inspections/${encodeURIComponent(report.id)}/finalize`, {
    revision: report.revision,
    overallPreDriveCondition: report.overallPreDriveCondition ?? null,
    vehicleConditions: report.vehicleConditions ?? [],
  }),
  revise: (report: InspectionReport) => apiPost<{ item: InspectionReport }>(`/api/inspections/${encodeURIComponent(report.id)}/revisions`, { revision: report.revision }),
  send: (report: InspectionReport, channel: "WHATSAPP" | "EMAIL", recipient: string, requestId: string) => {
    if (!Number.isInteger(report.revision) || report.revision < 1) throw new Error("A valid report revision is required before sending.");
    return apiPost<{ item: InspectionSendLog }>(`/api/inspections/${encodeURIComponent(report.id)}/send`, { channel, recipient, revision: report.revision, requestId });
  },
  resend: (entry: Pick<InspectionSendLog, "inspectionId" | "reportRevision" | "channel" | "recipient">, requestId: string) => {
    if (!Number.isInteger(entry.reportRevision) || entry.reportRevision < 1) throw new Error("A valid report revision is required before resending.");
    return apiPost<{ item: InspectionSendLog }>(`/api/inspections/${encodeURIComponent(entry.inspectionId)}/send`, { channel: entry.channel, recipient: entry.recipient, revision: entry.reportRevision, requestId });
  },
  templates: () => apiGet<{ items: InspectionTemplate[] }>("/api/inspection-templates"),
  saveTemplate: (template: Omit<InspectionTemplate, "id">) => apiPost<{ item: InspectionTemplate }>("/api/inspection-templates", template),
  upload: async (branchId: string, file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose JPEG, PNG or WebP photos.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Each photo must be 10 MB or smaller.");
    const form = new FormData();
    form.append("photo", file);
    form.append("branchId", branchId);
    return apiPostForm<{ id: string; url: string }>("/api/inspections/uploads", form);
  },
};