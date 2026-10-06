export type InspectionRating = "NOT_CHECKED" | "GOOD" | "AVERAGE" | "BAD" | "NA";
export type InspectionStatus = "DRAFT" | "FINAL";
export type InspectionWhatsAppStatus = "NOT_SENT" | "QUEUED" | "SENT" | "DELIVERED" | "FAILED";

export interface InspectionCheckpoint {
  id: string;
  name: string;
  rating: InspectionRating;
  reading: string;
  remarks: string;
}

export interface InspectionSection {
  id: string;
  name: string;
  checkpoints: InspectionCheckpoint[];
}

export interface InspectionPhoto {
  id: string;
  url: string;
  caption: string;
  checkpointId?: string;
}

export interface InspectionReport {
  id: string;
  reportNumber: string;
  revision: number;
  status: InspectionStatus;
  pdfUrl?: string;
  branchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  vehicleId: string;
  vehicleRegistration: string;
  vehicleMakeModel: string;
  vehicleYear?: number;
  fuelType?: string;
  insuranceDueDate?: string;
  jobCardId?: string;
  inspectedAt: string;
  inspectorName: string;
  inspectorRole?: string;
  /** Latest WhatsApp delivery state, joined by the API; NOT_SENT when no send exists. */
  whatsAppStatus?: InspectionWhatsAppStatus;
  odometer?: number;
  sections: InspectionSection[];
  photos: InspectionPhoto[];
  notes: string;
  terms: string;
  overallOverride?: Exclude<InspectionRating, "NA" | "NOT_CHECKED">;
  overrideReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionSendLog {
  id: string;
  inspectionId: string;
  pdfUrl: string;
  reportNumber: string;
  reportRevision: number;
  customerName: string;
  vehicleRegistration: string;
  branchId: string;
  channel: "WHATSAPP" | "EMAIL";
  recipient: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
  sentAt: string;
  sentBy: string;
  error?: string;
}

export interface InspectionTemplate {
  id: string;
  name: string;
  sections: InspectionSection[];
  terms: string;
}