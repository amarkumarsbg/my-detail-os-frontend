import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InspectionRating, InspectionReport } from "@/types/inspection";
import { inspectionRating, INSPECTION_RATING_LABELS } from "./inspection";
import { normalizeHex, DEFAULT_BRAND_PRIMARY } from "./brand-color";
import { resolveUploadsPublicUrl } from "./api-base";
import { requireCanExportData } from "./assert-can-export";
import { apiGetBlob } from "./api-client";

type InspectionPdfBrand = { name: string; address: string; phone: string; color: string };

export function inspectionPdfFilename(reportNumber: string, revision?: number) {
  const revisionLabel = Number.isInteger(revision) ? revision : "latest";
  return `Inspection-${reportNumber.replace(/[^\w-]/g, "-")}-r${revisionLabel}.pdf`;
}

export async function downloadInspectionPdfFromUrl(pdfUrl: string, reportNumber: string, revision?: number) {
  requireCanExportData();
  const blob = await apiGetBlob(pdfUrl);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = inspectionPdfFilename(reportNumber, revision);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function downloadInspectionPdf(report: InspectionReport, brand: InspectionPdfBrand) {
  requireCanExportData();
  const pdf = new jsPDF();
  const primary = normalizeHex(brand.color) ?? DEFAULT_BRAND_PRIMARY;
  const primaryRgb = hexToRgb(primary);
  const dark: [number, number, number] = [31, 47, 62];
  const muted: [number, number, number] = [99, 112, 125];
  const border: [number, number, number] = [222, 228, 233];
  const paper: [number, number, number] = [247, 249, 250];
  const warm: [number, number, number] = [250, 241, 232];
  const accent: [number, number, number] = [190, 65, 38];
  const margin = 14;
  const contentWidth = 182;
  const pageHeight = 297;
  const reportNumber = report.reportNumber || "Draft inspection";
  const revision = Number.isInteger(report.revision) && report.revision > 0 ? String(report.revision) : "Draft";
  const overall = report.overallOverride ?? inspectionRating(report.sections);
  let position = 31;

  const ensureSpace = (height: number) => {
    if (position + height > pageHeight - 19) {
      pdf.addPage();
      position = 27;
    }
  };
  const writeText = (value: string, x: number, y: number, size: number, color: [number, number, number], style: "normal" | "bold" = "normal", align: "left" | "center" | "right" = "left") => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.text(value || "N/A", x, y, { align });
  };
  const ratingColors: Record<InspectionRating, { ink: [number, number, number]; fill: [number, number, number] }> = {
    GOOD: { ink: [19, 133, 79], fill: [226, 246, 235] },
    AVERAGE: { ink: [164, 104, 15], fill: [255, 244, 216] },
    BAD: { ink: [185, 48, 48], fill: [255, 232, 229] },
    NA: { ink: [91, 105, 119], fill: [235, 239, 242] },
    NOT_CHECKED: { ink: [91, 105, 119], fill: [235, 239, 242] },
  };
  const pill = (rating: InspectionRating, x: number, y: number, width: number) => {
    const colors = ratingColors[rating];
    pdf.setFillColor(...colors.fill);
    pdf.roundedRect(x, y - 5, width, 6, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...colors.ink);
    pdf.text(INSPECTION_RATING_LABELS[rating].toUpperCase(), x + width / 2, y - 1, { align: "center" });
  };
  const heading = (label: string) => {
    ensureSpace(14);
    pdf.setFillColor(...paper);
    pdf.roundedRect(margin, position, contentWidth, 8, 1.5, 1.5, "F");
    pdf.setFillColor(...accent);
    pdf.roundedRect(margin, position, 1.4, 8, 0.6, 0.6, "F");
    writeText(label.toUpperCase(), margin + 4, position + 5.4, 8, dark, "bold");
    position += 12;
  };
  const cardField = (x: number, y: number, width: number, label: string, value: string, secondary = "") => {
    writeText(label.toUpperCase(), x, y, 6.2, muted, "bold");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...dark);
    pdf.text(pdf.splitTextToSize(value || "N/A", width - 4).slice(0, 2) as string[], x, y + 6);
    if (secondary) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.2);
      pdf.setTextColor(...muted);
      pdf.text(pdf.splitTextToSize(secondary, width - 4).slice(0, 1) as string[], x, y + 13);
    }
  };

  pdf.setFillColor(...primaryRgb);
  pdf.rect(0, 0, 210, 3, "F");
  writeText(brand.name.toUpperCase(), margin, 13, 9, primaryRgb, "bold");
  writeText("VEHICLE INSPECTION REPORT", 196, 13, 8, dark, "bold", "right");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...muted);
  pdf.text(`REPORT ID: ${reportNumber}   |   INSPECTED: ${report.inspectedAt || "N/A"}`, 196, 20, { align: "right" });
  pdf.setDrawColor(...border);
  pdf.line(margin, 25, 196, 25);

  heading("Customer and vehicle");
  pdf.setFillColor(...warm);
  pdf.roundedRect(margin, position, contentWidth, 25, 2, 2, "F");
  const columnWidth = contentWidth / 4;
  cardField(margin + 4, position + 6, columnWidth - 6, "Customer", report.customerName, [report.customerPhone, report.customerEmail].filter(Boolean).join("  |  "));
  cardField(margin + columnWidth, position + 6, columnWidth - 5, "Registration", report.vehicleRegistration);
  cardField(margin + columnWidth * 2, position + 6, columnWidth - 5, "Make / model", `${report.vehicleMakeModel}${report.vehicleYear ? ` (${report.vehicleYear})` : ""}`);
  cardField(margin + columnWidth * 3, position + 6, columnWidth - 6, "Fuel type", report.fuelType || "N/A");
  position += 30;
  pdf.setFillColor(...dark);
  pdf.roundedRect(margin, position, contentWidth, 19, 2, 2, "F");
  [
    ["Odometer", report.odometer == null ? "N/A" : `${report.odometer.toLocaleString()} km`],
    ["Insurance expiry", report.insuranceDueDate || "N/A"],
    ["Inspected by", report.inspectorName || "N/A"],
    ["Revision", revision],
  ].forEach(([label, value], index) => {
    const x = margin + 4 + index * columnWidth;
    writeText(label.toUpperCase(), x, position + 7, 6, [190, 202, 211], "bold");
    writeText(value, x, position + 14, 8, [255, 255, 255], "bold");
  });
  position += 25;

  pdf.setFillColor(...paper);
  pdf.roundedRect(margin, position, contentWidth, 12, 1.5, 1.5, "F");
  writeText("OVERALL VEHICLE RATING", margin + 4, position + 7.5, 7.5, dark, "bold");
  pill(overall, margin + contentWidth - 34, position + 10, 29);
  position += 17;
  if (report.overallOverride && report.overrideReason.trim()) {
    writeText(`Override reason: ${report.overrideReason}`, margin + 1, position, 7, muted);
    position += 6;
  }

  heading("Major checklist summary");
  const summaryRows = Math.ceil(report.sections.length / 2);
  ensureSpace(summaryRows * 10 + 4);
  const summaryWidth = contentWidth / 2;
  report.sections.forEach((section, index) => {
    const x = margin + Math.floor(index / summaryRows) * summaryWidth;
    const y = position + (index % summaryRows) * 10;
    pdf.setDrawColor(...border);
    pdf.line(x, y + 2, x + summaryWidth - 5, y + 2);
    writeText(section.name, x + 2, y, 7, dark, "bold");
    pill(inspectionRating([section]), x + summaryWidth - 31, y + 1, 27);
  });
  position += summaryRows * 10 + 6;

  heading("Detailed checklist");
  for (const section of report.sections) {
    ensureSpace(20);
    pdf.setFillColor(239, 244, 251);
    pdf.roundedRect(margin, position, contentWidth, 8, 1.5, 1.5, "F");
    pdf.setFillColor(...accent);
    pdf.roundedRect(margin, position, 1.4, 8, 0.6, 0.6, "F");
    writeText(section.name.toUpperCase(), margin + 4, position + 5.4, 7.5, dark, "bold");
    pill(inspectionRating([section]), margin + contentWidth - 32, position + 6.5, 27);
    position += 10;
    const rows = section.checkpoints.length
      ? section.checkpoints.map((checkpoint) => [checkpoint.name, INSPECTION_RATING_LABELS[checkpoint.rating], checkpoint.reading || "-", checkpoint.remarks || "-"])
      : [["No checkpoints recorded", "N/A", "-", "-"]];
    autoTable(pdf, {
      startY: position,
      head: [["Checkpoint", "Condition", "Reading", "Remarks"]],
      body: rows,
      margin: { top: 27, right: margin, bottom: 20, left: margin },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2.5, overflow: "linebreak", textColor: dark, lineColor: border, lineWidth: 0.15 },
      headStyles: { fillColor: dark, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 251, 252] },
      columnStyles: { 0: { cellWidth: 54 }, 1: { cellWidth: 32, halign: "center" }, 2: { cellWidth: 34 }, 3: { cellWidth: 62 } },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 1) return;
        const rating = section.checkpoints[data.row.index]?.rating;
        if (rating) {
          data.cell.styles.textColor = ratingColors[rating].ink;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    position = ((pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || position) + 7;
  }

  const addCopy = (label: string, copy: string) => {
    if (!copy.trim()) return;
    heading(label);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...dark);
    for (const line of pdf.splitTextToSize(copy, contentWidth) as string[]) {
      ensureSpace(5);
      pdf.text(line, margin, position);
      position += 4;
    }
    position += 3;
  };
  addCopy("Inspection notes", report.notes);
  addCopy("Terms and conditions", report.terms);

  for (const photo of report.photos) {
    const src = resolveUploadsPublicUrl(photo.url);
    if (!src) throw new Error("Inspection photo is unavailable.");
    const response = await fetch(src);
    if (!response.ok) throw new Error("Could not load a report photo. Retry the PDF download.");
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read a report photo."));
      reader.readAsDataURL(blob);
    });
    const properties = pdf.getImageProperties(data);
    const width = Math.min(contentWidth, 100 * properties.width / properties.height);
    const height = width * properties.height / properties.width;
    ensureSpace(height + 16);
    writeText("REPORT PHOTO", margin, position, 7.5, dark, "bold");
    position += 4;
    pdf.addImage(data, properties.fileType, margin, position, width, height);
    position += height + 5;
    const section = report.sections.find((item) => item.checkpoints.some((checkpoint) => checkpoint.id === photo.checkpointId));
    const checkpoint = section?.checkpoints.find((item) => item.id === photo.checkpointId);
    const caption = section && checkpoint ? `${section.name}: ${checkpoint.name} - ${photo.caption || "Inspection photo"}` : photo.caption || "Inspection photo";
    writeText(caption, margin, position, 7, muted);
    position += 8;
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    if (page > 1) {
      writeText(brand.name.toUpperCase(), margin, 13, 7, primaryRgb, "bold");
      writeText("VEHICLE INSPECTION REPORT", 196, 13, 7, dark, "bold", "right");
      pdf.setDrawColor(...border);
      pdf.line(margin, 18, 196, 18);
    }
    pdf.setDrawColor(...border);
    pdf.line(margin, 282, 196, 282);
    writeText([brand.address, brand.phone].filter(Boolean).join("  |  ") || brand.name, margin, 288, 6.5, muted);
    writeText(`${reportNumber}  |  Revision ${revision}`, 105, 288, 6.5, muted);
    writeText(`${page} / ${pages}`, 196, 288, 6.5, muted);
  }
  pdf.save(inspectionPdfFilename(reportNumber, report.revision));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}