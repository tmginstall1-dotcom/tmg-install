import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Bell, X, ChevronRight, ClipboardList, DollarSign,
  AlertCircle, MessageCircle, Receipt, Calendar, Loader2, FileText,
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

function formatMoney(v: any) {
  return `$${Number(v || 0).toLocaleString("en-SG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Global search palette (⌘K / Ctrl+K)
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
      className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
      data-testid="search-palette"
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search quotes, customers, ref no, phone, staff…"
            className="flex-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
            data-testid="input-global-search"
          />
          <kbd className="hidden sm:inline-flex items-center h-6 px-1.5 rounded text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="p-8 text-center">
              <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">Search by name, reference, phone, address, or staff</p>
              <p className="text-[11px] text-slate-400 mt-2">↑↓ to navigate · ↵ to open · ESC to close</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500 font-medium">No results for "{query}"</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {results.map((r, i) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  onClick={() => { navigate(r.href); onClose(); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  data-testid={`search-result-${r.kind}-${r.id}`}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    i === activeIdx ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    r.kind === "quote" ? "bg-blue-100 text-blue-600" : "bg-violet-100 text-violet-600"
                  }`}>
                    {r.kind === "quote" ? <FileText className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{r.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{r.subtitle}</p>
                  </div>
                  {"pill" in r && r.pill && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      {r.pill}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
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
// Notification bell — aggregates urgent counts across admin areas
// ────────────────────────────────────────────────────────────────────────────
type BellItem = {
  key: string;
  icon: any;
  label: string;
  count: number;
  href: string;
  tone: "red" | "orange" | "blue" | "violet";
};

function NotificationBell() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // These query keys are already mounted by AdminSidebar — we just read from the
  // shared TanStack cache here. No extra network traffic.
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
    { key: "new-quotes",   icon: ClipboardList, label: "New quote requests",     count: newQuoteCount,   href: "/admin",              tone: "red" },
    { key: "payment-due",  icon: AlertCircle,   label: "Final payment due",      count: paymentDueCount, href: "/admin",              tone: "orange" },
    { key: "deposit-due",  icon: DollarSign,    label: "Awaiting deposit",       count: depositDueCount, href: "/admin",              tone: "blue" },
    { key: "overdue-inv",  icon: FileText,      label: "Overdue invoices",       count: overdueInvCount, href: "/admin",              tone: "red" },
    { key: "wa-unread",    icon: MessageCircle, label: "Unread WhatsApp",        count: waUnreadCount,   href: "/admin/conversations",tone: "violet" },
    { key: "wa-paused",    icon: MessageCircle, label: "Bot paused (needs reply)", count: pausedBotCount,href: "/admin/conversations",tone: "orange" },
    { key: "receipts",     icon: Receipt,       label: "Receipts to approve",    count: receiptsCount,   href: "/admin/receipts",     tone: "blue" },
    { key: "hr",           icon: Calendar,      label: "Staff HR pending",       count: hrCount,         href: "/admin/staff",        tone: "violet" },
  ].filter(it => it.count > 0);

  const total = items.reduce((s, it) => s + it.count, 0);
  const hasUrgent = items.some(it => it.tone === "red" && it.count > 0);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        data-testid="button-notification-bell"
        className="relative h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        aria-label={`${total} notifications`}
      >
        <Bell className={`w-[18px] h-[18px] ${hasUrgent ? "text-red-500" : ""}`} />
        {total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-black text-white flex items-center justify-center leading-none ${
            hasUrgent ? "bg-red-500 ring-2 ring-white" : "bg-blue-500 ring-2 ring-white"
          }`} data-testid="badge-notification-count">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden" data-testid="notification-dropdown">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-[13px] font-black text-slate-900 tracking-tight">Notifications</h3>
            <span className="text-[11px] font-bold text-slate-500">{total} pending</span>
          </div>
          {items.length === 0 ? (
            <div className="p-8 flex flex-col items-center gap-2 text-slate-400">
              <Bell className="w-7 h-7 text-slate-200" />
              <p className="text-sm font-semibold">You're all caught up</p>
              <p className="text-[11px] text-slate-400">Nothing needs attention right now</p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
              {items.map(it => {
                const Icon = it.icon;
                const tone = {
                  red:    "bg-red-100 text-red-600",
                  orange: "bg-orange-100 text-orange-600",
                  blue:   "bg-blue-100 text-blue-600",
                  violet: "bg-violet-100 text-violet-600",
                }[it.tone];
                return (
                  <button
                    key={it.key}
                    onClick={() => { navigate(it.href); setOpen(false); }}
                    data-testid={`notification-${it.key}`}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors group"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-900 truncate">{it.label}</p>
                    </div>
                    <span className="text-sm font-black tabular-nums text-slate-900 shrink-0">{it.count}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
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
// Public: AdminTopbarTools — mount in the Navbar for admin pages
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
        className="hidden md:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-colors min-w-[200px]"
        title="Search anything (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="text-[12px] font-medium flex-1 text-left">Search…</span>
        <kbd className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200">⌘K</kbd>
      </button>

      {/* Mobile: just the search icon */}
      <button
        onClick={() => setSearchOpen(true)}
        data-testid="button-open-global-search-mobile"
        className="md:hidden h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        aria-label="Search"
      >
        <Search className="w-[18px] h-[18px]" />
      </button>

      <NotificationBell />

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
