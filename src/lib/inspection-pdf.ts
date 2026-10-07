import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InspectionRating, InspectionReport } from "@/types/inspection";
import { inspectionRating, INSPECTION_RATING_LABELS } from "./inspection";
import { normalizeHex, DEFAULT_BRAND_PRIMARY } from "./brand-color";
import { resolveUploadsPublicUrl } from "./api-base";
import { requireCanExportData } from "./assert-can-export";
import { apiGetBlob } from "./api-client";

type InspectionPdfBrand = { name: string; address: string; phone: string; color: string };

const vehicleConditionColors = {
  SCRATCH: { pin: "#f59e0b", ink: "#a64b00", fill: "#fff7e8", border: "#fbbf24" },
  DENT: { pin: "#f43f5e", ink: "#be123c", fill: "#fff1f2", border: "#fb7185" },
  CRACK: { pin: "#a855f7", ink: "#7e22ce", fill: "#faf5ff", border: "#c084fc" },
  PAINT_CHIP: { pin: "#3b82f6", ink: "#1d4ed8", fill: "#eff6ff", border: "#60a5fa" },
  OTHER: { pin: "#64748b", ink: "#475569", fill: "#f8fafc", border: "#94a3b8" },
} as const;

const vehicleConditionLabels = { SCRATCH: "Scratch", DENT: "Dent", CRACK: "Crack", PAINT_CHIP: "Paint Chip", OTHER: "Other" } as const;

