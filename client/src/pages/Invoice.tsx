import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Printer, Loader2, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { format } from "date-fns";
import { formatItemDescription } from "@/lib/itemLabel";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import { requiresFullUpfront } from "@shared/pricing";
import { QuoteTermsBlock } from "@/components/shared/QuoteTermsBlock";

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
  scheduledAt: string | null;
  timeWindow: string | null;
  completedAt: string | null;
  items: InvoiceItem[];
  subtotal: string;
  transportFee: string;
  volumetricFee?: string;
  discount: string;
  secondDayFee?: string;
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
};

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

  // Auto-print when ?print=1 / Auto-download PDF when ?download=1 is in the URL
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
    if (params.get("download") === "1") {
      const t = setTimeout(() => {
        try { downloadInvoicePdf(data); } catch (e) { console.error("PDF download failed", e); }
      }, 350);
      return () => clearTimeout(t);
    }
  }, [data]);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          [data-invoice-print], [data-invoice-print] * { visibility: visible !important; }
          [data-invoice-print] { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; background: #fff !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 py-6 sm:py-10 px-3 sm:px-6">
        {/* Toolbar (hidden in print) */}
        <div className="no-print max-w-[820px] mx-auto mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Invoice</h1>
            <p className="text-[12px] text-gray-500">{refNo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => data && downloadInvoicePdf(data)}
              disabled={!data}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              data-testid="button-download-invoice-pdf"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={() => window.print()}
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
                <div className="px-7 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                          <div className="text-[12px] text-gray-700 mt-0.5">UEN: {data.billingCompanyUen}</div>
                        )}
                        {data.billingAddress && (
                          <div className="text-[12px] text-gray-700 mt-1 whitespace-pre-line">{data.billingAddress}</div>
                        )}
                        {data.billingCompanyName && data.customerName && (
                          <div className="text-[12px] text-gray-700 mt-1">Attn: {data.customerName}</div>
                        )}
                        {data.customerPhone && <div className="text-[12px] text-gray-600 mt-0.5">{data.customerPhone}</div>}
                        {showEmail && <div className="text-[12px] text-gray-600 mt-0.5">{data.customerEmail}</div>}
                        {data.poNumber && (
                          <div className="text-[12px] text-gray-700 mt-1.5"><span className="font-semibold">PO No.:</span> {data.poNumber}</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-gray-900" data-testid="text-invoice-customer-name">{data.customerName}</div>
                        {data.billingAddress && (
                          <div className="text-[12px] text-gray-700 mt-1 whitespace-pre-line">{data.billingAddress}</div>
                        )}
                        {data.customerPhone && <div className="text-[12px] text-gray-600 mt-0.5">{data.customerPhone}</div>}
                        {showEmail && <div className="text-[12px] text-gray-600 mt-0.5">{data.customerEmail}</div>}
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
              {data.pickupAddress ? (
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
              )}
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
                      <td className="px-3 py-2 align-top text-gray-800">{formatItemDescription(it, data.items)}</td>
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
              <div className="ml-auto sm:w-[360px]">
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
                    <div className="flex justify-between text-red-600">
                      <span>Discount</span>
                      <span className="font-medium">− {money(data.discount)}</span>
                    </div>
                  )}
                  {Number(data.secondDayFee || 0) > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>Second-day continuation{Number(data.secondDayHours || 0) > 0 ? ` (${Number(data.secondDayCrewSize) || 2} men × ${Number(data.secondDayHours)}h)` : ""}</span>
                      <span className="font-medium">{money(data.secondDayFee)}</span>
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

                  {Array.isArray(data.payments) && data.payments.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-gray-200 space-y-1">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Payments received</div>
                      {data.payments.map((p) => (
                        <div key={p.id} className="flex justify-between text-[12px] text-emerald-700" data-testid={`invoice-payment-${p.id}`}>
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{p.paidAt ? dt(p.paidAt, true) : ""}{p.method ? ` · ${String(p.method).replace("_", " ")}` : ""}</span>
                          </span>
                          <span className="font-semibold">{money(p.amount)}</span>
                        </div>
                      ))}
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

            {/* Standard Terms & Conditions */}
            <div className="px-7 py-5 border-t border-gray-100">
              <QuoteTermsBlock isRelocation={data.items.some((it) => it.serviceType === "relocate")} />
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
