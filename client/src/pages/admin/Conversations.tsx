import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle, Send, Phone, RefreshCw, User, Bot, ChevronLeft,
  Search, X, ExternalLink, MapPin, Package, Calendar,
  Building2, Layers, CheckCheck, Zap, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

// ── Types ────────────────────────────────────────────────────────────────────

type Conversation = {
  phone: string;
  name: string | null;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
  state: string | null;
};

type WaMessage = {
  id: number;
  phone: string;
  direction: "inbound" | "outbound";
  body: string;
  mediaType: string | null;
  sentBy: string | null;
  readAt: string | null;
  createdAt: string;
};

type ThreadData = {
  messages: WaMessage[];
  session: any;
};

// ── State config ──────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  awaiting_name:         { label: "Getting name",    color: "text-sky-400",     dot: "bg-sky-400" },
  awaiting_address:      { label: "Getting address", color: "text-sky-400",     dot: "bg-sky-400" },
  awaiting_items:        { label: "Listing items",   color: "text-violet-400",  dot: "bg-violet-400" },
  awaiting_items_verify: { label: "Verifying items", color: "text-violet-400",  dot: "bg-violet-400" },
  awaiting_service_type: { label: "Service type",    color: "text-amber-400",   dot: "bg-amber-400" },
  awaiting_floor:        { label: "Floor details",   color: "text-amber-400",   dot: "bg-amber-400" },
  awaiting_access:       { label: "Access info",     color: "text-amber-400",   dot: "bg-amber-400" },
  awaiting_to_address:   { label: "Destination",     color: "text-amber-400",   dot: "bg-amber-400" },
  awaiting_date:         { label: "Choosing date",   color: "text-orange-400",  dot: "bg-orange-400" },
  awaiting_confirmation: { label: "Confirming",      color: "text-yellow-400",  dot: "bg-yellow-400" },
  submitted:             { label: "Submitted ✓",     color: "text-emerald-400", dot: "bg-emerald-400" },
};

