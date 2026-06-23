// Generate a real PDF copy of a customer invoice using jsPDF.
// The layout deliberately mirrors the on-screen /invoice/:ref page so the PDF
// looks identical to what the customer sees.
//
// Public helpers:
//   buildInvoicePdf(data)       -> jsPDF instance
//   downloadInvoicePdf(data)    -> triggers a browser download (file name = invoice no)

import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { formatItemDescription } from "@/lib/itemLabel";
import { groupStops, itemRouteLabel } from "@/lib/stops";
import type { QuoteStop } from "@shared/schema";
import { requiresFullUpfront } from "@shared/pricing";
import { getQuoteTerms, QUOTE_TERMS_HEADING } from "@shared/terms";
import { getJobSchedule } from "@shared/pricing";

const CO      = "The Moving Guy Pte Ltd";
const UEN     = "202424156H";
const ADDR    = "160 Robinson Road, #14-04 SBF Center, Singapore 068914";
const TEL     = "+65 8088 0757";
const MAIL    = "sales@tmginstall.com";
const WEB     = "tmginstall.com";
const VEHICLE = "GBM550L";

type InvoiceItem = {
  id: number;
  detectedName: string | null;
  originalDescription: string | null;
  serviceType: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  fromStopId?: string | null;
  toStopId?: string | null;
};

export type InvoicePdfData = {
  referenceNo: string;
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  invoiceType?: "residential" | "commercial";
  billingAddress?: string | null;
  billingCompanyName?: string | null;
  billingCompanyUen?: string | null;
  poNumber?: string | null;
  serviceAddress: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  samePropertyMove?: boolean;
  stops?: QuoteStop[] | null;
  scheduledAt: string | null;
  timeWindow: string | null;
  completedAt: string | null;
  items: InvoiceItem[];
  subtotal: string;
  transportFee: string;
  volumetricFee?: string;
  discount: string;
  discountLabel?: string;
  adjustment?: string;
  secondDayFee?: string;
  secondDayFeeAdjusted?: boolean;
  secondDayHours?: string;
  secondDayCrewSize?: number;
  total: string;
  depositAmount: string;
  depositPaidAt: string | null;
  finalAmount: string;
  finalPaidAt: string | null;
  paidInFull: boolean;
  // Interim partial payments (ledger) — rendered between the deposit and the
  // closing balance so the installment breakdown matches the on-screen invoice.
  payments?: { id: number; amount: string; method: string; note: string | null; paidAt: string | null }[];
  // ── Dispute-protection: scope / timing / surcharge presentation ──
  timingMode?: string | null;
  dismantleAt?: string | null;
  dismantleTimeWindow?: string | null;
  reinstallAt?: string | null;
  reinstallTimeWindow?: string | null;
  afterOfficeInvolved?: boolean;
  afterOfficeSurchargeApplied?: boolean;
  afterOfficeSurchargeAmount?: string;
  afterOfficeWaived?: boolean;
  additionalTripCharge?: string;
  specialRemarks?: string | null;
  // Terms-acceptance record
  termsAcceptedAt?: string | null;
  termsAcceptedAmount?: string | null;
  termsAcceptedVersion?: number | null;
  version?: number | null;
  // Cancellation / refund status
  cancellationRequestedAt?: string | null;
  cancellationReason?: string | null;
  refundApprovedAmount?: string | null;
  refundReason?: string | null;
  refundMethod?: string | null;
  refundDueByAt?: string | null;
  refundCompletedAt?: string | null;
  // Business-rules policy clauses (fetched from /api/business-rules by the
  // caller and passed in). Rendered as a "Terms & Policy" section.
  policyClauses?: { title: string; body: string }[] | null;
};

