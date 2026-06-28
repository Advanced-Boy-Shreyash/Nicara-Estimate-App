/**
 * NICARA Estimate PDF Generator
 *
 * Generates a professional PDF matching the Excel "Estimate" sheet format.
 * Uses jsPDF + jspdf-autotable for direct download (no print dialog).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ── Types ───────────────────────────────────────────────── */
export interface PDFClientInfo {
  customerName: string;
  projectName: string;
  apartment: string;
  date: string;
  mobile?: string;
  email?: string;
}

export interface PDFEstimateItem {
  siNo: number;
  area: string;
  item: string;
  width: string;
  height: string;
  depth: string;
  amount: number;
  specs: string[];
}

export interface PDFPayment {
  no: number;
  stage: string;
  amount: number;
  mode: string;
}

export interface PDFQuoteData {
  client: PDFClientInfo;
  items: PDFEstimateItem[];
  totalEstimate: number;
  labourCash: number;
  notes: string[];
  terms: string[];
  payments: PDFPayment[];
  materialSummary: { hardware: string; plywood: string };
}

/* ── Helpers ─────────────────────────────────────────────── */
const INR = (n: number) => "₹ " + n.toLocaleString("en-IN");
const GOLD = "#C9A96E";
const DARK = "#1A1A2E";
const GRAY = "#6B7280";
const LIGHT = "#F9F8F6";

/**
 * Generate and download the estimate PDF.
 * Triggers browser download directly — no print dialog.
 */
