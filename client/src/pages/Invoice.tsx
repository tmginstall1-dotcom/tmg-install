import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Printer, Loader2, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { format } from "date-fns";
import { formatItemDescription } from "@/lib/itemLabel";
import { groupStops, itemRouteLabel } from "@/lib/stops";
import type { QuoteStop } from "@shared/schema";
import { requiresFullUpfront } from "@shared/pricing";
import { QuoteTermsBlock } from "@/components/shared/QuoteTermsBlock";
import { QuoteScheduleNote } from "@/components/shared/QuoteScheduleNote";

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

type InvoicePayload = {
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
  payments?: { id: number; amount: string; method: string; note: string | null; paidAt: string | null }[];
  amountPaid?: string;
  balanceDue?: string;
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
  termsAcceptedAt?: string | null;
  termsAcceptedAmount?: string | null;
  termsAcceptedVersion?: number | null;
  termsAcceptedPdfRef?: string | null;
  version?: number | null;
  superseded?: boolean;
  // Cancellation / refund status
  cancellationRequestedAt?: string | null;
  cancellationReason?: string | null;
  refundApprovedAmount?: string | null;
  refundReason?: string | null;
  refundMethod?: string | null;
  refundDueByAt?: string | null;
  refundCompletedAt?: string | null;
};

type PolicyClause = { title: string; body: string };

