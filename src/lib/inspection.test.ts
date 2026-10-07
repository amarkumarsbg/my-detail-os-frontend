import { describe, expect, it, vi } from "vitest";
import { buildVehicleConditionSvg, downloadInspectionPdf } from "./inspection-pdf";
import { createInspectionSections, inspectionProgress, inspectionRating, resetInspectionSections, validateInspection } from "./inspection";
import type { InspectionReport } from "@/types/inspection";

vi.mock("./assert-can-export", () => ({ requireCanExportData: vi.fn() }));
const pdfMocks = vi.hoisted(() => ({ save: vi.fn(), addImage: vi.fn(), document: undefined as import("jspdf").jsPDF | undefined }));
vi.mock("jspdf", async (importOriginal) => {
  const original = await importOriginal<typeof import("jspdf")>();
  return { ...original, default: function InspectionPdf() {
    const pdf = new original.jsPDF();
    pdfMocks.document = pdf;
    pdf.save = pdfMocks.save;
    pdf.addImage = pdfMocks.addImage;
    return pdf;
  } };
});

describe("vehicle inspection", () => {
  it("starts every checkpoint unchecked and creates independent template snapshots", () => {
    const first = createInspectionSections();
    first[0].checkpoints[0].rating = "BAD";
    expect(inspectionRating(createInspectionSections())).toBe("NOT_CHECKED");
    expect(inspectionProgress(first).checked).toBe(1);
    expect(resetInspectionSections(first)[0].checkpoints[0].rating).toBe("NOT_CHECKED");
    expect(first[0].checkpoints[0].rating).toBe("BAD");
  });
  it("uses the worst inspected rating and excludes N/A", () => {
    const sections = createInspectionSections();
    sections.forEach((section) => section.checkpoints.forEach((checkpoint) => { checkpoint.rating = "GOOD"; }));
    expect(inspectionRating(sections)).toBe("GOOD");
    sections[0].checkpoints[0].rating = "NA";
    sections[0].checkpoints[1].rating = "AVERAGE";
    expect(inspectionRating(sections)).toBe("AVERAGE");
    sections[0].checkpoints[2].rating = "BAD";
    expect(inspectionRating(sections)).toBe("BAD");
    sections[0].checkpoints[3].rating = "NOT_CHECKED";
    expect(inspectionRating(sections)).toBe("NOT_CHECKED");
  });
  it("does not mark all-N/A or empty sections as good", () => {
    const sections = createInspectionSections();
    sections.forEach((section) => section.checkpoints.forEach((checkpoint) => { checkpoint.rating = "NA"; }));
    expect(inspectionRating(sections)).toBe("NA");
    sections[0].checkpoints = [];
    expect(inspectionRating(sections)).toBe("NOT_CHECKED");
  });
  it("allows incomplete drafts but blocks finalization and unexplained overrides", () => {
    const report = { branchId: "b1", customerId: "c1", vehicleId: "v1", inspectorName: "Amar", inspectedAt: "2026-10-05", sections: createInspectionSections(), overrideReason: "" } as InspectionReport;
    expect(validateInspection(report, false)).toBeNull();
    expect(validateInspection(report, true)).toContain("Complete every checkpoint");
    report.overallOverride = "GOOD";
    expect(validateInspection(report, false)).toContain("reason");
    report.overrideReason = "Further diagnostic review";
    report.odometer = -1;
    expect(validateInspection(report, false)).toContain("Odometer");
  });

  it("generates a paginated diagnostic PDF with report identity, checklist and terms", async () => {
    const sections = createInspectionSections();
    sections.forEach((section) => section.checkpoints.forEach((checkpoint) => { checkpoint.rating = "GOOD"; checkpoint.remarks = "Inspected and checked"; }));
    const report = { id: "i1", reportNumber: "INSP-2026-0001", revision: 1, status: "FINAL", customerName: "Amar", vehicleRegistration: "KA01AB1234", vehicleMakeModel: "Honda City", inspectorName: "Inspector", inspectedAt: "2026-10-05", sections, photos: [], overallPreDriveCondition: "FAIR", vehicleConditions: [{ id: "pin-1", number: 1, type: "PAINT_CHIP", x: 58.2, y: 42.4, area: "Roof / Windshield", notes: "Small mark" }, { id: "pin-2", number: 2, type: "DENT", x: 82, y: 53, area: "Right Side" }], notes: "Inspection complete", terms: "Customer approval required", overrideReason: "" } as InspectionReport;
    const conditionVisual = buildVehicleConditionSvg(report);
    expect(conditionVisual.markup).toContain("Vehicle Condition (2)");
    expect(conditionVisual.markup).toContain("Roof / Windshield");
    expect(conditionVisual.markup).toContain("Small mark");
    expect(conditionVisual.markup).toContain("#3b82f6");
    vi.stubGlobal("Image", class {
      width = 1200;
      height = conditionVisual.height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { this.onload?.(); }
    });
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toDataURL: () => "data:image/png;base64,vehicle-condition",
      }),
    });
    await downloadInspectionPdf(report, { name: "Studio", address: "Main Road", phone: "9999999999", color: "#14B8A6" });
    expect(pdfMocks.save).toHaveBeenCalledWith("Inspection-INSP-2026-0001-r1.pdf");
    expect(pdfMocks.addImage).toHaveBeenCalledWith("data:image/png;base64,vehicle-condition", "PNG", 14, expect.any(Number), 182, expect.any(Number));
    expect(pdfMocks.document?.getNumberOfPages()).toBeGreaterThan(1);
    const output = pdfMocks.document?.output();
    expect(output).toContain("INSP-2026-0001");
    expect(output).toContain("CUSTOMER AND VEHICLE");
    expect(output).toContain("MAJOR CHECKLIST SUMMARY");
    expect(output).toContain("DETAILED CHECKLIST");
    expect(output).toContain("Fuel system");
    expect(output).toContain("Customer approval required");
  });
});