function getStateConfig(state: string | null) {
  if (!state) return { label: "No session", color: "text-white/40", dot: "bg-white/20" };
  return STATE_CONFIG[state] || { label: state.replace(/_/g, " "), color: "text-white/50", dot: "bg-white/20" };
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatPhone(phone: string) {
  if (phone.startsWith("65") && phone.length >= 10)
    return `+65 ${phone.slice(2, 6)} ${phone.slice(6)}`;
  return `+${phone}`;
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" });
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const PALETTES = [
  "from-violet-500 to-purple-700",
  "from-sky-500 to-blue-700",
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-700",
  "from-indigo-500 to-blue-700",
  "from-teal-500 to-cyan-700",
  "from-fuchsia-500 to-pink-700",
];

function avatarGradient(phone: string) {
  const n = parseInt(phone.slice(-3), 10) || 0;
  return PALETTES[n % PALETTES.length];
}

function getInitials(name: string | null, phone: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

function Avatar({ name, phone, size = "md" }: { name: string | null; phone: string; size?: "sm" | "md" | "lg" }) {
  const sz = { sm: "w-8 h-8 text-[11px]", md: "w-10 h-10 text-xs", lg: "w-14 h-14 text-base" };
  return (
    <div className={`rounded-full bg-gradient-to-br ${avatarGradient(phone)} ${sz[size]} flex items-center justify-center flex-shrink-0 font-bold text-white shadow-sm`}>
      {getInitials(name, phone)}
    </div>
  );
}

// ── Quick replies ─────────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "Hi! We have received your request and will get back to you shortly 😊",
  "Could you please send us more photos of the furniture?",
  "Our team will contact you within 1 business day to confirm the booking.",
  "Please check your quote link for the latest status update.",
  "Thank you for choosing TMG Install! 🙏 Our team will be in touch soon.",
];

// ── Skeletons ─────────────────────────────────────────────────────────────────

function ConvoSkeleton() {
  return (
    <div className="px-4 py-4 border-b border-white/[0.06] animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white/[0.08] flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="flex justify-between">
            <div className="h-3.5 bg-white/[0.1] rounded w-28" />
            <div className="h-2.5 bg-white/[0.07] rounded w-8" />
          </div>
          <div className="h-2.5 bg-white/[0.07] rounded w-44" />
          <div className="h-2.5 bg-white/[0.05] rounded w-20" />
        </div>
      </div>
    </div>
  );
}

function MsgSkeleton({ right = false }: { right?: boolean }) {
  return (
    <div className={`flex ${right ? "justify-end" : "justify-start"} mb-2 animate-pulse`}>
      {!right && <div className="w-8 h-8 rounded-full bg-white/[0.08] mr-2 mt-1 flex-shrink-0" />}
      <div className={`rounded-2xl bg-white/[0.08] ${right ? "w-52 h-12" : "w-60 h-14"}`} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminConversations() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "active" | "submitted">("all");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: convos = [], isLoading: loadingConvos } = useQuery<Conversation[]>({
    queryKey: ["/api/admin/whatsapp/conversations"],
    refetchInterval: 8000,
  });

  const { data: thread, isLoading: loadingThread } = useQuery<ThreadData>({
    queryKey: ["/api/admin/whatsapp/conversations", selectedPhone],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/conversations/${selectedPhone}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedPhone,
    refetchInterval: 4000,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) =>
      apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/send`, { message }),
    onSuccess: () => {
      setReplyText("");
      setShowQuickReplies(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages?.length]);

  useEffect(() => {
    if (selectedPhone) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 80);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
    }
  }, [selectedPhone]);

  function handleSend() {
    if (!replyText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(replyText.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const selectedConvo = convos.find(c => c.phone === selectedPhone);

  // Filter conversations
  const filteredConvos = convos.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || [c.name, c.phone, c.lastMessage].some(v => v?.toLowerCase().includes(q));
    const matchFilter =
      filter === "unread" ? c.unreadCount > 0 :
      filter === "active" ? (!!c.state && c.state !== "submitted") :
      filter === "submitted" ? c.state === "submitted" :
      true;
    return matchSearch && matchFilter;
  });

  const totalUnread = convos.reduce((s, c) => s + c.unreadCount, 0);

  // Group messages by date
  const grouped: { date: string; messages: WaMessage[] }[] = [];
  if (thread?.messages) {
    let lastDate = "";
    for (const msg of thread.messages) {
      const d = formatDateHeader(msg.createdAt);
      if (d !== lastDate) { grouped.push({ date: d, messages: [] }); lastDate = d; }
      grouped[grouped.length - 1].messages.push(msg);
    }
  }

  const session = thread?.session;

  // ── Render ─────────────────────────────────────────────────────────────────

  // Mobile: show list OR chat (never both)
  const showList = !selectedPhone;
  const showChat = !!selectedPhone;

  return (
    <div className="flex h-[calc(100dvh-56px)] bg-[#0d1117] overflow-hidden" data-testid="admin-conversations">

      {/* ═══ LEFT: Conversation List ═══════════════════════════════════════ */}
      <div className={`
        ${showList ? "flex" : "hidden"} lg:flex
        flex-col w-full lg:w-[300px] xl:w-[340px] flex-shrink-0
        border-r border-white/[0.08] bg-[#0d1117]
      `}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.08] bg-[#0d1117]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              </div>
              <span className="text-sm font-bold text-white">WhatsApp Inbox</span>
              {totalUnread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#25D366] text-white text-[10px] font-black leading-none min-w-[20px] text-center">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] })}
              className="w-8 h-8 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-white transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone or message…"
              className="w-full bg-white/[0.07] border border-white/[0.1] rounded-lg text-xs text-white placeholder:text-white/35 pl-8 pr-8 py-2.5 focus:outline-none focus:border-white/25 focus:bg-white/[0.09] transition-all"
              data-testid="search-conversations"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1">
            {(["all", "unread", "active", "submitted"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md capitalize transition-all ${
                  filter === f
                    ? "bg-white/[0.12] text-white border border-white/[0.15]"
                    : "text-white/45 hover:text-white/70 hover:bg-white/[0.06]"
                }`}
                data-testid={`filter-${f}`}
              >
                {f === "unread" && totalUnread > 0 ? `Unread (${totalUnread})` : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loadingConvos && [0,1,2,3].map(i => <ConvoSkeleton key={i} />)}

          {!loadingConvos && filteredConvos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-white/25" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white/50">
                  {search ? "No results found" : filter !== "all" ? `No ${filter} conversations` : "No conversations yet"}
                </p>
                {!search && filter === "all" && (
                  <p className="text-xs text-white/30 mt-1">Messages appear here when customers chat with the bot</p>
                )}
              </div>
            </div>
          )}

          {filteredConvos.map(convo => {
            const sc = getStateConfig(convo.state);
            const isSelected = selectedPhone === convo.phone;
            const hasUnread = convo.unreadCount > 0;
            return (
              <button
                key={convo.phone}
                onClick={() => setSelectedPhone(convo.phone)}
                data-testid={`convo-${convo.phone}`}
                className={`w-full text-left px-4 py-4 transition-all border-b border-white/[0.05] ${
                  isSelected
                    ? "bg-[#25D366]/[0.1] border-l-[3px] border-l-[#25D366] pl-[13px]"
                    : "hover:bg-white/[0.04] border-l-[3px] border-l-transparent"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <Avatar name={convo.name} phone={convo.phone} size="md" />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d1117] ${sc.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-sm leading-tight truncate ${hasUnread ? "font-bold text-white" : "font-semibold text-white/85"}`}>
                        {convo.name || formatPhone(convo.phone)}
                      </span>
                      <span className="text-[10px] text-white/40 flex-shrink-0 tabular-nums font-medium">
                        {relativeTime(convo.lastAt)}
                      </span>
                    </div>
                    {convo.name && (
                      <p className="text-[11px] text-white/45 mb-0.5 font-mono">{formatPhone(convo.phone)}</p>
                    )}
                    <p className={`text-xs truncate leading-snug ${hasUnread ? "text-white/75 font-medium" : "text-white/45"}`}>
                      {convo.lastMessage}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                      {hasUnread && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#25D366] text-white text-[10px] font-black flex items-center justify-center">
                          {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#0d1117]">
          <p className="text-[10px] text-white/30 font-medium">
            {convos.length} conversation{convos.length !== 1 ? "s" : ""} · auto-refreshes
          </p>
        </div>
      </div>

      {/* ═══ CENTER: Message Thread ════════════════════════════════════════ */}
      {showChat && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* ── Thread Header — prominent, always visible ── */}
          <div className="flex-shrink-0 bg-[#161b22] border-b-2 border-white/[0.1] shadow-lg">
            {/* Mobile back row */}
            <div className="flex lg:hidden items-center gap-2 px-3 pt-3 pb-1">
              <button
                onClick={() => setSelectedPhone(null)}
                data-testid="back-to-list"
                className="flex items-center gap-1.5 text-[#25D366] font-semibold text-sm active:opacity-70 py-1 pr-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to chats</span>
              </button>
            </div>

            {/* Contact info row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="hidden lg:block">
                <Avatar name={selectedConvo?.name ?? null} phone={selectedPhone} size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-white leading-tight">
                    {selectedConvo?.name || formatPhone(selectedPhone)}
                  </p>
                  {selectedConvo?.state && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.12] ${getStateConfig(selectedConvo.state).color}`}>
                      {getStateConfig(selectedConvo.state).label}
                    </span>
                  )}
                </div>
                {selectedConvo?.name && (
                  <p className="text-[11px] text-white/50 font-mono mt-0.5">{formatPhone(selectedPhone)}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={`https://wa.me/${selectedPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] text-xs font-semibold hover:bg-[#25D366]/25 transition-all"
                  data-testid="open-whatsapp"
                >
                  <Phone className="w-3 h-3" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
                {session && (
                  <button
                    onClick={() => setShowInfo(!showInfo)}
                    className={`hidden xl:flex px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      showInfo
                        ? "bg-white/[0.12] border-white/[0.2] text-white"
                        : "bg-white/[0.05] border-white/[0.1] text-white/60 hover:text-white hover:bg-white/[0.09]"
                    }`}
                  >
                    Info
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Messages ── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-5 py-4"
            style={{ background: "linear-gradient(to bottom, #0a0f1a, #0d1117)" }}
          >
            {loadingThread && (
              <div className="space-y-4 py-2">
                <MsgSkeleton />
                <MsgSkeleton right />
                <MsgSkeleton />
                <MsgSkeleton right />
                <MsgSkeleton />
              </div>
            )}

            {!loadingThread && grouped.length === 0 && (
              <div className="flex items-center justify-center h-full text-white/30 text-sm">
                No messages yet
              </div>
            )}

            {grouped.map(group => (
              <div key={group.date}>
                {/* Date divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-white/[0.07]" />
                  <span className="text-[11px] text-white/40 font-medium px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">
                    {group.date}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.07]" />
                </div>

                <div className="space-y-0.5">
                  {group.messages.map((msg, idx) => {
                    const isOut = msg.direction === "outbound";
                    const isAdm = !!msg.sentBy?.startsWith("admin:");
                    const isBot = isOut && !isAdm;
                    const adminLabel = isAdm ? msg.sentBy!.replace("admin:", "") : null;

                    const prev = idx > 0 ? group.messages[idx - 1] : null;
                    const next = idx < group.messages.length - 1 ? group.messages[idx + 1] : null;
                    const samePrev = prev?.direction === msg.direction && prev?.sentBy === msg.sentBy;
                    const sameNext = next?.direction === msg.direction && next?.sentBy === msg.sentBy;

                    const showAvatar = !sameNext;
                    const topGap = samePrev ? "mt-0.5" : "mt-4";

                    const bubbleStyle = isOut
                      ? isAdm
                        ? "bg-indigo-600 text-white"
                        : "bg-[#1e3d2c] text-white border border-[#25D366]/25"
                      : "bg-[#1c2230] text-white border border-white/[0.08]";

                    const radius = isOut
                      ? `rounded-2xl ${samePrev ? "rounded-tr-md" : ""} ${sameNext ? "rounded-br-md" : "rounded-br-sm"}`
                      : `rounded-2xl ${samePrev ? "rounded-tl-md" : ""} ${sameNext ? "rounded-bl-md" : "rounded-bl-sm"}`;

                    return (
                      <div key={msg.id} data-testid={`msg-${msg.id}`}
                        className={`flex items-end gap-2 ${isOut ? "justify-end" : "justify-start"} ${topGap}`}
                      >
                        {/* Inbound avatar */}
                        {!isOut && (
                          <div className="w-8 flex-shrink-0 self-end mb-0.5">
                            {showAvatar && (
                              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(selectedPhone)} flex items-center justify-center text-white text-[10px] font-bold`}>
                                {getInitials(selectedConvo?.name ?? null, selectedPhone)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bubble */}
                        <div className="max-w-[72%] sm:max-w-[60%] lg:max-w-[55%]">
                          {isAdm && !samePrev && (
                            <p className="text-[10px] text-indigo-400/80 text-right mb-1 mr-1 font-semibold">
                              {adminLabel || "Admin"}
                            </p>
                          )}
                          <div className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${radius} ${bubbleStyle}`}>
                            {msg.body}
                          </div>
                          {!sameNext && (
                            <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end pr-1" : "pl-1"}`}>
                              <span className="text-[10px] text-white/30 tabular-nums">{formatTime(msg.createdAt)}</span>
                              {isBot && <Bot className="w-3 h-3 text-[#25D366]/50" />}
                              {isAdm && <CheckCheck className="w-3 h-3 text-indigo-400/60" />}
                            </div>
                          )}
                        </div>

                        {/* Outbound avatar */}
                        {isOut && (
                          <div className="w-8 flex-shrink-0 self-end mb-0.5">
                            {showAvatar && (
                              isBot
                                ? <div className="w-8 h-8 rounded-full bg-[#25D366]/15 border border-[#25D366]/25 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-[#25D366]" />
                                  </div>
                                : <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                    <User className="w-4 h-4 text-indigo-400" />
                                  </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* ── Quick Replies Panel ── */}
          {showQuickReplies && (
            <div className="flex-shrink-0 border-t border-white/[0.08] bg-[#161b22] px-4 py-3">
              <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-2">Quick Replies</p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {QUICK_REPLIES.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => { setReplyText(qr); setShowQuickReplies(false); textareaRef.current?.focus(); }}
                    className="w-full text-left text-xs text-white/65 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.07] transition-all leading-relaxed border border-transparent hover:border-white/[0.08]"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Reply Box ── */}
          <div
            className="flex-shrink-0 border-t border-white/[0.08] bg-[#161b22] px-4 py-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-end gap-2">
              {/* Quick reply toggle */}
              <button
                onClick={() => setShowQuickReplies(v => !v)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-all ${
                  showQuickReplies
                    ? "bg-indigo-600 text-white border border-indigo-500"
                    : "bg-white/[0.08] text-white/55 hover:text-white hover:bg-white/[0.12] border border-white/[0.1]"
                }`}
                title="Quick replies"
              >
                <Zap className="w-4 h-4" />
              </button>

              {/* Message input */}
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send)"
                  className="resize-none bg-[#0d1117] border-white/[0.12] text-white placeholder:text-white/30 text-sm min-h-[42px] max-h-[120px] py-2.5 px-3.5 rounded-xl focus:border-white/25 focus:bg-[#0d1117] transition-all leading-relaxed"
                  rows={1}
                  data-testid="reply-input"
                />
              </div>

              {/* Send */}
              <Button
                onClick={handleSend}
                disabled={!replyText.trim() || sendMutation.isPending}
                className="w-9 h-9 rounded-xl bg-[#25D366] hover:bg-[#1db954] text-white flex-shrink-0 p-0 flex items-center justify-center mb-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                data-testid="send-reply"
              >
                {sendMutation.isPending
                  ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
              </Button>
            </div>

            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[10px] text-white/30">
                Sending as <span className="text-indigo-400 font-semibold">Admin</span> · delivered to customer's WhatsApp
              </p>
              {replyText.length > 100 && (
                <span className={`text-[10px] tabular-nums font-medium ${replyText.length > 900 ? "text-red-400" : "text-white/30"}`}>
                  {replyText.length}/1024
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── No conversation selected (desktop empty state) ── */}
      {!showChat && (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-4">
          <div className="w-18 h-18 w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <MessageCircle className="w-9 h-9 text-white/20" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white/35">Select a conversation</p>
            <p className="text-xs text-white/20 mt-1">Choose from the list on the left to view messages</p>
          </div>
        </div>
      )}

      {/* ═══ RIGHT: Customer Info Panel (desktop XL, shown when info open) ═══ */}
      {showChat && showInfo && session && (
        <div className="hidden xl:flex flex-col w-64 flex-shrink-0 border-l border-white/[0.08] bg-[#0d1117] overflow-y-auto">
          <div className="px-4 py-5">
            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Customer Info</p>

            {/* Avatar */}
            <div className="flex flex-col items-center text-center gap-2 mb-5">
              <Avatar name={selectedConvo?.name ?? null} phone={selectedPhone!} size="lg" />
              <div>
                <p className="text-sm font-bold text-white">{selectedConvo?.name || "Unknown"}</p>
                <p className="text-xs text-white/50 mt-0.5 font-mono">{formatPhone(selectedPhone!)}</p>
              </div>
              <a
                href={`https://wa.me/${selectedPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#25D366] hover:text-[#25D366]/80 transition-colors font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Open in WhatsApp
              </a>
            </div>

            {/* State */}
            {selectedConvo?.state && (
              <div className="bg-white/[0.05] rounded-xl px-3 py-3 mb-3 border border-white/[0.07]">
                <p className="text-[9px] text-white/35 uppercase tracking-wider mb-1.5 font-semibold">Bot State</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStateConfig(selectedConvo.state).dot}`} />
                  <span className={`text-xs font-semibold ${getStateConfig(selectedConvo.state).color}`}>
                    {getStateConfig(selectedConvo.state).label}
                  </span>
                </div>
              </div>
            )}

            {/* Session fields */}
            <div className="space-y-2">
              {session.collectedAddress && (
                <InfoRow icon={<MapPin className="w-3 h-3" />} label="Address" value={session.collectedAddress} />
              )}
              {session.collectedToAddress && (
                <InfoRow icon={<MapPin className="w-3 h-3" />} label="Destination" value={session.collectedToAddress} />
              )}
              {session.collectedItems && session.collectedItems !== "__scanning__" && (
                <InfoRow icon={<Package className="w-3 h-3" />} label="Items" value={session.collectedItems} multiline />
              )}
              {session.floorLevel && (
                <InfoRow icon={<Building2 className="w-3 h-3" />} label="Floor" value={`Level ${session.floorLevel} · ${session.hasLift ? "Lift available" : "No lift"}`} />
              )}
              {session.accessDifficulty && (
                <InfoRow icon={<Layers className="w-3 h-3" />} label="Access" value={({ easy: "Easy", medium: "Moderate", hard: "Difficult" } as any)[session.accessDifficulty] || session.accessDifficulty} />
              )}
              {session.preferredDate && (
                <InfoRow icon={<Calendar className="w-3 h-3" />} label="Preferred Date" value={session.preferredDate} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, multiline = false }: {
  icon: React.ReactNode; label: string; value: string; multiline?: boolean;
}) {
  return (
    <div className="bg-white/[0.04] rounded-xl px-3 py-2.5 border border-white/[0.06]">
      <div className="flex items-center gap-1.5 mb-1 text-white/40">
        {icon}
        <span className="text-[9px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className={`text-xs text-white/75 leading-relaxed ${multiline ? "whitespace-pre-line" : "truncate"}`}>{value}</p>
    </div>
  );
}
