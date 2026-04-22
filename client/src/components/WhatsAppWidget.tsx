import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useLocation } from "wouter";
import { trackEvent } from "@/hooks/use-tracker";

type Prompt = { label: string; message: string; emoji?: string };

const PROMPTS_BY_CONTEXT: Record<string, Prompt[]> = {
  landing: [
    { label: "Get an instant quote", message: "Hi! I'd like a quote for furniture installation 🛠", emoji: "⚡" },
    { label: "Ask about pricing", message: "Hi! Can you share your pricing for installation?", emoji: "💰" },
    { label: "Available today/tomorrow?", message: "Hi! Are you available today or tomorrow?", emoji: "📅" },
  ],
  estimate: [
    { label: "I need help with my quote", message: "Hi! I'm filling in a quote on your site and need a bit of help.", emoji: "🤝" },
    { label: "I have an unusual item", message: "Hi! I have an item that doesn't fit your standard list — can you advise?", emoji: "🛋" },
    { label: "Talk to a real person", message: "Hi! Can someone call me back about my installation?", emoji: "📞" },
  ],
  quote: [
    { label: "Update my booking", message: "Hi! I need to update my booking details.", emoji: "✏️" },
    { label: "Reschedule my slot", message: "Hi! I'd like to reschedule my installation.", emoji: "📅" },
    { label: "Talk to a real person", message: "Hi! Can someone call me back about my booking?", emoji: "📞" },
  ],
  default: [
    { label: "Chat with sales", message: "Hi! I'd like to know more about TMG Install.", emoji: "💬" },
  ],
};

interface Props {
  context?: keyof typeof PROMPTS_BY_CONTEXT;
  phone?: string;
  trackPath?: string;
  /** Routes (prefix match) where this widget should not render at all. */
  hideOnRoutes?: string[];
}

const WHATSAPP_PHONE = "6580880757";
const DEFAULT_HIDDEN_ROUTES = ["/estimate", "/quote", "/portal", "/admin", "/staff", "/login"];

function isWithinBusinessHours() {
  const now = new Date();
  const sgHour = (now.getUTCHours() + 8) % 24;
  return sgHour >= 9 && sgHour < 21;
}

function isMobile() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
}