function escapeSvg(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function buildVehicleConditionSvg(report: InspectionReport): { markup: string; width: number; height: number } {
  const conditions = report.vehicleConditions ?? [];
  const width = 1200;
  const mainTop = 194;
  const sideY = mainTop;
  let rowTop = sideY + 64;
  const rows = conditions.map((condition, index) => {
    const colors = vehicleConditionColors[condition.type];
    const label = vehicleConditionLabels[condition.type];
    const area = escapeSvg(condition.area || "Unspecified area");
    const notes = condition.notes?.trim();
    const rowHeight = notes ? 58 : 46;
    const y = rowTop;
    rowTop += rowHeight;
    return `<g>
      ${index ? `<path d="M 818 ${y - 10} H 1160" stroke="#e7ddd0" stroke-width="1.5"/>` : ""}
      <circle cx="842" cy="${y + 9}" r="16" fill="${colors.pin}"/>
      <text x="842" y="${y + 15}" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#ffffff">${condition.number}</text>
      <rect x="870" y="${y - 8}" width="${label === "Paint Chip" ? 112 : label === "Scratch" ? 86 : 72}" height="30" rx="15" fill="${colors.fill}" stroke="${colors.border}" stroke-width="2"/>
      <text x="${label === "Paint Chip" ? 926 : label === "Scratch" ? 913 : 906}" y="${y + 12}" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" fill="${colors.ink}">${label}</text>
      <text x="${label === "Paint Chip" ? 994 : label === "Scratch" ? 969 : 950}" y="${y + 5}" font-family="Arial,sans-serif" font-size="16" font-weight="600" fill="#111827">${area}</text>
      ${notes ? `<text x="870" y="${y + 39}" font-family="Arial,sans-serif" font-size="13" fill="#64748b">${escapeSvg(notes)}</text>` : ""}
    </g>`;
  });
  const mainHeight = Math.max(430, rowTop - sideY + 18);
  const height = mainTop + mainHeight + 20;
  const overallLabels = { GOOD: "Good", FAIR: "Fair", POOR: "Poor" } as const;
  const overall = report.overallPreDriveCondition ? overallLabels[report.overallPreDriveCondition] : "Not selected";
  const overallColor = overall === "Good" ? "#059669" : overall === "Fair" ? "#d97706" : overall === "Poor" ? "#dc2626" : "#64748b";
  const typeLegend = (Object.keys(vehicleConditionLabels) as Array<keyof typeof vehicleConditionLabels>).map((type, index) => {
    const label = vehicleConditionLabels[type];
    const x = 208 + index * 160;
    const colors = vehicleConditionColors[type];
    return `<rect x="${x}" y="137" width="145" height="36" rx="9" fill="${colors.fill}" stroke="${colors.border}" stroke-width="2"/><circle cx="${x + 17}" cy="155" r="7" fill="${colors.pin}"/><text x="${x + 32}" y="160" font-family="Arial,sans-serif" font-size="15" font-weight="600" fill="${colors.ink}">${label}</text>`;
  }).join("");
  const pinSvg = conditions.map((condition, index) => {
    const cx = 20 + 760 * condition.x / 100;
    const cy = mainTop + mainHeight * condition.y / 100;
    const colors = vehicleConditionColors[condition.type];
    const active = index === conditions.length - 1;
    return `<g><circle cx="${cx}" cy="${cy}" r="${active ? 29 : 24}" fill="${active ? "#60a5fa" : "#ffffff"}" opacity="${active ? "0.95" : "1"}"/><circle cx="${cx}" cy="${cy}" r="${active ? 22 : 19}" fill="${colors.pin}"/><text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${active ? 18 : 16}" font-weight="700" fill="#ffffff">${condition.number}</text></g>`;
  }).join("");
  const emptyList = !conditions.length ? `<text x="980" y="${sideY + 118}" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#64748b">No conditions noted</text>` : "";

  return {
    width,
    height,
    markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#253147" stroke-width="1"/></pattern>
        <linearGradient id="body" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#1d2b42"/><stop offset="1" stop-color="#121e32"/></linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#ffffff"/>
      <rect x="0" y="0" width="${width}" height="3" fill="#e8d7c0"/>
      <text x="24" y="38" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#172033">Vehicle Condition (${conditions.length})</text>
      <text x="24" y="65" font-family="Arial,sans-serif" font-size="16" fill="#64748b">Record visible exterior condition before the inspection.</text>
      <rect x="20" y="82" width="1160" height="82" rx="12" fill="#fbf9f6" stroke="#eadcc9" stroke-width="2"/>
      <text x="42" y="116" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#172033">Overall Pre-Drive Condition</text>
      <text x="42" y="143" font-family="Arial,sans-serif" font-size="16" fill="#64748b">General visual condition of the vehicle exterior</text>
      <rect x="1045" y="104" width="108" height="38" rx="10" fill="${overallColor}"/>
      <text x="1099" y="129" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#ffffff">${overall}</text>
      <rect x="20" y="178" width="1160" height="62" rx="12" fill="#f8f6f2" stroke="#eadcc9" stroke-width="2"/>
      <text x="42" y="215" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#172033">Condition types</text>
      ${typeLegend}
      <rect x="20" y="${mainTop}" width="760" height="${mainHeight}" rx="18" fill="#101a2e" stroke="#26354d" stroke-width="2"/>
      <rect x="20" y="${mainTop}" width="760" height="${mainHeight}" rx="18" fill="url(#grid)"/>
      <g transform="translate(100 ${mainTop + (mainHeight - 405) / 2})" font-family="Arial,sans-serif" text-anchor="middle">
        <g fill="#8da0b8" font-size="12"><text x="300" y="32">Front (Hood)</text><text x="300" y="386">Rear (Trunk)</text><text x="95" y="208">Left Side</text><text x="505" y="208">Right Side</text></g>
        <g fill="url(#body)" stroke="#22b9ee" stroke-width="3" stroke-linejoin="round">
          <path d="M244 69 Q260 53 300 52 Q340 53 356 69 L375 98 Q386 119 390 155 L397 245 Q398 300 375 327 L356 347 Q340 359 300 360 Q260 359 244 347 L225 327 Q202 300 203 245 L210 155 Q214 119 225 98 Z"/>
          <path d="M232 103 Q300 78 368 103 L360 138 Q300 126 240 138 Z" fill="#102a42"/><path d="M239 151 Q300 138 361 151 L369 182 L231 182 Z" fill="#18334a"/>
          <path d="M235 191 Q300 186 365 191 L359 267 Q300 276 241 267 Z" fill="#0b1728"/><path d="M241 278 Q300 287 359 278 L368 316 Q300 338 232 316 Z" fill="#18334a"/>
          <path d="M220 151 L207 165 L211 177 L225 171 M380 151 L393 165 L389 177 L375 171" fill="#34516c"/>
        </g>
        <g fill="none" stroke="#22b9ee" stroke-width="2"><path d="M228 145 L372 145 M229 274 L371 274 M249 105 L258 139 M351 105 L342 139 M248 281 L257 316 M352 281 L343 316"/></g>
        <g fill="none" stroke="#f04452" stroke-width="2.5" stroke-linecap="round"><path d="M231 324 L257 333 M369 324 L343 333"/></g>
      </g>
      ${pinSvg}
      <rect x="800" y="${sideY}" width="380" height="${mainHeight}" rx="12" fill="#ffffff" stroke="#eadcc9" stroke-width="2"/>
      <path d="M800 ${sideY + 52} H1180" stroke="#eadcc9" stroke-width="2"/>
      <circle cx="827" cy="${sideY + 26}" r="10" fill="#fff7ed" stroke="#f59e0b" stroke-width="2"/>
      <text x="846" y="${sideY + 32}" font-family="Arial,sans-serif" font-size="17" font-weight="700" fill="#172033">Noted conditions (${conditions.length})</text>
      ${rows.join("")}${emptyList}
    </svg>`,
  };
}

async function svgToPngDataUrl(svg: string, width: number, height: number): Promise<string> {
  const image = new Image();
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const loadedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not render the vehicle condition panel for the PDF."));
    image.src = source;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the vehicle condition image for the PDF.");
  context.drawImage(loadedImage, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

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

  const conditionVisual = buildVehicleConditionSvg(report);
  const conditionVisualHeight = contentWidth * conditionVisual.height / conditionVisual.width;
  ensureSpace(conditionVisualHeight + 4);
  const conditionVisualPng = await svgToPngDataUrl(conditionVisual.markup, conditionVisual.width, conditionVisual.height);
  pdf.addImage(conditionVisualPng, "PNG", margin, position, contentWidth, conditionVisualHeight);
  position += conditionVisualHeight + 7;

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