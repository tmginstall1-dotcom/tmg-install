import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// ---------------------------------------------------------------------------
// Invoice PDF generation.
//
// The PDF is a faithful capture of the on-screen invoice card (the element
// marked with `data-invoice-print` on /invoice/:ref). This guarantees the
// downloaded / printed PDF always looks EXACTLY like the website — there is no
// second, hand-drawn layout to drift out of sync.
//
// To make phones produce the same professional desktop layout (and not a
// squished mobile one), the card is cloned off-screen at a fixed desktop width
// before it is rasterised, and the two responsive spots (the "Bill To" grid and
// the totals block) are forced into their desktop arrangement on the clone.
// ---------------------------------------------------------------------------

const DESKTOP_WIDTH = 820; // matches the max-w-[820px] of the invoice card

async function renderInvoiceCanvas(source: HTMLElement): Promise<HTMLCanvasElement> {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.width = `${DESKTOP_WIDTH}px`;
  clone.style.maxWidth = "none";
  clone.style.margin = "0";
  clone.style.boxShadow = "none";
  clone.style.borderRadius = "0";

  // Responsive (sm:) utilities key off the viewport, not the element width, so
  // on a phone they would stay in their mobile arrangement. Force the desktop
  // layout for the two spots that differ.
  clone.querySelectorAll<HTMLElement>(".print-grid-2").forEach((el) => {
    el.style.display = "grid";
    el.style.gridTemplateColumns = "1fr 1fr";
  });
  clone.querySelectorAll<HTMLElement>(".print-totals").forEach((el) => {
    el.style.width = "340px";
    el.style.marginLeft = "auto";
  });

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = `${DESKTOP_WIDTH}px`;
  holder.style.background = "#ffffff";
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    return await html2canvas(clone, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: DESKTOP_WIDTH,
    });
  } finally {
    document.body.removeChild(holder);
  }
}

function canvasToPdf(canvas: HTMLCanvasElement): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sideMargin = 6;
  const imgW = pageW - sideMargin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL("image/png");

  // Place the (possibly very tall) image and shift it up one page height at a
  // time so it flows naturally across A4 pages.
  let heightLeft = imgH;
  let position = 0;
  doc.addImage(imgData, "PNG", sideMargin, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    doc.addPage();
    doc.addImage(imgData, "PNG", sideMargin, position, imgW, imgH);
    heightLeft -= pageH;
  }
  return doc;
}

// Download the invoice as a PDF that matches the on-screen card.
export async function downloadInvoicePdfFromElement(
  source: HTMLElement,
  fileName: string,
): Promise<void> {
  const canvas = await renderInvoiceCanvas(source);
  const doc = canvasToPdf(canvas);
  doc.save(fileName);
}

// Open the same PDF in a new tab and trigger the browser's print dialog. Falls
// back to a download if the popup is blocked (e.g. iOS Safari) or if rendering
// fails for any reason.
export async function openInvoicePdfFromElement(
  source: HTMLElement,
  fileName = "invoice.pdf",
): Promise<void> {
  let doc: jsPDF | null = null;
  try {
    const canvas = await renderInvoiceCanvas(source);
    doc = canvasToPdf(canvas);
    doc.autoPrint();
    const url = doc.output("bloburl");
    const win = window.open(url, "_blank");
    if (!win) doc.save(fileName);
  } catch (e) {
    console.error("Invoice print failed", e);
    // Last-resort fallback: if we managed to build the PDF, at least download it.
    if (doc) {
      try { doc.save(fileName); } catch { /* nothing more we can do */ }
    }
  }
}
