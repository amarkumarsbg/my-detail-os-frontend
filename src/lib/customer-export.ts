import { requireCanExportData } from "@/lib/assert-can-export";
import { format } from "date-fns";
import type { Customer, Vehicle } from "@/types";
import { formatCurrency } from "@/lib/utils";

export type CustomerExportRow = {
  name: string;
  phone: string;
  email: string;
  address: string;
  vehiclesCount: number;
  totalVisits: number;
  rewardPoints: number;
  walletBalance: number;
  lastVisitDate: string;
  status: string;
  memberSince: string;
};

function displayEmail(email: string): string {
  if (!email || email.endsWith("@customers.placeholder")) return "";
  return email;
}

export function buildCustomerExportRows(
  customers: Customer[],
  vehicles: Vehicle[]
): CustomerExportRow[] {
  const countByCustomer = new Map<string, number>();
  for (const v of vehicles) {
    countByCustomer.set(v.customerId, (countByCustomer.get(v.customerId) ?? 0) + 1);
  }

  return [...customers]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .map((c) => ({
      name: c.name,
      phone: c.phone,
      email: displayEmail(c.email),
      address: c.address ?? "",
      vehiclesCount: countByCustomer.get(c.id) ?? 0,
      totalVisits: c.totalVisits ?? 0,
      rewardPoints: c.rewardPoints ?? 0,
      walletBalance: c.walletBalance ?? 0,
      lastVisitDate: c.lastVisitDate
        ? format(new Date(c.lastVisitDate), "dd MMM yyyy")
        : "",
      status: c.isInactive ? "Inactive" : "Active",
      memberSince: c.createdAt ? format(new Date(c.createdAt), "dd MMM yyyy") : "",
    }));
}

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

const HEADERS = [
  "Name",
  "Phone",
  "Email",
  "Address",
  "Vehicles",
  "Total Visits",
  "Reward Points",
  "Wallet",
  "Last Visit",
  "Status",
  "Member Since",
] as const;

function rowValues(row: CustomerExportRow): (string | number)[] {
  return [
    row.name,
    row.phone,
    row.email,
    row.address,
    row.vehiclesCount,
    row.totalVisits,
    row.rewardPoints,
    row.walletBalance,
    row.lastVisitDate,
    row.status,
    row.memberSince,
  ];
}

export async function downloadCustomersExcel(rows: CustomerExportRow[]): Promise<void> {
  requireCanExportData();
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MY DETAIL OS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Customers", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.addRow([...HEADERS]);
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle" };

  for (const row of rows) {
    sheet.addRow(rowValues(row));
  }

  sheet.columns = [
    { width: 24 },
    { width: 16 },
    { width: 28 },
    { width: 32 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 14 },
    { width: 10 },
    { width: 14 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `customers-${fileStamp()}.xlsx`
  );
}

export async function downloadCustomersPdf(rows: CustomerExportRow[]): Promise<void> {
  requireCanExportData();
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Customers", margin, 40);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Exported ${format(new Date(), "dd MMM yyyy, HH:mm")} · ${rows.length} customer${
      rows.length === 1 ? "" : "s"
    }`,
    margin,
    56
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 68,
    head: [[...HEADERS]],
    body: rows.map((row) => [
      row.name,
      row.phone,
      row.email || "—",
      row.address || "—",
      String(row.vehiclesCount),
      String(row.totalVisits),
      String(row.rewardPoints),
      formatCurrency(row.walletBalance),
      row.lastVisitDate || "—",
      row.status,
      row.memberSince || "—",
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 4,
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

  doc.save(`customers-${fileStamp()}.pdf`);
}