const money = (v: any) =>
  `S$${Number(v || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dt = (v?: string | null, withTime = false) => {
  if (!v) return "—";
  try {
    return format(new Date(v), withTime ? "d MMM yyyy, h:mm a" : "d MMM yyyy");
  } catch {
    return "—";
  }
};

export function buildInvoicePdf(data: InvoicePdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();    // 210
  const pageH = doc.internal.pageSize.getHeight();   // 297
  const marginX = 14;
  const contentW = pageW - marginX * 2;

  let y = 0;

  // ── Top branded band (black) ─────────────────────────────────────
  const bandH = 26;
  doc.setFillColor(17, 17, 17);
  doc.rect(0, 0, pageW, bandH, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("TAX INVOICE / RECEIPT", marginX, 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("TMG INSTALL", marginX, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`${CO} · UEN ${UEN}`, marginX, 21);

  // Right side: invoice no
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("INVOICE NO.", pageW - marginX, 7, { align: "right" });

  doc.setFont("courier", "bold");
  doc.setFontSize(16);
  doc.text(data.invoiceNo, pageW - marginX, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Issued ${dt(data.invoiceDate)}`, pageW - marginX, 21, { align: "right" });

  y = bandH;

  // ── Sub-header (address line) ────────────────────────────────────
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(ADDR, marginX, y + 5);
  doc.text(`${TEL} · ${MAIL} · ${WEB} · Vehicle ${VEHICLE}`, pageW - marginX, y + 5, { align: "right" });
  y += 8;
  doc.setDrawColor(230, 230, 230);
  doc.line(marginX, y, pageW - marginX, y);
  y += 4;

  // ── PAID IN FULL stamp ───────────────────────────────────────────
  if (data.paidInFull) {
    const stampH = 14;
    doc.setFillColor(236, 253, 245);     // emerald-50
    doc.setDrawColor(110, 231, 183);     // emerald-300
    doc.setLineWidth(0.6);
    doc.roundedRect(marginX, y, contentW, stampH, 2, 2, "FD");
    doc.setLineWidth(0.2);

    doc.setTextColor(4, 120, 87);        // emerald-700
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("PAYMENT STATUS", marginX + 4, y + 5.5);

    doc.setTextColor(6, 95, 70);         // emerald-800
    doc.setFontSize(13);
    doc.text("PAID IN FULL", marginX + 4, y + 11);

    doc.setTextColor(4, 120, 87);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("TOTAL PAID", pageW - marginX - 4, y + 5.5, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(6, 95, 70);
    doc.setFontSize(14);
    doc.text(money(data.total), pageW - marginX - 4, y + 11, { align: "right" });

    y += stampH + 4;
  }

  // ── Bill To + Job Reference ──────────────────────────────────────
  const colW = contentW / 2;
  const labelColor: [number, number, number] = [156, 163, 175];     // gray-400
  const bodyColor: [number, number, number] = [55, 65, 81];         // gray-700

  const isCommercial = data.invoiceType === "commercial";
  const showEmail = !!(data.customerEmail && !data.customerEmail.includes("@tmginstall.com"));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...labelColor);
  doc.text(isCommercial ? "BILL TO (COMMERCIAL)" : "BILL TO", marginX, y);
  doc.text("JOB REFERENCE", marginX + colW, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 17, 17);
  const billToName = isCommercial
    ? (data.billingCompanyName || data.customerName || "—")
    : (data.customerName || "—");
  doc.text(billToName, marginX, y);

  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text(data.referenceNo, marginX + colW, y);

  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...bodyColor);

  // Bill-to extra lines
  let leftY = y;
  if (isCommercial) {
    if (data.billingCompanyUen) { doc.text(`UEN: ${data.billingCompanyUen}`, marginX, leftY); leftY += 4; }
    if (data.billingAddress) {
      const addrLines = doc.splitTextToSize(data.billingAddress, colW - 4);
      doc.text(addrLines, marginX, leftY);
      leftY += addrLines.length * 4;
    }
    if (data.billingCompanyName && data.customerName) {
      doc.text(`Attn: ${data.customerName}`, marginX, leftY); leftY += 4;
    }
    if (data.customerPhone) { doc.text(data.customerPhone, marginX, leftY); leftY += 4; }
    if (showEmail) { doc.text(data.customerEmail!, marginX, leftY); leftY += 4; }
    if (data.poNumber) {
      leftY += 1;
      doc.setFont("helvetica", "bold");
      doc.text(`PO No.: ${data.poNumber}`, marginX, leftY);
      doc.setFont("helvetica", "normal");
      leftY += 4;
    }
  } else {
    if (data.billingAddress) {
      const addrLines = doc.splitTextToSize(data.billingAddress, colW - 4);
      doc.text(addrLines, marginX, leftY);
      leftY += addrLines.length * 4;
    }
    if (data.customerPhone) { doc.text(data.customerPhone, marginX, leftY); leftY += 4; }
    if (showEmail) { doc.text(data.customerEmail!, marginX, leftY); leftY += 4; }
  }

  // Job-reference extra lines
  let rightY = y;
  if (data.scheduledAt) {
    doc.text(
      `Service date: ${dt(data.scheduledAt)}${data.timeWindow ? ` · ${data.timeWindow}` : ""}`,
      marginX + colW, rightY
    );
    rightY += 4;
  }
  if (data.completedAt) {
    doc.text(`Completed: ${dt(data.completedAt)}`, marginX + colW, rightY);
    rightY += 4;
  }

  y = Math.max(leftY, rightY) + 2;

  // ── Service location ─────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...labelColor);
  doc.text("SERVICE LOCATION", marginX, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55); // gray-800
  const pdfGrouped = groupStops(data.stops);
  const pdfMultiStop = pdfGrouped.all.length > 2;
  if (pdfMultiStop) {
    for (const s of pdfGrouped.all) {
      const extra = `${s.floor ? `, ${s.floor}` : ""}${s.hasLift === false ? " (no lift)" : ""}`;
      const stopLines = doc.splitTextToSize(`${s.label}: ${s.address}${extra}`, contentW);
      doc.text(stopLines, marginX, y);
      y += stopLines.length * 4;
    }
  } else if (data.pickupAddress) {
    const pickupLines  = doc.splitTextToSize(`Pickup: ${data.pickupAddress}`, contentW);
    const dropoffLines = doc.splitTextToSize(`Drop-off: ${data.dropoffAddress || "—"}`, contentW);
    doc.text(pickupLines, marginX, y);
    y += pickupLines.length * 4;
    doc.text(dropoffLines, marginX, y);
    y += dropoffLines.length * 4;
  } else {
    const lines = doc.splitTextToSize(data.serviceAddress || "—", contentW);
    doc.text(lines, marginX, y);
    y += lines.length * 4;
  }
  y += 3;

  // ── Items table ──────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...labelColor);
  doc.text("SCOPE OF WORK", marginX, y);
  y += 3;

  const colDescX  = marginX + 2;
  const colQtyX   = marginX + contentW - 50;
  const colPriceX = marginX + contentW - 28;
  const colSubX   = marginX + contentW - 2;
  const headerH   = 7;

  const drawTableHeader = (atY: number): number => {
    doc.setFillColor(17, 17, 17);
    doc.rect(marginX, atY, contentW, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Item / Description", colDescX, atY + 4.7);
    doc.text("Qty", colQtyX, atY + 4.7, { align: "center" });
    doc.text("Unit Price", colPriceX, atY + 4.7, { align: "right" });
    doc.text("Subtotal", colSubX, atY + 4.7, { align: "right" });
    return atY + headerH;
  };

  // Header row (black)
  y = drawTableHeader(y);

  // Body rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  if (!data.items || data.items.length === 0) {
    doc.setTextColor(156, 163, 175);
    doc.text("No line items", marginX + contentW / 2, y + 5, { align: "center" });
    y += 8;
  } else {
    data.items.forEach((it, i) => {
      const routeLabel = itemRouteLabel(data.stops, it.fromStopId, it.toStopId);
      const desc = formatItemDescription(it, data.items) + (routeLabel ? `\n${routeLabel}` : "");
      const wrapped = doc.splitTextToSize(desc, contentW - 60);
      const rowH = Math.max(7, wrapped.length * 4 + 3);

      // Page break check — re-draw the table header on the new page so
      // multi-page invoices stay readable.
      if (y + rowH > pageH - 35) {
        doc.addPage();
        y = 14;
        y = drawTableHeader(y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
      }

      // Row background
      if (i % 2 === 1) {
        doc.setFillColor(249, 250, 251); // gray-50
        doc.rect(marginX, y, contentW, rowH, "F");
      }

      doc.setTextColor(31, 41, 55);
      doc.setFont("helvetica", "normal");
      doc.text(wrapped, colDescX, y + 4.5);

      doc.setTextColor(75, 85, 99);
      doc.text(String(it.quantity), colQtyX, y + 4.5, { align: "center" });
      doc.text(money(it.unitPrice), colPriceX, y + 4.5, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 17, 17);
      doc.text(money(it.subtotal), colSubX, y + 4.5, { align: "right" });

      y += rowH;
    });
  }

  // Bottom border under items
  doc.setDrawColor(230, 230, 230);
  doc.line(marginX, y, marginX + contentW, y);
  y += 6;

  // ── Totals (right-aligned block) ─────────────────────────────────
  const totalsW = 80;
  const totalsX = marginX + contentW - totalsW;
  const totalsRight = marginX + contentW;

  if (y + 60 > pageH - 25) {
    doc.addPage();
    y = 14;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...bodyColor);
  doc.text("Labour subtotal", totalsX, y);
  doc.text(money(data.subtotal), totalsRight, y, { align: "right" });
  y += 5;

  if ((Number(data.transportFee || 0) - Number(data.volumetricFee || 0)) > 0) {
    doc.text("Transport fee", totalsX, y);
    doc.text(money(Number(data.transportFee || 0) - Number(data.volumetricFee || 0)), totalsRight, y, { align: "right" });
    y += 5;
  }
  if (Number(data.volumetricFee || 0) > 0) {
    doc.text("Volumetric handling", totalsX, y);
    doc.text(money(data.volumetricFee), totalsRight, y, { align: "right" });
    y += 5;
  }
  if (Number(data.discount || 0) > 0) {
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(data.discountLabel || "Discount", totalsX, y);
    doc.text(`- ${money(data.discount)}`, totalsRight, y, { align: "right" });
    y += 5;
  }
  if (Number(data.secondDayFee || 0) > 0) {
    doc.setTextColor(...bodyColor);
    doc.text(`Second-day continuation${!data.secondDayFeeAdjusted && Number(data.secondDayHours || 0) > 0 ? ` (${Number(data.secondDayCrewSize) || 2} men x ${Number(data.secondDayHours)}h)` : ""}`, totalsX, y);
    doc.text(money(data.secondDayFee), totalsRight, y, { align: "right" });
    y += 5;
  }
  // Additional trip / manpower charge (e.g. split timing) — already inside total.
  if (Number(data.additionalTripCharge || 0) > 0) {
    doc.setTextColor(...bodyColor);
    doc.text("Additional trip / manpower", totalsX, y);
    doc.text(money(data.additionalTripCharge), totalsRight, y, { align: "right" });
    y += 5;
  }
  // After-office surcharge — already inside total (omitted when waived).
  if (!data.afterOfficeWaived && data.afterOfficeSurchargeApplied && Number(data.afterOfficeSurchargeAmount || 0) > 0) {
    doc.setTextColor(...bodyColor);
    doc.text("After-office surcharge", totalsX, y);
    doc.text(money(data.afterOfficeSurchargeAmount), totalsRight, y, { align: "right" });
    y += 5;
  }
  // Reconciliation adjustment — keeps the breakdown summing to the paid total.
  if (Math.abs(Number(data.adjustment || 0)) >= 0.01) {
    const adj = Number(data.adjustment);
    if (adj < 0) doc.setTextColor(220, 38, 38); else doc.setTextColor(...bodyColor);
    doc.text("Adjustment", totalsX, y);
    doc.text(`${adj < 0 ? "- " : ""}${money(Math.abs(adj))}`, totalsRight, y, { align: "right" });
    y += 5;
  }

  // Grand total divider
  doc.setDrawColor(17, 17, 17);
  doc.setLineWidth(0.6);
  doc.line(totalsX, y, totalsRight, y);
  doc.setLineWidth(0.2);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 17, 17);
  doc.text("Grand Total", totalsX, y);
  doc.text(money(data.total), totalsRight, y, { align: "right" });
  y += 6;

  // Deposit / Final breakdown
  doc.setDrawColor(229, 231, 235);
  doc.line(totalsX, y, totalsRight, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const isFullPayPdf = requiresFullUpfront(Number(data.total));

  if (isFullPayPdf) {
    // Full-upfront (under-threshold) jobs: single "Full payment" line, no split.
    if (data.depositPaidAt) doc.setTextColor(4, 120, 87);
    else doc.setTextColor(107, 114, 128);
    doc.text(`Full payment${data.depositPaidAt ? " - Paid" : ""}`, totalsX, y);
    doc.setFont("helvetica", "bold");
    doc.text(money(data.total), totalsRight, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 4;
    if (data.depositPaidAt) {
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(7);
      doc.text(`on ${dt(data.depositPaidAt, true)}`, totalsRight, y, { align: "right" });
      y += 3.5;
      doc.setFontSize(8.5);
    }
  } else {
    // Deposit line
    if (data.depositPaidAt) doc.setTextColor(4, 120, 87);
    else doc.setTextColor(107, 114, 128);
    doc.text(`Deposit (50%)${data.depositPaidAt ? " - Paid" : ""}`, totalsX, y);
    doc.setFont("helvetica", "bold");
    doc.text(money(data.depositAmount), totalsRight, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 4;
    if (data.depositPaidAt) {
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(7);
      doc.text(`on ${dt(data.depositPaidAt, true)}`, totalsRight, y, { align: "right" });
      y += 3.5;
      doc.setFontSize(8.5);
    }

    // Interim partial payments (ledger) — between deposit and closing balance,
    // chronologically, so the PDF breakdown matches the on-screen invoice.
    if (Array.isArray(data.payments)) {
      for (const p of data.payments) {
        doc.setTextColor(4, 120, 87);
        doc.text("Payment - Paid", totalsX, y);
        doc.setFont("helvetica", "bold");
        doc.text(money(p.amount), totalsRight, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 4;
        if (p.paidAt) {
          doc.setTextColor(5, 150, 105);
          doc.setFontSize(7);
          const meth = p.method ? ` - ${String(p.method).replace("_", " ")}` : "";
          doc.text(`on ${dt(p.paidAt, true)}${meth}`, totalsRight, y, { align: "right" });
          y += 3.5;
          doc.setFontSize(8.5);
        }
      }
    }

    // Final balance line
    if (data.finalPaidAt) doc.setTextColor(4, 120, 87);
    else doc.setTextColor(107, 114, 128);
    doc.text(`Final balance${data.finalPaidAt ? " - Paid" : ""}`, totalsX, y);
    doc.setFont("helvetica", "bold");
    doc.text(money(data.finalAmount), totalsRight, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 4;
    if (data.finalPaidAt) {
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(7);
      doc.text(`on ${dt(data.finalPaidAt, true)}`, totalsRight, y, { align: "right" });
      y += 3.5;
      doc.setFontSize(8.5);
    }
  }

  if (data.paidInFull) {
    y += 1;
    doc.setDrawColor(167, 243, 208);
    doc.line(totalsX, y, totalsRight, y);
    y += 5;
    if (!isFullPayPdf) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(4, 120, 87);
      doc.text("Total paid", totalsX, y);
      doc.text(money(data.total), totalsRight, y, { align: "right" });
      y += 5;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70);
    doc.text("Balance Due", totalsX, y);
    doc.text("S$0.00", totalsRight, y, { align: "right" });
    y += 4;
  }

  // ── Schedule, scope & acceptance notes ───────────────────────────
  // Split-timing dismantle/reinstall schedule, after-office waiver note,
  // special remarks, and the terms-acceptance record (when present).
  {
    const noteRows: Array<[string, string]> = [];

    if (data.timingMode === "split") {
      const dm = `${dt(data.dismantleAt)}${data.dismantleTimeWindow ? ` · ${data.dismantleTimeWindow}` : ""}`;
      const ri = `${dt(data.reinstallAt)}${data.reinstallTimeWindow ? ` · ${data.reinstallTimeWindow}` : ""}`;
      noteRows.push(["Split timing — Dismantle", dm]);
      noteRows.push(["Split timing — Reinstall", ri]);
    }
    if (data.afterOfficeWaived && data.afterOfficeInvolved) {
      noteRows.push(["After-office surcharge", "Waived"]);
    }

    {
      y += 8;
      if (y + 12 > pageH - 18) { doc.addPage(); y = 14; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...labelColor);
      doc.text("SCHEDULE & SCOPE NOTES", marginX, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...bodyColor);
      noteRows.forEach(([label, value]) => {
        if (y + 5 > pageH - 18) { doc.addPage(); y = 14; }
        doc.text(`${label}: ${value}`, marginX, y);
        y += 4.5;
      });

      if (data.specialRemarks) {
        const wrapped = doc.splitTextToSize(`Special remarks: ${data.specialRemarks}`, contentW);
        if (y + wrapped.length * 4 > pageH - 18) { doc.addPage(); y = 14; }
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 4 + 0.5;
      }

      if (data.termsAcceptedAt) {
        const parts = [`Accepted ${dt(data.termsAcceptedAt, true)}`];
        if (data.termsAcceptedVersion != null) parts.push(`quote v${data.termsAcceptedVersion}`);
        if (data.termsAcceptedAmount != null) parts.push(`at ${money(data.termsAcceptedAmount)}`);
        if (y + 5 > pageH - 18) { doc.addPage(); y = 14; }
        doc.setTextColor(4, 120, 87);
        doc.text(`Terms accepted: ${parts.join(" · ")}`, marginX, y);
        y += 4.5;
        doc.setTextColor(...bodyColor);
      } else {
        // Legacy quote with no acceptance record on file.
        if (y + 5 > pageH - 18) { doc.addPage(); y = 14; }
        doc.text("Legacy quote — acceptance record not available", marginX, y);
        y += 4.5;
      }

      if (data.cancellationRequestedAt) {
        const txt = `Cancellation requested: ${dt(data.cancellationRequestedAt, true)}${data.cancellationReason ? ` — ${data.cancellationReason}` : ""}`;
        const wrapped = doc.splitTextToSize(txt, contentW);
        if (y + wrapped.length * 4 > pageH - 18) { doc.addPage(); y = 14; }
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 4 + 0.5;
      }

      if (data.refundApprovedAmount != null || data.refundCompletedAt) {
        const status = data.refundCompletedAt
          ? `completed ${dt(data.refundCompletedAt)}`
          : data.refundDueByAt
            ? `due by ${dt(data.refundDueByAt)}`
            : "pending";
        const amt = data.refundApprovedAmount != null ? money(data.refundApprovedAmount) : "—";
        const txt = `Refund: ${amt}${data.refundMethod ? ` · ${data.refundMethod}` : ""} · ${status}${data.refundReason ? ` — ${data.refundReason}` : ""}`;
        const wrapped = doc.splitTextToSize(txt, contentW);
        if (y + wrapped.length * 4 > pageH - 18) { doc.addPage(); y = 14; }
        doc.text(wrapped, marginX, y);
        y += wrapped.length * 4 + 0.5;
      }
    }
  }

  // ── Standard Terms & Conditions ──────────────────────────────────
  {
    const isReloc = (data.items || []).some((it) => it.serviceType === "relocate");

    // Job schedule line — what the price covers (movers × scheduled hours).
    if (isReloc) {
      const sched = getJobSchedule({
        items: (data.items || []).filter((it) => it.serviceType !== "discount").map((it) => ({
          serviceType: it.serviceType || "",
          quantity: Number(it.quantity) || 1,
          volumeM3: (it as any).volumeM3 != null ? Number((it as any).volumeM3) : undefined,
          carryOnly: !!(it as any).carryOnly,
        })),
        distanceKm: (data as any).samePropertyMove ? 0 : (Number((data as any).distanceKm) || 0),
        isRelocation: true,
        crewSize: Number(data.secondDayCrewSize) || undefined,
      });
      const fmtH = (n: number) => (n % 1 === 0 ? `${n}` : n.toFixed(1));
      const schedHrs = fmtH(sched.scheduledHours);
      const manHrs = fmtH(sched.scheduledHours * sched.crewSize);
      const crewRate = sched.overtimePerManPerHour * sched.crewSize;
      y += 8;
      if (y + 12 > pageH - 18) { doc.addPage(); y = 14; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(17, 17, 17);
      doc.text(`Included on-site time: ${sched.crewSize} mover${sched.crewSize !== 1 ? "s" : ""} × ${schedHrs} hour${schedHrs === "1" ? "" : "s"} = ${manHrs} man-hours`, marginX, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      const schedWrap = doc.splitTextToSize(`Extra time beyond this is S$${sched.overtimePerManPerHour} per mover, per hour (= S$${crewRate}/hour for your ${sched.crewSize}-person crew), billed in ${sched.blockMinutes}-minute blocks.`, contentW);
      doc.text(schedWrap, marginX, y);
      y += schedWrap.length * 3.1;
    }

    const terms = getQuoteTerms({ isRelocation: isReloc });
    y += 8;
    if (y + 16 > pageH - 18) { doc.addPage(); y = 14; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(17, 17, 17);
    doc.text(QUOTE_TERMS_HEADING, marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    terms.forEach((t, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${t.title}: ${t.body}`, contentW);
      if (y + wrapped.length * 3.1 > pageH - 18) { doc.addPage(); y = 14; }
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 3.1 + 1.4;
    });
  }

  // ── Terms & Policy (dispute-protection clauses from Business Rules) ───
  // Sourced from getBusinessPolicyClauses(rules) via /api/business-rules and
  // passed in by the caller, so the wording matches the customer quote page,
  // confirmation emails and admin screens exactly.
  if (Array.isArray(data.policyClauses) && data.policyClauses.length > 0) {
    y += 8;
    if (y + 16 > pageH - 18) { doc.addPage(); y = 14; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(17, 17, 17);
    doc.text("Terms & Policy", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    data.policyClauses.forEach((c, i) => {
      const wrapped = doc.splitTextToSize(`${i + 1}. ${c.title}: ${c.body}`, contentW);
      if (y + wrapped.length * 3.1 > pageH - 18) { doc.addPage(); y = 14; }
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 3.1 + 1.4;
    });
  }

  // ── Footer (stamped on EVERY page so multi-page invoices stay branded) ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const footerY = pageH - 12;
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(marginX, footerY - 4, pageW - marginX, footerY - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Thank you for choosing TMG Install. For any questions please contact ${TEL} or ${MAIL}.`,
      pageW / 2, footerY, { align: "center" }
    );
    doc.text(`${CO} · UEN ${UEN} · ${WEB} · Vehicle ${VEHICLE}`, pageW / 2, footerY + 4, { align: "center" });
    doc.setFontSize(6.5);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${p} of ${pageCount}`, pageW - marginX, footerY + 8, { align: "right" });
  }

  return doc;
}

export function downloadInvoicePdf(data: InvoicePdfData): void {
  const doc = buildInvoicePdf(data);
  const safeRef = (data.invoiceNo || data.referenceNo || "invoice").replace(/[^A-Za-z0-9_-]/g, "_");
  doc.save(`Invoice_${safeRef}.pdf`);
}

// Open the polished PDF in a new tab and trigger the browser's print dialog on
// it. This replaces window.print() of the web page (which produced an
// unprofessional, awkwardly paginated result). If the popup is blocked we fall
// back to a normal download so the customer still gets the clean PDF.
export function openInvoicePdfForPrint(data: InvoicePdfData): void {
  try {
    const doc = buildInvoicePdf(data);
    doc.autoPrint();
    const url = doc.output("bloburl");
    const win = window.open(url, "_blank");
    if (!win) downloadInvoicePdf(data);
  } catch (e) {
    console.error("PDF print failed, falling back to download", e);
    downloadInvoicePdf(data);
  }
}
