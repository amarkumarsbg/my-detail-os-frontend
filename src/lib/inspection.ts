import type { InspectionRating, InspectionReport, InspectionSection } from "@/types/inspection";

export const INSPECTION_RATING_LABELS: Record<InspectionRating, string> = {
  NOT_CHECKED: "Not Checked", GOOD: "Good", AVERAGE: "Average", BAD: "Bad", NA: "N/A",
};

const DEFAULT_SECTIONS: [string, string[]][] = [
  ["Engine", ["Fuel system", "High tension cable", "Hoses", "Ignition coil", "Radiator", "Exhaust", "Engine oil", "Oil leaks"]],
  ["Battery", ["Battery make / manufacture date", "Electrolytes", "Corrosion", "Battery voltage"]],
  ["Suspension", ["Suspension noise", "Driving experience", "Suspension recoil"]],
  ["Tyres", ["Cuts and bulges", "Wear and tear", "Wheel bearings", "Front tyre tread", "Rear tyre tread", "Rims"]],
  ["Electrical", ["Horn", "Starter", "Switches", "Warning lights", "Wipers", "Air conditioning", "Lamps", "Alternator", "Fan noise"]],
  ["Transmission", ["Drive shaft", "Clutch", "Gear shift", "Differential leakage", "Transmission fluid"]],
  ["Exterior", ["Windshield", "Dents and scratches", "Wiper blades", "Paint condition"]],
  ["Brakes", ["Front pads and discs", "ABS", "Brake fluid leaks", "Brake shoes", "Rear pads and discs", "Handbrake"]],
  ["Steering", ["Steering sway", "Power steering", "Vibrations", "Rack and pinion", "Turn resistance"]],
];

export const DEFAULT_INSPECTION_TERMS = "This report records the condition observed during the inspection and is not a warranty. Hidden or intermittent faults may not be detected without further testing or disassembly. Repair recommendations require customer approval.";

export function createInspectionSections(): InspectionSection[] {
  return DEFAULT_SECTIONS.map(([name, checkpoints], sectionIndex) => ({
    id: `section-${sectionIndex}`, name,
    checkpoints: checkpoints.map((checkpoint, index) => ({
      id: `checkpoint-${sectionIndex}-${index}`, name: checkpoint,
      rating: "NOT_CHECKED", reading: "", remarks: "",
    })),
  }));
}

export function resetInspectionSections(sections: InspectionSection[]): InspectionSection[] {
  return sections.map((section) => ({ ...section, checkpoints: section.checkpoints.map((checkpoint) => ({
    ...checkpoint, rating: "NOT_CHECKED", reading: "", remarks: "",
  })) }));
}

export function inspectionRating(sections: InspectionSection[]): InspectionRating {
  const checkpoints = sections.flatMap((section) => section.checkpoints);
  if (!checkpoints.length || sections.some((section) => !section.checkpoints.length) || checkpoints.some((checkpoint) => checkpoint.rating === "NOT_CHECKED")) return "NOT_CHECKED";
  const ratings = checkpoints.map((checkpoint) => checkpoint.rating).filter((rating) => rating !== "NA");
  if (!ratings.length) return "NA";
  if (ratings.includes("BAD")) return "BAD";
  if (ratings.includes("AVERAGE")) return "AVERAGE";
  return "GOOD";
}

export function inspectionProgress(sections: InspectionSection[]) {
  const checkpoints = sections.flatMap((section) => section.checkpoints);
  const checked = checkpoints.filter((checkpoint) => checkpoint.rating !== "NOT_CHECKED").length;
  return { checked, total: checkpoints.length, percent: checkpoints.length ? Math.round(checked / checkpoints.length * 100) : 0 };
}

export function validateInspection(report: InspectionReport, final: boolean): string | null {
  if (!report.branchId) return "Select a workshop branch.";
  if (!report.customerId || !report.vehicleId) return "Select a customer and their vehicle.";
  if (!report.inspectorName.trim()) return "Enter the inspector's name.";
  if (!report.inspectedAt || !Number.isFinite(Date.parse(report.inspectedAt))) return "Enter a valid inspection date.";
  if (report.odometer !== undefined && (!Number.isFinite(report.odometer) || report.odometer < 0)) return "Odometer must be zero or greater.";
  if (!report.sections.length) return "Add at least one inspection section.";
  if (report.sections.some((section) => !section.name.trim() || section.checkpoints.some((checkpoint) => !checkpoint.name.trim()))) return "Section and checkpoint names cannot be empty.";
  if (report.overallOverride && !report.overrideReason.trim()) return "Give a reason for overriding the overall rating.";
  if (final && inspectionRating(report.sections) === "NOT_CHECKED") return "Complete every checkpoint and remove empty sections before finalizing.";
  return null;
}