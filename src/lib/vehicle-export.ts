import { format } from "date-fns";
import type { Customer, Vehicle } from "@/types";
import { requireCanExportData } from "@/lib/assert-can-export";

export type VehicleExportRow = {
  registrationNumber: string;
  make: string;
  model: string;
  variant: string;
  customerName: string;
  customerPhone: string;
  fuelType: string;
  segment: string;
  year: number | "";
  color: string;
  notes: string;
};

const HEADERS = [
  "Registration Number",
  "Make",
  "Model",
  "Variant",
  "Customer",
  "Customer Phone",
  "Fuel Type",
  "Segment",
  "Year",
  "Color",
  "Notes",
] as const;

function fileStamp(): string {
  return format(new Date(), "yyyy-MM-dd-HHmm");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildVehicleExportRows(
  vehicles: Vehicle[],
  customers: Customer[]
): VehicleExportRow[] {
  const phoneById = new Map(customers.map((c) => [c.id, c.phone]));
  return [...vehicles]
    .sort((a, b) =>
      a.registrationNumber.localeCompare(b.registrationNumber, undefined, {
        sensitivity: "base",
      })
    )
    .map((v) => ({
      registrationNumber: v.registrationNumber,
      make: v.make,
      model: v.model,
      variant: v.variant ?? "",
      customerName: v.customerName,
      customerPhone: phoneById.get(v.customerId) ?? "",
      fuelType: v.fuelType,
      segment: v.segment,
      year: v.year ?? "",
      color: v.color ?? "",
      notes: v.notes ?? "",
    }));
}

function rowValues(row: VehicleExportRow): (string | number)[] {
  return [
    row.registrationNumber,
    row.make,
    row.model,
    row.variant,
    row.customerName,
    row.customerPhone,
    row.fuelType,
    row.segment,
    row.year,
    row.color,
    row.notes,
  ];
}

export async function downloadVehiclesExcel(rows: VehicleExportRow[]): Promise<void> {
  requireCanExportData();
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MY DETAIL OS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Vehicles", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow([...HEADERS]);
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(rowValues(row));
  }

  sheet.columns = [
    { width: 18 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 22 },
    { width: 16 },
    { width: 12 },
    { width: 14 },
    { width: 8 },
    { width: 12 },
    { width: 24 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `vehicles-${fileStamp()}.xlsx`
  );
}

export function downloadVehiclesCsv(rows: VehicleExportRow[]): void {
  requireCanExportData();
  const lines = [
    HEADERS.join(","),
    ...rows.map((row) => rowValues(row).map(csvEscape).join(",")),
  ];
  triggerDownload(
    new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }),
    `vehicles-${fileStamp()}.csv`
  );
}

export async function downloadVehiclesPdf(rows: VehicleExportRow[]): Promise<void> {
  requireCanExportData();
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Vehicles", margin, 40);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Exported ${format(new Date(), "dd MMM yyyy, HH:mm")} · ${rows.length} vehicle${
      rows.length === 1 ? "" : "s"
    }`,
    margin,
    56
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 68,
    head: [[...HEADERS]],
    body: rows.map((row) =>
      rowValues(row).map((v) => (v === "" || v == null ? "—" : String(v)))
    ),
    styles: {
      fontSize: 7.5,
      cellPadding: 3.5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
  });

  doc.save(`vehicles-${fileStamp()}.pdf`);
}