export default function WhatsAppWidget({
  context = "default",
  phone = WHATSAPP_PHONE,
  trackPath = "/",
  hideOnRoutes = DEFAULT_HIDDEN_ROUTES,
}: Props) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [showTease, setShowTease] = useState(false);
  const [dismissedTease, setDismissedTease] = useState(false);
  const [pingActive, setPingActive] = useState(true);
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const [hiddenByFooter, setHiddenByFooter] = useState(false);
  const [hiddenByKeyboard, setHiddenByKeyboard] = useState(false);
  const lastScrollY = useRef(0);
  const online = isWithinBusinessHours();

  // Skip rendering entirely on conversion pages (Estimate / Quote / Portal etc.)
  const routeBlocked = hideOnRoutes.some((r) => location === r || location.startsWith(r + "/"));

  // Tease + ping lifecycle
  useEffect(() => {
    if (routeBlocked) return;
    const dismissed = sessionStorage.getItem("wa_tease_dismissed");
    if (dismissed) setDismissedTease(true);
    else {
      const t = setTimeout(() => setShowTease(true), 8000);
      return () => clearTimeout(t);
    }
  }, [routeBlocked]);

  // Stop the green ping after ~3 pulses (~3.2s) so it doesn't loop forever
  useEffect(() => {
    if (routeBlocked) return;
    const t = setTimeout(() => setPingActive(false), 3200);
    return () => clearTimeout(t);
  }, [routeBlocked]);

  // Scroll behaviour: hide on scroll-down, reveal on scroll-up, hide near footer
  useEffect(() => {
    if (routeBlocked) return;
    let ticking = false;
    const compute = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;

      // Direction-based hide (only after we're past 200px so hero stays clean)
      if (y > 200 && Math.abs(delta) > 8) {
        setHiddenByScroll(delta > 0);
      } else if (y <= 200) {
        setHiddenByScroll(false);
      }

      // Footer proximity — hide when within 600px of page bottom
      const distFromBottom = document.documentElement.scrollHeight - (y + window.innerHeight);
      setHiddenByFooter(distFromBottom < 600);

      lastScrollY.current = y;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { compute(); ticking = false; });
    };
    // Run once on mount/route change so footer-proximity is correct even when
    // the user lands deep in the page (e.g. via anchor link or restored scroll).
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [routeBlocked]);

  // Hide while a form field is focused on mobile (mobile keyboard pushes the
  // bubble into the visible viewport and covers the input the user is typing in)
  useEffect(() => {
    if (routeBlocked) return;
    const isFormField = (el: EventTarget | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };
    const onFocus = (e: FocusEvent) => { if (isMobile() && isFormField(e.target)) setHiddenByKeyboard(true); };
    const onBlur  = (e: FocusEvent) => {
      if (!isFormField(e.target)) return;
      // If focus is moving to ANOTHER form field (e.g. tabbing between inputs
      // or focus jumping inside a portal-rendered dialog), keep the widget
      // hidden — the keyboard is still up. Only reveal once focus truly leaves.
      const next = e.relatedTarget as HTMLElement | null;
      if (next && isFormField(next)) return;
      setHiddenByKeyboard(false);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, [routeBlocked]);

  if (routeBlocked) return null;

  const dismissTease = () => {
    setShowTease(false);
    setDismissedTease(true);
    sessionStorage.setItem("wa_tease_dismissed", "1");
  };

  const openCard = () => {
    setOpen(true);
    dismissTease();
    trackEvent("cta_click", trackPath, "whatsapp_widget_open");
  };

  const buildHref = (msg: string) =>
    `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

  const prompts = PROMPTS_BY_CONTEXT[context] || PROMPTS_BY_CONTEXT.default;

  // When the card is open we always show; when collapsed we respect hide signals
  const shouldHide = !open && (hiddenByScroll || hiddenByFooter || hiddenByKeyboard);

  return (
    <div
      className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-5 z-50 flex flex-col items-end gap-3 print:hidden transition-all duration-300 ease-out ${
        shouldHide ? "opacity-0 translate-y-6 pointer-events-none" : "opacity-100 translate-y-0"
      }`}
      data-testid="whatsapp-widget"
      aria-hidden={shouldHide}
      // `inert` removes the subtree from tab order + AT discovery while hidden,
      // so keyboard users don't accidentally focus an invisible button.
      {...(shouldHide ? { inert: "" as unknown as boolean } : {})}
    >
      {/* Tease bubble */}
      {showTease && !open && (
        <div className="relative max-w-[260px] bg-white rounded-2xl rounded-br-sm shadow-2xl border border-black/5 p-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <button
            onClick={dismissTease}
            className="absolute top-2 right-2 text-black/30 hover:text-black/60"
            aria-label="Dismiss"
            data-testid="button-dismiss-whatsapp-tease"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-600 mb-1">
            {online ? "Sales · Online now" : "Sales · Replies in the morning"}
          </p>
          <p className="text-sm text-black/75 leading-snug pr-3">
            Hi! 👋 Need a quick quote? I can help in under 60 seconds.
          </p>
          <button
            onClick={openCard}
            className="mt-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-600 hover:text-emerald-700"
            data-testid="button-open-whatsapp-from-tease"
          >
            Chat now →
          </button>
        </div>
      )}

      {/* Expanded card */}
      {open && (
        <div className="w-[330px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-black/10 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* Header */}
          <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-[11px] tracking-wider">
              TMG
              {online && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 ring-2 ring-[#075E54]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold">TMG Install · Sales</p>
              <p className="text-emerald-100 text-[11px]">
                {online ? "Online · typically replies in 60 seconds" : "Away · replies in the morning"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white p-1"
              aria-label="Close"
              data-testid="button-close-whatsapp"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body — chat-style */}
          <div className="p-4 space-y-3 bg-[#ECE5DD]">
            <div className="bg-white rounded-lg rounded-tl-sm px-3 py-2.5 shadow-sm max-w-[90%]">
              <p className="text-sm text-black/85 leading-snug">
                Hi there! 👋 How can we help you today?
              </p>
              <p className="text-[10px] text-black/40 mt-1">Just now</p>
            </div>

            <div className="space-y-1.5 pt-1">
              {prompts.map((p) => (
                <a
                  key={p.label}
                  href={buildHref(p.message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("cta_click", trackPath, `whatsapp_prompt_${p.label.toLowerCase().replace(/\s+/g, "_")}`)}
                  data-testid={`link-whatsapp-prompt-${p.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="block bg-white hover:bg-emerald-50 transition-colors rounded-lg px-3 py-2.5 text-sm text-emerald-700 font-semibold border border-emerald-100 shadow-sm"
                >
                  {p.emoji && <span className="mr-2">{p.emoji}</span>}
                  {p.label}
                </a>
              ))}
            </div>
          </div>

          {/* Footer trust strip */}
          <div className="bg-white px-4 py-2.5 flex items-center justify-center gap-3 text-[10px] text-black/55 font-bold uppercase tracking-wider border-t border-black/5">
            <span>4.9★ · 127 reviews</span>
            <span className="w-1 h-1 rounded-full bg-black/20" />
            <span>Insured</span>
            <span className="w-1 h-1 rounded-full bg-black/20" />
            <span>Island-wide</span>
          </div>
        </div>
      )}

      {/* Floating button — smaller on mobile, ping limited, no fake unread badge */}
      <button
        onClick={open ? () => setOpen(false) : openCard}
        data-testid="floating-whatsapp-btn"
        className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl bg-[#25D366] hover:bg-[#20bd5c] active:scale-95 transition-all"
        aria-label="Chat on WhatsApp"
      >
        {!open && pingActive && !dismissedTease && (
          <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-40" />
        )}
        {open ? (
          <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        ) : (
          <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 sm:w-7 sm:h-7">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        )}
      </button>
    </div>
  );
}