const money = (v: any) =>
  `S$${Number(v || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dt = (v?: string | null, withTime = false) =>
  v ? format(new Date(v), withTime ? "d MMM yyyy, h:mm a" : "d MMM yyyy") : "—";

export default function Invoice() {
  const params = useParams<{ refNo: string }>();
  const refNo = (params.refNo || "").toUpperCase();
  const [data, setData] = useState<InvoicePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [policyClauses, setPolicyClauses] = useState<PolicyClause[]>([]);

  // Business-rules policy clauses — shared source of truth so the invoice
  // wording matches the customer quote page, emails and admin screens.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/business-rules")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body && Array.isArray(body.clauses)) setPolicyClauses(body.clauses);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/public/invoice/${encodeURIComponent(refNo)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.message || `Invoice not available (${r.status})`);
        return body as InvoicePayload;
      })
      .then((p) => { if (!cancelled) setData(p); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || "Failed to load invoice"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refNo]);

  // Ref to the on-screen invoice card (kept for any future use / scrolling).
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Clean filename used as the print document title — browsers use the title as
  // the default "Save as PDF" filename.
  const pdfFileName = () =>
    `Invoice_${String(data?.invoiceNo || refNo).replace(/[^A-Za-z0-9_-]/g, "_")}`;

  // Generate the PDF with the browser's NATIVE print engine. This prints the
  // real invoice page (vector text + graphics), so the saved PDF looks EXACTLY
  // like the website — crisp header included — with no rasterized capture and no
  // second layout that can drift out of sync.
  const printInvoice = () => {
    const prevTitle = document.title;
    let timer = 0;
    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restore);
      window.clearTimeout(timer);
    };
    document.title = pdfFileName();
    window.addEventListener("afterprint", restore);
    // Safety net: some mobile browsers never fire afterprint.
    timer = window.setTimeout(restore, 60000);
    window.focus();
    window.print();
  };

  // Download the PDF rendered ON THE SERVER. This returns a file identical to
  // the on-screen invoice (real headless browser render) and does not depend on
  // the customer's cached JS or device print engine. Falls back to the native
  // print dialog only if the server request fails.
  const handleDownload = async () => {
    if (downloading) return;
    const ref = data?.referenceNo || refNo;
    setDownloading(true);
    try {
      const res = await fetch(`/api/public/invoice/${encodeURIComponent(ref)}/pdf`);
      if (!res.ok) throw new Error(`PDF request failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfFileName()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      // Last-resort fallback so the button is never a dead end.
      printInvoice();
    } finally {
      setDownloading(false);
    }
  };
  const handlePrint = () => printInvoice();

  // Auto-open the print/save dialog when ?print=1 or ?download=1 is present
  // (emailed "Print / Save PDF" links).
  const autoActionDone = useRef(false);
  useEffect(() => {
    if (!data || autoActionDone.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") !== "1" && params.get("download") !== "1") return;
    autoActionDone.current = true;
    const t = setTimeout(() => { printInvoice(); }, 600);
    return () => clearTimeout(t);
  }, [data, policyClauses]);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 10mm; }
          html, body { background: #fff !important; }
          /* Neutralise the gray page frame so it never forces blank pages. */
          .invoice-page-wrapper { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          [data-invoice-print], [data-invoice-print] * { visibility: visible !important; }
          [data-invoice-print] {
            position: absolute !important;
            left: 0; top: 0;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          /* Force backgrounds/colours to print (dark header band, PAID badge…). */
          [data-invoice-print], [data-invoice-print] * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Keep the table header on each page and stop rows splitting mid-row. */
          [data-invoice-print] thead { display: table-header-group; }
          [data-invoice-print] tr { break-inside: avoid; page-break-inside: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="invoice-page-wrapper min-h-screen bg-gray-100 py-6 sm:py-10 px-3 sm:px-6">
        {/* Toolbar (hidden in print) */}
        <div className="no-print max-w-[820px] mx-auto mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Invoice</h1>
            <p className="text-[12px] text-gray-500">{refNo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!data || downloading}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              data-testid="button-download-invoice-pdf"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button
              onClick={handlePrint}
              disabled={!data}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              data-testid="button-print-invoice"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="max-w-[820px] mx-auto bg-white rounded-2xl p-12 flex items-center justify-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Loading invoice…</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="max-w-[820px] mx-auto bg-white rounded-2xl p-8 text-center" data-testid="text-invoice-error">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-900 mb-1">Invoice not available</p>
            <p className="text-[13px] text-gray-500">{error}</p>
          </div>
        )}

        {/* Invoice */}
        {data && !loading && (
          <div
            ref={invoiceRef}
            data-invoice-print
            data-testid="invoice-document"
            className="max-w-[820px] mx-auto bg-white rounded-2xl shadow-sm overflow-hidden print:shadow-none print:rounded-none"
            style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#111" }}
          >
            {/* Top branded band */}
            <div style={{ background: "#111", color: "#fff", padding: "18px 28px" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 3, marginBottom: 2 }}>
                    Tax Invoice / Receipt
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>TMG INSTALL</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{CO} · UEN {UEN}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 3 }}>
                    Invoice No.
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 900, lineHeight: 1, letterSpacing: 1 }}>{data.invoiceNo}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>Issued {dt(data.invoiceDate)}</div>
                </div>
              </div>
            </div>

            {/* Sub-header */}
            <div className="px-7 py-3 border-b border-gray-100 text-[11px] text-gray-500 flex flex-wrap gap-x-4 gap-y-1 justify-between">
              <span>{ADDR}</span>
              <span>{TEL} · {MAIL} · {WEB} · Vehicle {VEHICLE}</span>
            </div>

            {/* PAID IN FULL stamp */}
            {data.paidInFull && (
              <div className="px-7 pt-5">
                <div
                  className="flex items-center gap-3 px-5 py-3 rounded-xl border-2 border-emerald-300 bg-emerald-50"
                  style={{ pageBreakInside: "avoid" }}
                  data-testid="badge-paid-in-full"
                >
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest">Payment Status</div>
                    <div className="text-lg font-black text-emerald-800 leading-tight">PAID IN FULL</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-emerald-600 uppercase tracking-wide">Total Paid</div>
                    <div className="text-xl font-black text-emerald-800">{money(data.total)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Bill To + Job */}
            {(() => {
              const isCommercial = data.invoiceType === "commercial";
              const showEmail = data.customerEmail && !data.customerEmail.includes("@tmginstall.com");
              return (
                <div className="print-grid-2 px-7 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      Bill To{isCommercial ? " (Commercial)" : ""}
                    </div>
                    {isCommercial ? (
                      <>
                        <div className="text-sm font-semibold text-gray-900" data-testid="text-invoice-customer-name">
                          {data.billingCompanyName || data.customerName}
                        </div>
                        {data.billingCompanyUen && (
                          <div className="text-[12px] text-gray-700 mt-0.5"><span className="font-semibold">UEN:</span> {data.billingCompanyUen}</div>
                        )}
                        {data.billingAddress && (
                          <div className="text-[12px] text-gray-700 mt-1 whitespace-pre-line"><span className="font-semibold">Address:</span> {data.billingAddress}</div>
                        )}
                        {data.billingCompanyName && data.customerName && (
                          <div className="text-[12px] text-gray-700 mt-1"><span className="font-semibold">Attn:</span> {data.customerName}</div>
                        )}
                        {data.customerPhone && <div className="text-[12px] text-gray-600 mt-0.5"><span className="font-semibold">Phone:</span> {data.customerPhone}</div>}
                        {showEmail && <div className="text-[12px] text-gray-600 mt-0.5"><span className="font-semibold">Email:</span> {data.customerEmail}</div>}
                        {data.poNumber && (
                          <div className="text-[12px] text-gray-700 mt-1.5"><span className="font-semibold">PO No.:</span> {data.poNumber}</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-gray-900" data-testid="text-invoice-customer-name">{data.customerName}</div>
                        {data.billingAddress && (
                          <div className="text-[12px] text-gray-700 mt-1 whitespace-pre-line"><span className="font-semibold">Address:</span> {data.billingAddress}</div>
                        )}
                        {data.customerPhone && <div className="text-[12px] text-gray-600 mt-0.5"><span className="font-semibold">Phone:</span> {data.customerPhone}</div>}
                        {showEmail && <div className="text-[12px] text-gray-600 mt-0.5"><span className="font-semibold">Email:</span> {data.customerEmail}</div>}
                      </>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Job Reference</div>
                    <div className="text-sm font-mono font-bold text-blue-700" data-testid="text-invoice-ref-no">{data.referenceNo}</div>
                    {data.scheduledAt && (
                      <div className="text-[12px] text-gray-600 mt-1">
                        Service date: <span className="font-medium text-gray-800">{dt(data.scheduledAt)}{data.timeWindow ? ` · ${data.timeWindow}` : ""}</span>
                      </div>
                    )}
                    {data.completedAt && (
                      <div className="text-[12px] text-gray-600 mt-0.5">
                        Completed: <span className="font-medium text-gray-800">{dt(data.completedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Service location */}
            <div className="px-7 pb-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Service Location</div>
              {(() => {
                const grouped = groupStops(data.stops);
                const isMultiStop = grouped.all.length > 2;
                if (isMultiStop) {
                  return (
                    <div className="text-[13px] text-gray-800 space-y-1.5" data-testid="invoice-stops">
                      {grouped.pickups.map((s) => (
                        <div key={s.id}>
                          <span className="text-gray-500">{s.label}:</span> {s.address}
                          {s.floor ? `, ${s.floor}` : ""}
                          {s.hasLift === false ? " (no lift)" : ""}
                        </div>
                      ))}
                      {grouped.dropoffs.map((s) => (
                        <div key={s.id}>
                          <span className="text-gray-500">{s.label}:</span> {s.address}
                          {s.floor ? `, ${s.floor}` : ""}
                          {s.hasLift === false ? " (no lift)" : ""}
                        </div>
                      ))}
                    </div>
                  );
                }
                return data.pickupAddress ? (
                  data.samePropertyMove ? (
                    <div className="text-[13px] text-gray-800">
                      <div><span className="text-gray-500">Property:</span> {data.pickupAddress}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Same-Property Move — items relocated within the same address.</div>
                    </div>
                  ) : (
                    <div className="text-[13px] text-gray-800">
                      <div><span className="text-gray-500">Pickup:</span> {data.pickupAddress}</div>
                      <div><span className="text-gray-500">Drop-off:</span> {data.dropoffAddress || "—"}</div>
                    </div>
                  )
                ) : (
                  <div className="text-[13px] text-gray-800">{data.serviceAddress || "—"}</div>
                );
              })()}
            </div>

            {/* Items */}
            <div className="px-7 pb-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Scope of Work</div>
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr style={{ background: "#111", color: "#fff" }}>
                    <th className="text-left font-semibold px-3 py-2">Item / Description</th>
                    <th className="text-center font-semibold px-3 py-2 w-14">Qty</th>
                    <th className="text-right font-semibold px-3 py-2 w-24">Unit Price</th>
                    <th className="text-right font-semibold px-3 py-2 w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 && (
                    <tr><td colSpan={4} className="text-center text-gray-400 italic py-4">No line items</td></tr>
                  )}
                  {data.items.map((it, i) => (
                    <tr key={it.id} style={{ background: i % 2 ? "#f9fafb" : "#fff" }} data-testid={`row-invoice-item-${it.id}`}>
                      <td className="px-3 py-2 align-top text-gray-800">
                        {formatItemDescription(it, data.items)}
                        {itemRouteLabel(data.stops, it.fromStopId, it.toStopId) && (
                          <span className="block text-[11px] text-gray-500 mt-0.5" data-testid={`invoice-item-route-${it.id}`}>
                            {itemRouteLabel(data.stops, it.fromStopId, it.toStopId)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center align-top text-gray-700">{it.quantity}</td>
                      <td className="px-3 py-2 text-right align-top text-gray-700">{money(it.unitPrice)}</td>
                      <td className="px-3 py-2 text-right align-top font-semibold text-gray-900">{money(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-7 pb-6">
              <div className="print-totals ml-auto sm:w-[360px]">
                <div className="space-y-1 text-[13px]">
                  <div className="flex justify-between text-gray-700">
                    <span>Labour subtotal</span>
                    <span className="font-medium">{money(data.subtotal)}</span>
                  </div>
                  {(Number(data.transportFee || 0) - Number(data.volumetricFee || 0)) > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>Transport fee</span>
                      <span className="font-medium">{money(Number(data.transportFee || 0) - Number(data.volumetricFee || 0))}</span>
                    </div>
                  )}
                  {Number(data.volumetricFee || 0) > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>Volumetric handling</span>
                      <span className="font-medium">{money(data.volumetricFee)}</span>
                    </div>
                  )}
                  {Number(data.discount || 0) > 0 && (
                    <div className="flex justify-between text-red-600" data-testid="invoice-discount">
                      <span>{data.discountLabel || "Discount"}</span>
                      <span className="font-medium">− {money(data.discount)}</span>
                    </div>
                  )}
                  {Number(data.secondDayFee || 0) > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>Second-day continuation{!data.secondDayFeeAdjusted && Number(data.secondDayHours || 0) > 0 ? ` (${Number(data.secondDayCrewSize) || 2} men × ${Number(data.secondDayHours)}h)` : ""}</span>
                      <span className="font-medium">{money(data.secondDayFee)}</span>
                    </div>
                  )}
                  {Number(data.additionalTripCharge || 0) > 0 && (
                    <div className="flex justify-between text-gray-700" data-testid="invoice-additional-trip">
                      <span>Additional trip / manpower</span>
                      <span className="font-medium">{money(data.additionalTripCharge)}</span>
                    </div>
                  )}
                  {!data.afterOfficeWaived && data.afterOfficeSurchargeApplied && Number(data.afterOfficeSurchargeAmount || 0) > 0 && (
                    <div className="flex justify-between text-gray-700" data-testid="invoice-after-office-surcharge">
                      <span>After-office surcharge</span>
                      <span className="font-medium">{money(data.afterOfficeSurchargeAmount)}</span>
                    </div>
                  )}
                  {Math.abs(Number(data.adjustment || 0)) >= 0.01 && (
                    <div className={`flex justify-between ${Number(data.adjustment) < 0 ? "text-red-600" : "text-gray-700"}`} data-testid="invoice-adjustment">
                      <span>Adjustment</span>
                      <span className="font-medium">{Number(data.adjustment) < 0 ? "− " : ""}{money(Math.abs(Number(data.adjustment)))}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 mt-1 border-t-2 border-gray-900 font-black text-base text-gray-900">
                    <span>Grand Total</span>
                    <span data-testid="text-invoice-total">{money(data.total)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200 space-y-1.5">
                  {requiresFullUpfront(Number(data.total)) ? (
                    <>
                      <div className={`flex justify-between text-[12px] ${data.depositPaidAt ? "text-emerald-700" : "text-gray-500"}`}>
                        <span className="flex items-center gap-1.5">
                          {data.depositPaidAt && <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>Full payment{data.depositPaidAt ? " — Paid" : ""}</span>
                        </span>
                        <span className="font-semibold">{money(data.total)}</span>
                      </div>
                      {data.depositPaidAt && (
                        <div className="text-[10px] text-emerald-600 text-right -mt-1">on {dt(data.depositPaidAt, true)}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className={`flex justify-between text-[12px] ${data.depositPaidAt ? "text-emerald-700" : "text-gray-500"}`}>
                        <span className="flex items-center gap-1.5">
                          {data.depositPaidAt && <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>Deposit (50%){data.depositPaidAt ? " — Paid" : ""}</span>
                        </span>
                        <span className="font-semibold">{money(data.depositAmount)}</span>
                      </div>
                      {data.depositPaidAt && (
                        <div className="text-[10px] text-emerald-600 text-right -mt-1">on {dt(data.depositPaidAt, true)}</div>
                      )}
                      {/* Interim partial payments (ledger) shown chronologically
                          between the deposit and the closing balance, so the
                          customer sees the full installment breakdown. */}
                      {Array.isArray(data.payments) && data.payments.map((p) => (
                        <div key={p.id} data-testid={`invoice-payment-${p.id}`}>
                          <div className="flex justify-between text-[12px] text-emerald-700">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Payment — Paid</span>
                            </span>
                            <span className="font-semibold">{money(p.amount)}</span>
                          </div>
                          {p.paidAt && (
                            <div className="text-[10px] text-emerald-600 text-right -mt-1">
                              on {dt(p.paidAt, true)}{p.method ? ` · ${String(p.method).replace("_", " ")}` : ""}
                            </div>
                          )}
                        </div>
                      ))}
                      <div className={`flex justify-between text-[12px] ${data.finalPaidAt ? "text-emerald-700" : "text-gray-500"}`}>
                        <span className="flex items-center gap-1.5">
                          {data.finalPaidAt && <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>Final balance{data.finalPaidAt ? " — Paid" : ""}</span>
                        </span>
                        <span className="font-semibold">{money(data.finalAmount)}</span>
                      </div>
                      {data.finalPaidAt && (
                        <div className="text-[10px] text-emerald-600 text-right -mt-1">on {dt(data.finalPaidAt, true)}</div>
                      )}
                    </>
                  )}

                  {data.paidInFull && !requiresFullUpfront(Number(data.total)) && (
                    <div className="flex justify-between text-[12px] text-emerald-700 pt-2 mt-1 border-t border-gray-200" data-testid="invoice-total-paid">
                      <span>Total paid</span>
                      <span className="font-semibold">{money(data.total)}</span>
                    </div>
                  )}

                  <div
                    className={`flex justify-between pt-2 mt-2 border-t font-black text-sm ${
                      Number(data.paidInFull ? 0 : (data.balanceDue ?? 0)) > 0
                        ? "border-amber-200 text-amber-800"
                        : "border-emerald-200 text-emerald-800"
                    }`}
                    data-testid="invoice-balance-due"
                  >
                    <span>Balance Due</span>
                    <span>{money(data.paidInFull ? "0" : (data.balanceDue ?? "0"))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule, scope & acceptance notes */}
            {(
              <div className="px-7 pb-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Schedule & Scope Notes</div>
                <div className="space-y-1 text-[12px] text-gray-700" data-testid="invoice-scope-notes">
                  {data.timingMode === "split" && (
                    <>
                      <div data-testid="invoice-split-dismantle">
                        <span className="text-gray-500">Split timing — Dismantle:</span>{" "}
                        <span className="font-medium text-gray-800">{dt(data.dismantleAt)}{data.dismantleTimeWindow ? ` · ${data.dismantleTimeWindow}` : ""}</span>
                      </div>
                      <div data-testid="invoice-split-reinstall">
                        <span className="text-gray-500">Split timing — Reinstall:</span>{" "}
                        <span className="font-medium text-gray-800">{dt(data.reinstallAt)}{data.reinstallTimeWindow ? ` · ${data.reinstallTimeWindow}` : ""}</span>
                      </div>
                    </>
                  )}
                  {data.afterOfficeWaived && data.afterOfficeInvolved && (
                    <div data-testid="invoice-after-office-waived">
                      <span className="text-gray-500">After-office surcharge:</span>{" "}
                      <span className="font-medium text-gray-800">Waived</span>
                    </div>
                  )}
                  {data.specialRemarks && (
                    <div data-testid="invoice-special-remarks">
                      <span className="text-gray-500">Special remarks:</span>{" "}
                      <span className="font-medium text-gray-800 whitespace-pre-line">{data.specialRemarks}</span>
                    </div>
                  )}
                  {data.termsAcceptedAt ? (
                    <div className="text-emerald-700 flex items-center gap-1.5" data-testid="invoice-terms-accepted">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Terms accepted: {dt(data.termsAcceptedAt, true)}
                        {data.termsAcceptedVersion != null ? ` · quote v${data.termsAcceptedVersion}` : ""}
                        {data.termsAcceptedAmount != null ? ` · at ${money(data.termsAcceptedAmount)}` : ""}
                      </span>
                    </div>
                  ) : (
                    <div className="text-gray-500 italic" data-testid="invoice-terms-legacy">
                      Legacy quote — acceptance record not available
                    </div>
                  )}
                  {data.cancellationRequestedAt && (
                    <div data-testid="invoice-cancellation-status">
                      <span className="text-gray-500">Cancellation requested:</span>{" "}
                      <span className="font-medium text-gray-800">{dt(data.cancellationRequestedAt, true)}</span>
                      {data.cancellationReason ? <span className="text-gray-600"> — {data.cancellationReason}</span> : null}
                    </div>
                  )}
                  {(data.refundApprovedAmount != null || data.refundCompletedAt) && (
                    <div data-testid="invoice-refund-status">
                      <span className="text-gray-500">Refund:</span>{" "}
                      <span className="font-medium text-gray-800">
                        {data.refundApprovedAmount != null ? money(data.refundApprovedAmount) : "—"}
                        {data.refundMethod ? ` · ${data.refundMethod}` : ""}
                        {data.refundCompletedAt
                          ? ` · completed ${dt(data.refundCompletedAt)}`
                          : data.refundDueByAt
                            ? ` · due by ${dt(data.refundDueByAt)}`
                            : " · pending"}
                      </span>
                      {data.refundReason ? <span className="text-gray-600"> — {data.refundReason}</span> : null}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Standard Terms & Conditions */}
            <div className="px-7 py-5 border-t border-gray-100">
              {data.items.some((it) => it.serviceType === "relocate") && (
                <QuoteScheduleNote
                  items={data.items.filter((it) => it.serviceType !== "discount").map((it) => ({ serviceType: it.serviceType || "", quantity: Number(it.quantity) || 1, volumeM3: (it as any).volumeM3 != null ? Number((it as any).volumeM3) : undefined, carryOnly: !!(it as any).carryOnly }))}
                  distanceKm={data.samePropertyMove ? 0 : (Number((data as any).distanceKm) || 0)}
                  isRelocation={data.items.some((it) => it.serviceType === "relocate")}
                  crewSize={Number(data.secondDayCrewSize) || undefined}
                  className="mb-4"
                />
              )}
              <QuoteTermsBlock isRelocation={data.items.some((it) => it.serviceType === "relocate")} />

              {policyClauses.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100" data-testid="invoice-policy-summary">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Terms &amp; Policy</div>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-gray-500 leading-relaxed">
                    {policyClauses.map((c, i) => (
                      <li key={i} data-testid={`invoice-policy-clause-${i}`}>
                        <span className="font-semibold text-gray-700">{c.title}:</span> {c.body}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 py-4 border-t border-gray-100 bg-gray-50 text-center text-[11px] text-gray-500 leading-relaxed">
              Thank you for choosing TMG Install. For any questions please contact <span className="text-gray-700 font-medium">{TEL}</span> or <span className="text-gray-700 font-medium">{MAIL}</span>.
              <br />
              {CO} · UEN {UEN} · {WEB} · Vehicle {VEHICLE}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
