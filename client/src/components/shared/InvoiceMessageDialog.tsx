import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Copy, MessageCircle, Mail, X, Check, Loader2, ExternalLink, FileText, Download } from "lucide-react";

type InvoiceMessagePayload = {
  text: string;
  viewUrl: string;
  printUrl: string;
  waMeUrl: string;
  phone: string;
  refNo: string;
  invoiceNo: string;
  customerName: string | null;
  customerEmail: string | null;
  total: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  fetchUrl: string;
}

export function InvoiceMessageDialog({ open, onClose, fetchUrl }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<InvoiceMessagePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"text" | "link" | null>(null);

  useEffect(() => {
    if (!open) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(fetchUrl, { credentials: "include" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.message || `Request failed (${r.status})`);
        return body as InvoiceMessagePayload;
      })
      .then((p) => { if (!cancelled) setData(p); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || "Failed to generate invoice message"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, fetchUrl]);

  const copy = async (value: string, field: "text" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
      toast({ title: field === "text" ? "Message copied" : "Link copied", description: "Paste it into SMS, WhatsApp or email." });
    } catch {
      toast({ title: "Copy failed", description: "Long-press the text to copy manually.", variant: "destructive" });
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="invoice-message-dialog"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">Send Invoice / Receipt</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {data
                ? `${data.invoiceNo} · ${data.refNo} · S$${data.total}${data.customerName ? ` · ${data.customerName}` : ""}`
                : "Preparing invoice link…"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"
            data-testid="button-close-invoice-dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Preparing invoice…</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[13px] text-red-700" data-testid="text-invoice-message-error">
              {error}
            </div>
          )}

          {data && (
            <>
              <a
                href={`${data.viewUrl}?download=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm"
                data-testid="link-download-invoice-pdf"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download PDF (to attach in WhatsApp)
                </span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <a
                href={data.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-sm font-semibold transition-colors"
                data-testid="link-open-invoice"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Preview invoice in a new tab
                </span>
                <ExternalLink className="w-4 h-4" />
              </a>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                  <span>Message text</span>
                  <button
                    onClick={() => copy(data.text, "text")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 normal-case tracking-normal"
                    data-testid="button-copy-invoice-text"
                  >
                    {copiedField === "text" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedField === "text" ? "Copied" : "Copy"}
                  </button>
                </label>
                <textarea
                  readOnly
                  value={data.text}
                  rows={10}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full px-3 py-2.5 text-[13px] font-mono leading-relaxed border border-gray-200 rounded-xl bg-gray-50 text-gray-800 resize-none focus:outline-none focus:border-emerald-300"
                  data-testid="textarea-invoice-message"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                  <span>Invoice link</span>
                  <button
                    onClick={() => copy(data.viewUrl, "link")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 normal-case tracking-normal"
                    data-testid="button-copy-invoice-link"
                  >
                    {copiedField === "link" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedField === "link" ? "Copied" : "Copy"}
                  </button>
                </label>
                <div className="px-3 py-2 text-[12px] font-mono text-blue-700 border border-gray-200 rounded-xl bg-gray-50 break-all" data-testid="text-invoice-link">
                  {data.viewUrl}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        {data && (
          <div className="border-t border-gray-100 px-5 py-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {data.waMeUrl && (
                <a
                  href={data.waMeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-[#25D366] hover:bg-[#1db954] text-white text-[13px] font-semibold transition-colors"
                  data-testid="button-invoice-open-whatsapp"
                >
                  <MessageCircle className="w-4 h-4" />
                  Open in WhatsApp
                </a>
              )}
              {data.phone && (
                <a
                  href={`sms:+${data.phone}?body=${encodeURIComponent(data.text)}`}
                  className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors"
                  data-testid="button-invoice-open-sms"
                >
                  <MessageCircle className="w-4 h-4" />
                  SMS
                </a>
              )}
              {data.customerEmail && !data.customerEmail.endsWith("@tmginstall.com") && data.customerEmail.includes("@") && (
                <a
                  href={`mailto:${data.customerEmail}?subject=${encodeURIComponent(`Invoice ${data.invoiceNo} — TMG Install`)}&body=${encodeURIComponent(data.text)}`}
                  className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-zinc-700 hover:bg-zinc-800 text-white text-[13px] font-semibold transition-colors"
                  data-testid="button-invoice-open-email"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </a>
              )}
            </div>
            <p className="text-[11px] text-gray-400 text-center leading-snug">
              Tap "Download PDF" first to save the file, then attach it in the WhatsApp chat after the message is sent.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
