import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Bell, ChevronRight, ClipboardList, DollarSign,
  AlertCircle, MessageCircle, Receipt, Calendar, FileText,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

type Quote = {
  id: number; referenceNo?: string; status?: string; total?: number | string;
  scheduledAt?: string | null; preferredDate?: string | null;
  pickupAddress?: string | null; serviceAddress?: string | null;
  customer?: { name?: string; phone?: string; email?: string } | null;
};

type OutstandingInvoice = {
  id: number; referenceNo: string; customerName: string | null;
  companyName: string | null; total: number; daysOutstanding: number;
  daysUntilDue: number; bucket: "current" | "due_soon" | "overdue";
};

// ────────────────────────────────────────────────────────────────────────────
// Global search palette (⌘K / Ctrl+K) — Yeezy / editorial
// ────────────────────────────────────────────────────────────────────────────
function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const { data: quotesRaw } = useQuery<Quote[]>({ queryKey: ["/api/quotes"], enabled: open });
  const { data: staffRaw } = useQuery<any[]>({ queryKey: ["/api/staff"], enabled: open });
  const quotes: Quote[] = Array.isArray(quotesRaw) ? quotesRaw : [];
  const staff: any[]    = Array.isArray(staffRaw)  ? staffRaw  : [];

  useEffect(() => { if (open) { setQuery(""); setActiveIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  type Result =
    | { kind: "quote"; id: number; title: string; subtitle: string; href: string; pill?: string }
    | { kind: "staff"; id: number; title: string; subtitle: string; href: string };

  const results: Result[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const out: Result[] = [];

    for (const quote of quotes) {
      const hit =
        quote.customer?.name?.toLowerCase().includes(q) ||
        quote.referenceNo?.toLowerCase().includes(q) ||
        quote.customer?.phone?.toLowerCase().includes(q) ||
        quote.customer?.email?.toLowerCase().includes(q) ||
        quote.serviceAddress?.toLowerCase().includes(q) ||
        quote.pickupAddress?.toLowerCase().includes(q);
      if (hit) {
        out.push({
          kind: "quote",
          id: quote.id,
          title: quote.customer?.name || "Unknown customer",
          subtitle: `${quote.referenceNo || "—"} · ${quote.serviceAddress || quote.pickupAddress || "no address"}`,
          href: `/admin/quotes/${quote.id}`,
          pill: quote.status?.replace(/_/g, " "),
        });
      }
      if (out.length >= 12) break;
    }

    for (const s of staff as any[]) {
      const hit =
        s.name?.toLowerCase().includes(q) ||
        s.username?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q);
      if (hit) {
        out.push({
          kind: "staff",
          id: s.id,
          title: s.name || s.username || "Staff",
          subtitle: `${s.role || "staff"}${s.phone ? ` · ${s.phone}` : ""}`,
          href: `/admin/staff`,
        });
      }
      if (out.length >= 20) break;
    }

    return out;
  }, [query, quotes, staff]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[activeIdx];
      if (pick) { navigate(pick.href); onClose(); }
    } else if (e.key === "Escape") { onClose(); }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
      data-testid="search-palette"
    >
      <div
        className="w-full max-w-xl bg-white border border-[#0A0A0A] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-black/15">
          <Search className="w-3.5 h-3.5 text-[#0A0A0A]/55 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="SEARCH QUOTES, CUSTOMERS, REF NO, PHONE, STAFF…"
            className="flex-1 text-[12px] font-bold uppercase tracking-[0.08em] text-[#0A0A0A] placeholder:text-black/35 placeholder:font-black placeholder:tracking-[0.16em] focus:outline-none bg-transparent"
            data-testid="input-global-search"
          />
          <kbd className="hidden sm:inline-flex items-center h-5 px-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#0A0A0A]/55 bg-[#EBE9E2] border border-black/15">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="p-10 text-center">
              <Search className="w-7 h-7 text-black/20 mx-auto mb-3" strokeWidth={1.4} />
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]">Search by name, reference, phone, address, or staff</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/45 mt-3">↑↓ navigate · ↵ open · ESC close</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]">No results</p>
              <p className="text-[11px] font-medium text-black/55 mt-2">for "{query}"</p>
            </div>
          ) : (
            <div className="divide-y divide-black/8">
              {results.map((r, i) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  onClick={() => { navigate(r.href); onClose(); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  data-testid={`search-result-${r.kind}-${r.id}`}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    i === activeIdx ? "bg-[#0A0A0A] text-white" : "hover:bg-[#EBE9E2]"
                  }`}
                >
                  <div className={`w-7 h-7 flex items-center justify-center shrink-0 ${
                    i === activeIdx ? "bg-white text-[#0A0A0A]" : "bg-[#0A0A0A] text-white"
                  }`}>
                    {r.kind === "quote" ? <FileText className="w-3.5 h-3.5" /> : <ClipboardList className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-black uppercase tracking-[0.08em] truncate ${i === activeIdx ? "text-white" : "text-[#0A0A0A]"}`}>{r.title}</p>
                    <p className={`text-[11px] truncate mt-0.5 font-medium ${i === activeIdx ? "text-white/70" : "text-black/55"}`}>{r.subtitle}</p>
                  </div>
                  {"pill" in r && r.pill && (
                    <span className={`text-[9px] font-black uppercase tracking-[0.16em] px-1.5 h-5 inline-flex items-center shrink-0 ${
                      i === activeIdx ? "bg-white text-[#0A0A0A]" : "bg-[#EBE9E2] text-[#0A0A0A]"
                    }`}>
                      {r.pill}
                    </span>
                  )}
                  <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${i === activeIdx ? "text-white/80" : "text-black/30"}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Notification bell — Yeezy / editorial
// ────────────────────────────────────────────────────────────────────────────
type BellItem = {
  key: string;
  icon: any;
  label: string;
  count: number;
  href: string;
  urgent?: boolean;
};

function NotificationBell() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: quotesRaw } = useQuery<Quote[]>({ queryKey: ["/api/quotes"] });
  const { data: convosRaw } = useQuery<any[]>({
    queryKey: ["/api/admin/whatsapp/conversations"],
  });
  const { data: outstanding } = useQuery<{ items: OutstandingInvoice[]; overdueCount: number; count: number }>({
    queryKey: ["/api/admin/commercial/outstanding-invoices"],
  });
  const { data: pendingReceiptsRaw } = useQuery<any[]>({
    queryKey: ["/api/admin/receipts", "", "", ""],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/receipts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    select: (d: any) => (Array.isArray(d) ? d.filter((r: any) => r.status === "pending") : []),
  });
  const { data: pendingAmendmentsRaw } = useQuery<any[]>({
    queryKey: ["/api/admin/attendance/amendments"],
    select: (d: any) => (Array.isArray(d) ? d.filter((a: any) => a.status === "pending") : []),
  });
  const { data: pendingLeaveRaw } = useQuery<any[]>({
    queryKey: ["/api/admin/leave", "pending"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/leave?status=pending`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const quotes:           Quote[] = Array.isArray(quotesRaw)           ? quotesRaw           : [];
  const convos:           any[]   = Array.isArray(convosRaw)           ? convosRaw           : [];
  const pendingReceipts:  any[]   = Array.isArray(pendingReceiptsRaw)  ? pendingReceiptsRaw  : [];
  const pendingAmendments:any[]   = Array.isArray(pendingAmendmentsRaw)? pendingAmendmentsRaw: [];
  const pendingLeave:     any[]   = Array.isArray(pendingLeaveRaw)     ? pendingLeaveRaw     : [];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const newQuoteCount     = quotes.filter(q => ["submitted", "under_review"].includes(q.status || "")).length;
  const paymentDueCount   = quotes.filter(q => ["completed", "final_payment_requested"].includes(q.status || "")).length;
  const depositDueCount   = quotes.filter(q => ["deposit_requested", "approved"].includes(q.status || "")).length;
  const overdueInvCount   = outstanding?.overdueCount ?? 0;
  const waUnreadCount     = (convos as any[]).reduce((s, c: any) => s + (c.unreadCount || 0), 0);
  const pausedBotCount    = (convos as any[]).filter((c: any) => c.botPaused).length;
  const receiptsCount     = (pendingReceipts as any[]).length;
  const hrCount           = (pendingAmendments as any[]).length + (pendingLeave as any[]).length;

  const items: BellItem[] = [
    { key: "new-quotes",   icon: ClipboardList, label: "New quote requests",       count: newQuoteCount,   href: "/admin",              urgent: true },
    { key: "payment-due",  icon: AlertCircle,   label: "Final payment due",        count: paymentDueCount, href: "/admin",              urgent: true },
    { key: "deposit-due",  icon: DollarSign,    label: "Awaiting deposit",         count: depositDueCount, href: "/admin" },
    { key: "overdue-inv",  icon: FileText,      label: "Overdue invoices",         count: overdueInvCount, href: "/admin",              urgent: true },
    { key: "wa-unread",    icon: MessageCircle, label: "Unread WhatsApp",          count: waUnreadCount,   href: "/admin/conversations" },
    { key: "wa-paused",    icon: MessageCircle, label: "Bot paused (needs reply)", count: pausedBotCount,  href: "/admin/conversations", urgent: true },
    { key: "receipts",     icon: Receipt,       label: "Receipts to approve",      count: receiptsCount,   href: "/admin/receipts" },
    { key: "hr",           icon: Calendar,      label: "Staff HR pending",         count: hrCount,         href: "/admin/staff" },
  ].filter(it => it.count > 0);

  const total = items.reduce((s, it) => s + it.count, 0);
  const hasUrgent = items.some(it => it.urgent && it.count > 0);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        data-testid="button-notification-bell"
        className="relative h-9 w-9 flex items-center justify-center text-[#0A0A0A]/70 hover:text-[#0A0A0A] hover:bg-black/5 transition-colors"
        aria-label={`${total} notifications`}
      >
        <Bell className={`w-4 h-4 ${hasUrgent ? "text-[#C1121F]" : ""}`} strokeWidth={1.75} />
        {total > 0 && (
          <span className={`absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 text-[9px] font-black tabular-nums text-white flex items-center justify-center leading-none ${
            hasUrgent ? "bg-[#C1121F]" : "bg-[#0A0A0A]"
          }`} data-testid="badge-notification-count">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-[#0A0A0A] z-50 overflow-hidden" data-testid="notification-dropdown">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/15 bg-[#EBE9E2]">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#0A0A0A]">Notifications</h3>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55 tabular-nums">{total} pending</span>
          </div>
          {items.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-3 text-center">
              <Bell className="w-7 h-7 text-black/20" strokeWidth={1.4} />
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]">All caught up</p>
              <p className="text-[11px] font-medium text-black/55">Nothing needs attention right now</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-black/8">
              {items.map(it => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.key}
                    onClick={() => { navigate(it.href); setOpen(false); }}
                    data-testid={`notification-${it.key}`}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#EBE9E2] transition-colors group"
                  >
                    <div className={`w-7 h-7 flex items-center justify-center shrink-0 ${
                      it.urgent ? "bg-[#C1121F] text-white" : "bg-[#0A0A0A] text-white"
                    }`}>
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black uppercase tracking-[0.08em] text-[#0A0A0A] truncate">{it.label}</p>
                    </div>
                    <span className="text-[14px] font-black tabular-nums text-[#0A0A0A] shrink-0">{it.count}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-black/30 group-hover:text-[#0A0A0A] transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Public: AdminTopbarTools
// ────────────────────────────────────────────────────────────────────────────
export function AdminTopbarTools() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setSearchOpen(true)}
        data-testid="button-open-global-search"
        className="hidden md:inline-flex items-center gap-2 h-9 pl-3 pr-2 border border-black/20 text-[#0A0A0A]/60 hover:text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#EBE9E2] transition-colors min-w-[200px]"
        title="Search anything (⌘K)"
      >
        <Search className="w-3.5 h-3.5" strokeWidth={1.75} />
        <span className="text-[11px] font-black uppercase tracking-[0.16em] flex-1 text-left">Search…</span>
        <kbd className="inline-flex items-center h-5 px-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#0A0A0A]/55 bg-[#EBE9E2] border border-black/15">⌘K</kbd>
      </button>

      <button
        onClick={() => setSearchOpen(true)}
        data-testid="button-open-global-search-mobile"
        className="md:hidden h-9 w-9 flex items-center justify-center text-[#0A0A0A]/70 hover:text-[#0A0A0A] hover:bg-black/5 transition-colors"
        aria-label="Search"
      >
        <Search className="w-4 h-4" strokeWidth={1.75} />
      </button>

      <NotificationBell />

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