export function generateEstimatePDF(data: PDFQuoteData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  /* ── Page 1: Header & Summary ──────────────────────────── */

  // NICARA Logo text
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GOLD);
  doc.text("NICARA", margin, y + 8);

  doc.setFontSize(7);
  doc.setTextColor(GRAY);
  doc.text("INTERIOR DESIGN & BUILD", margin, y + 13);

  // Company info (right)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK);
  doc.text("nicara.design", pageW - margin, y + 3, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY);
  doc.text("nishanth@dwelltales.com", pageW - margin, y + 7, { align: "right" });
  doc.text("8559901234", pageW - margin, y + 11, { align: "right" });

  y += 20;

  // Separator
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Client details
  const details = [
    ["CUSTOMER NAME", data.client.customerName],
    ["PROJECT", data.client.projectName],
    ["APARTMENT", data.client.apartment],
    ["DATE", data.client.date],
  ];

  doc.setFontSize(7);
  details.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? margin : margin + contentW / 2;
    const row = y + Math.floor(i / 2) * 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(GRAY);
    doc.text(label, col, row);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(DARK);
    doc.text(value, col + 30, row);
  });
  y += 16;

  // Total estimate box
  doc.setFillColor(DARK);
  doc.roundedRect(margin, y, contentW, 18, 3, 3, "F");
  doc.setFontSize(7);
  doc.setTextColor(GRAY);
  doc.text("TOTAL ESTIMATE", margin + 5, y + 5);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GOLD);
  doc.text(INR(data.totalEstimate), margin + 5, y + 14);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY);
  doc.text("LABOUR TO BE PAID IN CASH", pageW - margin - 5, y + 5, { align: "right" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#D1D5DB");
  doc.text(INR(data.labourCash), pageW - margin - 5, y + 14, { align: "right" });
  y += 24;

  // Notes
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GOLD);
  doc.text("NOTES", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY);
  doc.setFontSize(7);
  data.notes.forEach((note, i) => {
    doc.text(`${i + 1}. ${note}`, margin + 2, y);
    y += 4;
  });
  y += 2;

  // Terms
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GOLD);
  doc.text("TERMS AND CONDITIONS", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY);
  data.terms.forEach((term, i) => {
    doc.text(`${i + 1}. ${term}`, margin + 2, y);
    y += 4;
  });
  y += 4;

  // Payment schedule table
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GOLD);
  doc.setFontSize(7);
  doc.text("PAYMENT TERMS AND CONDITIONS", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Stage", "Amount", "Mode"]],
    body: data.payments.map((p) => [
      String(p.no),
      p.stage,
      INR(p.amount),
      p.mode,
    ]),
    headStyles: {
      fillColor: DARK,
      textColor: "#D1D5DB",
      fontSize: 7,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 7, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 40, fontStyle: "bold" },
      2: { cellWidth: 40, textColor: GOLD, fontStyle: "bold" },
      3: { cellWidth: 25 },
    },
    theme: "plain",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // Material summary
  const halfW = (contentW - 4) / 2;
  doc.setFillColor(LIGHT);
  doc.roundedRect(margin, y, halfW, 12, 2, 2, "F");
  doc.roundedRect(margin + halfW + 4, y, halfW, 12, 2, 2, "F");

  doc.setFontSize(6);
  doc.setTextColor(GRAY);
  doc.text("HARDWARE", margin + 3, y + 4);
  doc.text("PLYWOOD", margin + halfW + 7, y + 4);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(DARK);
  doc.text(data.materialSummary.hardware, margin + 3, y + 9);
  doc.text(data.materialSummary.plywood, margin + halfW + 7, y + 9);

  /* ── Page 2+: Estimate Table ───────────────────────────── */
  doc.addPage();

  // Title
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GOLD);
  doc.text("ESTIMATE SUMMARY", margin, margin + 3);

  // Group items by area for subtotals
  const areaGroups: Record<string, { items: PDFEstimateItem[]; total: number }> = {};
  data.items.forEach((item) => {
    if (!areaGroups[item.area]) areaGroups[item.area] = { items: [], total: 0 };
    areaGroups[item.area].items.push(item);
    areaGroups[item.area].total += item.amount;
  });

  // Build table body with specs as sub-rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableBody: any[][] = [];
  let currentArea = "";

  data.items.forEach((item) => {
    // Area header row
    if (item.area !== currentArea) {
      currentArea = item.area;
      tableBody.push([
        { content: item.area.toUpperCase(), colSpan: 7, styles: { fillColor: DARK, textColor: GOLD, fontStyle: "bold", fontSize: 7 } },
      ]);
    }

    // Main row
    tableBody.push([
      String(item.siNo),
      item.area,
      item.item,
      item.width || "—",
      item.height || "—",
      item.depth || "—",
      INR(item.amount),
    ]);

    // Spec sub-rows
    if (item.specs.length > 0) {
      item.specs.forEach((spec) => {
        tableBody.push([
          "",
          { content: `    • ${spec}`, colSpan: 5, styles: { textColor: GRAY, fontSize: 6, fontStyle: "italic" } },
          "",
        ]);
      });
    }
  });

  // Grand total row
  tableBody.push([
    { content: "GRAND TOTAL", colSpan: 6, styles: { fillColor: DARK, textColor: "#D1D5DB", fontStyle: "bold", fontSize: 9, halign: "right" as const } },
    { content: INR(data.totalEstimate), styles: { fillColor: DARK, textColor: GOLD, fontStyle: "bold", fontSize: 10 } },
  ]);

  autoTable(doc, {
    startY: margin + 7,
    margin: { left: margin, right: margin },
    head: [["SI No", "Area", "Item", "Width", "Height", "Depth", "Amount"]],
    body: tableBody,
    headStyles: {
      fillColor: DARK,
      textColor: "#D1D5DB",
      fontSize: 7,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 7, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" as const },
      1: { cellWidth: 22 },
      2: { cellWidth: 45, fontStyle: "bold" },
      3: { cellWidth: 18, halign: "center" as const },
      4: { cellWidth: 18, halign: "center" as const },
      5: { cellWidth: 18, halign: "center" as const },
      6: { cellWidth: 28, halign: "right" as const, fontStyle: "bold" },
    },
    theme: "grid",
    styles: { lineColor: "#E5E7EB", lineWidth: 0.1 },
    didDrawPage: (hookData) => {
      // Footer on each page
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(6);
      doc.setTextColor(GRAY);
      doc.text(
        `NICARA Design — ${data.client.customerName} — ${data.client.projectName}`,
        margin,
        pageH - 5
      );
      doc.text(
        `Page ${hookData.pageNumber}`,
        pageW - margin,
        pageH - 5,
        { align: "right" }
      );
    },
  });

  // Download
  const filename = `NICARA_Estimate_${data.client.customerName.replace(/\s+/g, "_")}_${data.client.date.replace(/[/-]/g, "")}.pdf`;
  doc.save(filename);
}
