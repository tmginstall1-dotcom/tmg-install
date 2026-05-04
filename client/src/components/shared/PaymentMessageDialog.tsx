import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Copy, MessageCircle, Mail, X, Link2, Check, Loader2 } from "lucide-react";

type PaymentPayload = {
  text: string;
  paymentLink: string;
  shortPayUrl: string;
  waMeUrl: string;
  amount: string;
  type: "deposit" | "final";
  phone: string;
  refNo: string;
  customerName: string | null;
  customerEmail: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  fetchUrl: string;
}

export function PaymentMessageDialog({ open, onClose, fetchUrl }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<PaymentPayload | null>(null);
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
        return body as PaymentPayload;
      })
      .then((p) => { if (!cancelled) setData(p); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || "Failed to generate payment message"); })
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
      data-testid="payment-message-dialog"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">
              {data?.type === "final" ? "Balance Payment Message" : "Deposit Payment Message"}
            </h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {data
                ? `${data.refNo} · S$${data.amount}${data.customerName ? ` · ${data.customerName}` : ""}`
                : "Generating fresh payment link…"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"
            data-testid="button-close-payment-dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Generating payment link…</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[13px] text-red-700" data-testid="text-payment-message-error">
              {error}
            </div>
          )}

          {data && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                  <span>Message text</span>
                  <button
                    onClick={() => copy(data.text, "text")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 normal-case tracking-normal"
                    data-testid="button-copy-payment-text"
                  >
                    {copiedField === "text" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedField === "text" ? "Copied" : "Copy"}
                  </button>
                </label>
                <textarea
                  readOnly
                  value={data.text}
                  rows={12}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full px-3 py-2.5 text-[13px] font-mono leading-relaxed border border-gray-200 rounded-xl bg-gray-50 text-gray-800 resize-none focus:outline-none focus:border-emerald-300"
                  data-testid="textarea-payment-message"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                  <span>Payment link</span>
                  <button
                    onClick={() => copy(data.paymentLink, "link")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 normal-case tracking-normal"
                    data-testid="button-copy-payment-link"
                  >
                    {copiedField === "link" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedField === "link" ? "Copied" : "Copy"}
                  </button>
                </label>
                <div className="px-3 py-2 text-[12px] font-mono text-blue-700 border border-gray-200 rounded-xl bg-gray-50 break-all" data-testid="text-payment-link">
                  {data.paymentLink}
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
                  data-testid="button-open-whatsapp"
                >
                  <MessageCircle className="w-4 h-4" />
                  Open in WhatsApp
                </a>
              )}
              {data.phone && (
                <a
                  href={`sms:+${data.phone}?body=${encodeURIComponent(data.text)}`}
                  className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors"
                  data-testid="button-open-sms"
                >
                  <MessageCircle className="w-4 h-4" />
                  SMS
                </a>
              )}
              {data.customerEmail && !data.customerEmail.endsWith("@tmginstall.com") && data.customerEmail.includes("@") && (
                <a
                  href={`mailto:${data.customerEmail}?subject=${encodeURIComponent(`Payment for ${data.refNo} — TMG Install`)}&body=${encodeURIComponent(data.text)}`}
                  className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-zinc-700 hover:bg-zinc-800 text-white text-[13px] font-semibold transition-colors"
                  data-testid="button-open-email"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </a>
              )}
            </div>
            <p className="text-[11px] text-gray-400 text-center leading-snug">
              The payment link is freshly generated and works on any channel. Customer pays the same way regardless of how they receive it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
