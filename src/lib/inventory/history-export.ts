import { format } from "date-fns";
import type { StockMovement, Part } from "@/types";
import {
  movementDirectionLabel,
  movementKindLabel,
  movementSignedQuantityText,
} from "@/lib/inventory/movement-labels";
import { requireCanExportData } from "@/lib/assert-can-export";

export type InventoryHistoryExportRow = {
  date: string;
  part: string;
  sku: string;
  type: string;
  qty: string;
  branch: string;
  reference: string;
  customer: string;
  before: string;
  after: string;
  user: string;
};

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
  "Date",
  "Part",
  "SKU",
  "Type",
  "Quantity",
  "Branch",
  "Job card / Ref",
  "Customer",
  "Before",
  "After",
  "User",
] as const;

export function buildInventoryHistoryExportRows(
  movements: StockMovement[],
  parts: Part[],
  branchName: (id: string | undefined) => string,
  userName: (id: string) => string
): InventoryHistoryExportRow[] {
  return movements.map((m) => {
    const part = parts.find((p) => p.id === m.partId);
    return {
      date: format(new Date(m.createdAt), "dd MMM yyyy HH:mm"),
      part: part?.name ?? m.partId,
      sku: part?.sku ?? "",
      type: movementKindLabel(m),
      qty: `${movementSignedQuantityText(m)} (${movementDirectionLabel(m)})`,
      branch: branchName(m.branchId),
      reference: m.jobCardId ?? m.purchaseId ?? m.transferId ?? m.invoiceId ?? m.reason,
      customer: m.customerName ?? "",
      before: m.stockBeforeSecondary != null ? String(m.stockBeforeSecondary) : "",
      after: m.stockAfterSecondary != null ? String(m.stockAfterSecondary) : "",
      user: userName(m.performedBy),
    };
  });
}

export async function downloadInventoryHistoryExcel(rows: InventoryHistoryExportRow[]): Promise<void> {
  requireCanExportData();
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MY DETAIL OS";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Inventory History", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow([...HEADERS]);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow([
      row.date,
      row.part,
      row.sku,
      row.type,
      row.qty,
      row.branch,
      row.reference,
      row.customer,
      row.before,
      row.after,
      row.user,
    ]);
  }
  sheet.columns = HEADERS.map(() => ({ width: 18 }));
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `inventory-history-${fileStamp()}.xlsx`
  );
}

export async function downloadInventoryHistoryPdf(rows: InventoryHistoryExportRow[]): Promise<void> {
  requireCanExportData();
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Inventory History", margin, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Exported ${format(new Date(), "dd MMM yyyy, HH:mm")} · ${rows.length} movements`, margin, 56);
  doc.setTextColor(0);
  autoTable(doc, {
    startY: 68,
    head: [[...HEADERS]],
    body: rows.map((row) => [
      row.date,
      row.part,
      row.sku,
      row.type,
      row.qty,
      row.branch,
      row.reference,
      row.customer || "—",
      row.before || "—",
      row.after || "—",
      row.user,
    ]),
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
  });
  doc.save(`inventory-history-${fileStamp()}.pdf`);
}
