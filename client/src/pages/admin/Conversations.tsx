import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle, Send, Phone, RefreshCw, User, Bot, ChevronLeft,
  Search, X, Wifi, WifiOff, ExternalLink, MapPin, Package, Calendar,
  Building2, Layers, CheckCheck, Check, MoreVertical, Zap,
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  awaiting_name:         { label: "Getting name",    color: "text-sky-400",    dot: "bg-sky-400" },
  awaiting_address:      { label: "Getting address", color: "text-sky-400",    dot: "bg-sky-400" },
  awaiting_items:        { label: "Listing items",   color: "text-violet-400", dot: "bg-violet-400" },
  awaiting_items_verify: { label: "Verifying items", color: "text-violet-400", dot: "bg-violet-400" },
  awaiting_service_type: { label: "Service type",    color: "text-amber-400",  dot: "bg-amber-400" },
  awaiting_floor:        { label: "Floor details",   color: "text-amber-400",  dot: "bg-amber-400" },
  awaiting_access:       { label: "Access info",     color: "text-amber-400",  dot: "bg-amber-400" },
  awaiting_to_address:   { label: "Destination",     color: "text-amber-400",  dot: "bg-amber-400" },
  awaiting_date:         { label: "Choosing date",   color: "text-orange-400", dot: "bg-orange-400" },
  awaiting_confirmation: { label: "Confirming",      color: "text-yellow-400", dot: "bg-yellow-400" },
  submitted:             { label: "Submitted ✓",     color: "text-emerald-400", dot: "bg-emerald-400" },
};

function getStateConfig(state: string | null) {
  if (!state) return { label: "No session",  color: "text-white/30", dot: "bg-white/20" };
  return STATE_CONFIG[state] || { label: state.replace(/_/g, " "), color: "text-white/40", dot: "bg-white/20" };
}

function formatPhone(phone: string) {
  if (phone.startsWith("65") && phone.length >= 10)
    return `+65 ${phone.slice(2, 6)} ${phone.slice(6)}`;
  return `+${phone}`;
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
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

const AVATAR_PALETTE = [
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-blue-600",
];

function avatarGradient(phone: string) {
  const n = parseInt(phone.slice(-2), 10) || 0;
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function getInitials(name: string | null, phone: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

// ── Quick Reply Templates ─────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "We have received your request and will get back to you shortly! 😊",
  "Hi! Could you please provide more details or photos of the furniture?",
  "Our team will contact you within 1 business day to confirm the booking.",
  "Thank you for choosing TMG Install! 🙏",
  "Please check your quote link for the latest status update.",
];

// ── Skeleton Components ───────────────────────────────────────────────────────

function ConvoSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-white/[0.04] animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white/[0.06] flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="flex justify-between">
            <div className="h-3 bg-white/[0.08] rounded w-28" />
            <div className="h-2.5 bg-white/[0.05] rounded w-8" />
          </div>
          <div className="h-2.5 bg-white/[0.05] rounded w-40" />
          <div className="h-2.5 bg-white/[0.04] rounded w-20" />
        </div>
      </div>
    </div>
  );
}

function MsgSkeleton({ right = false }: { right?: boolean }) {
  return (
    <div className={`flex ${right ? "justify-end" : "justify-start"} mb-2 animate-pulse`}>
      {!right && <div className="w-7 h-7 rounded-full bg-white/[0.06] mr-2 mt-1 flex-shrink-0" />}
      <div className={`h-10 rounded-2xl bg-white/[0.06] ${right ? "w-48" : "w-56"}`} />
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, phone, size = "md" }: { name: string | null; phone: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-xs", lg: "w-12 h-12 text-sm" };
  return (
    <div className={`rounded-full bg-gradient-to-br ${avatarGradient(phone)} ${sizes[size]} flex items-center justify-center flex-shrink-0 font-bold text-white`}>
      {getInitials(name, phone)}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminConversations() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "active" | "submitted">("all");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: convos = [], isLoading: loadingConvos, dataUpdatedAt } = useQuery<Conversation[]>({
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

  // Track if user is near bottom of scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsNearBottom(distFromBottom < 120);
  }, []);

  // Auto-scroll only when near bottom or new messages arrive and we are already at bottom
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread?.messages?.length, isNearBottom]);

  // Reset to bottom when switching conversations
  useEffect(() => {
    if (selectedPhone) {
      setIsNearBottom(true);
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 100);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
    }
  }, [selectedPhone]);

  function handleSend() {
    if (!replyText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(replyText.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const selectedConvo = convos.find(c => c.phone === selectedPhone);

  // Filter conversations
  const filteredConvos = convos.filter(c => {
    const matchSearch = !search || [c.name, c.phone, c.lastMessage]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter =
      filter === "all" ? true :
      filter === "unread" ? c.unreadCount > 0 :
      filter === "active" ? (c.state && c.state !== "submitted") :
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

  // Session info for right panel
  const session = thread?.session;

  return (
    <div
      className="flex h-[calc(100dvh-56px)] bg-slate-950 overflow-hidden"
      data-testid="admin-conversations"
    >
      {/* ── LEFT: Conversation List ─────────────────────────────────────────── */}
      <div className={`
        ${selectedPhone ? "hidden lg:flex" : "flex"}
        flex-col w-full lg:w-[320px] xl:w-[360px] flex-shrink-0
        border-r border-white/[0.06] bg-slate-950
      `}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#25D366]/15 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">Conversations</span>
              {totalUnread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[#25D366] text-white text-[10px] font-black leading-none min-w-[18px] text-center">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] })}
              className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/70 transition-all"
              data-testid="refresh-conversations"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs text-white placeholder:text-white/25 pl-8 pr-8 py-2 focus:outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all"
              data-testid="search-conversations"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 mt-2.5">
            {(["all", "unread", "active", "submitted"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md capitalize transition-all ${
                  filter === f
                    ? "bg-white/[0.1] text-white"
                    : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
                data-testid={`filter-${f}`}
              >
                {f === "unread" && totalUnread > 0 ? `${f} (${totalUnread})` : f}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loadingConvos && [0,1,2,3].map(i => <ConvoSkeleton key={i} />)}

          {!loadingConvos && filteredConvos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-white/20" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/40">
                  {search ? "No results" : filter !== "all" ? `No ${filter} conversations` : "No conversations yet"}
                </p>
                <p className="text-xs text-white/20 mt-1">
                  {!search && filter === "all" && "Messages will appear here once customers chat with the bot"}
                </p>
              </div>
            </div>
          )}

          {filteredConvos.map(convo => {
            const sc = getStateConfig(convo.state);
            const isSelected = selectedPhone === convo.phone;
            return (
              <button
                key={convo.phone}
                onClick={() => setSelectedPhone(convo.phone)}
                data-testid={`convo-${convo.phone}`}
                className={`w-full text-left px-4 py-3.5 border-b border-white/[0.03] transition-all ${
                  isSelected
                    ? "bg-[#25D366]/[0.08] border-l-2 border-l-[#25D366]"
                    : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <Avatar name={convo.name} phone={convo.phone} size="md" />
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${sc.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm leading-tight truncate ${convo.unreadCount > 0 ? "font-bold text-white" : "font-semibold text-white/80"}`}>
                        {convo.name || formatPhone(convo.phone)}
                      </span>
                      <span className="text-[9px] text-white/25 flex-shrink-0 mt-0.5 tabular-nums">
                        {relativeTime(convo.lastAt)}
                      </span>
                    </div>
                    {convo.name && (
                      <p className="text-[10px] text-white/30 -mt-0.5 mb-0.5">{formatPhone(convo.phone)}</p>
                    )}
                    <p className={`text-xs truncate mt-0.5 ${convo.unreadCount > 0 ? "text-white/70" : "text-white/35"}`}>
                      {convo.lastMessage}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-[9px] font-medium ${sc.color}`}>{sc.label}</span>
                      {convo.unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-white text-[9px] font-black flex items-center justify-center">
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

        {/* Footer: last sync */}
        <div className="px-4 py-2 border-t border-white/[0.04] flex items-center gap-1.5">
          <Wifi className="w-2.5 h-2.5 text-[#25D366]" />
          <span className="text-[9px] text-white/20">
            Live · {convos.length} conversation{convos.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── CENTER: Message Thread ──────────────────────────────────────────── */}
      {selectedPhone ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Thread Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 bg-slate-950 flex-shrink-0">
            <button
              onClick={() => setSelectedPhone(null)}
              className="lg:hidden w-8 h-8 -ml-1 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/60 hover:text-white transition-all"
              data-testid="back-to-list"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <Avatar name={selectedConvo?.name ?? null} phone={selectedPhone} size="sm" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white truncate leading-tight">
                  {selectedConvo?.name || formatPhone(selectedPhone)}
                </p>
                {selectedConvo?.state && (
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] ${getStateConfig(selectedConvo.state).color}`}>
                    {getStateConfig(selectedConvo.state).label}
                  </span>
                )}
              </div>
              {selectedConvo?.name && (
                <p className="text-[10px] text-white/30 leading-tight">{formatPhone(selectedPhone)}</p>
              )}
            </div>

            <div className="flex items-center gap-1">
              <a
                href={`https://wa.me/${selectedPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-[#25D366] transition-all"
                data-testid="open-whatsapp"
                title="Open in WhatsApp"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setShowInfo(!showInfo)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${showInfo ? "bg-white/[0.1] text-white" : "hover:bg-white/[0.06] text-white/30 hover:text-white"}`}
                title="Customer info"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
            style={{
              background: "radial-gradient(ellipse at 50% 0%, rgba(37,211,102,0.03) 0%, transparent 70%), #0a0f1a",
            }}
          >
            {loadingThread && (
              <div className="space-y-3 py-2">
                <MsgSkeleton />
                <MsgSkeleton right />
                <MsgSkeleton />
                <MsgSkeleton right />
                <MsgSkeleton />
              </div>
            )}

            {!loadingThread && grouped.length === 0 && (
              <div className="flex items-center justify-center py-20 text-white/20 text-sm">No messages yet</div>
            )}

            {grouped.map((group) => (
              <div key={group.date}>
                {/* Date divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-white/[0.05]" />
                  <span className="text-[10px] text-white/25 font-medium px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
                    {group.date}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.05]" />
                </div>

                <div className="space-y-0.5">
                  {group.messages.map((msg, idx) => {
                    const isOutbound = msg.direction === "outbound";
                    const isAdmin = msg.sentBy?.startsWith("admin:");
                    const isBotMsg = isOutbound && !isAdmin;
                    const adminName = isAdmin ? msg.sentBy!.replace("admin:", "") : null;

                    const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
                    const nextMsg = idx < group.messages.length - 1 ? group.messages[idx + 1] : null;
                    const isSameAsPrev = prevMsg?.direction === msg.direction && prevMsg?.sentBy === msg.sentBy;
                    const isSameAsNext = nextMsg?.direction === msg.direction && nextMsg?.sentBy === msg.sentBy;

                    // Cluster messages — hide avatar for consecutive messages from same sender
                    const showAvatar = !isSameAsNext;
                    const topGap = isSameAsPrev ? "mt-0.5" : "mt-3";

                    // Bubble tail rounding
                    let bubbleRounding = "rounded-2xl";
                    if (isOutbound) {
                      if (isSameAsPrev && isSameAsNext) bubbleRounding = "rounded-2xl rounded-br-md";
                      else if (isSameAsPrev) bubbleRounding = "rounded-2xl rounded-br-sm";
                      else if (isSameAsNext) bubbleRounding = "rounded-2xl rounded-br-md";
                    } else {
                      if (isSameAsPrev && isSameAsNext) bubbleRounding = "rounded-2xl rounded-bl-md";
                      else if (isSameAsPrev) bubbleRounding = "rounded-2xl rounded-bl-sm";
                      else if (isSameAsNext) bubbleRounding = "rounded-2xl rounded-bl-md";
                    }

                    const bubbleColor = isOutbound
                      ? isAdmin
                        ? "bg-indigo-600 text-white"
                        : "bg-[#1a4731] text-white border border-[#25D366]/20"
                      : "bg-slate-800/90 text-white/90 border border-white/[0.06]";

                    return (
                      <div
                        key={msg.id}
                        data-testid={`msg-${msg.id}`}
                        className={`flex items-end gap-2 ${isOutbound ? "justify-end" : "justify-start"} ${topGap}`}
                      >
                        {/* Inbound avatar spacer */}
                        {!isOutbound && (
                          <div className="w-7 flex-shrink-0 self-end mb-0.5">
                            {showAvatar && (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[9px] font-bold">
                                {getInitials(selectedConvo?.name ?? null, selectedPhone)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message bubble */}
                        <div className={`max-w-[70%] lg:max-w-[55%] xl:max-w-[50%]`}>
                          {/* Sender label (admin only, first in a cluster) */}
                          {isAdmin && !isSameAsPrev && (
                            <p className="text-[9px] text-indigo-400/70 text-right mb-1 mr-1 font-medium">
                              {adminName || "Admin"}
                            </p>
                          )}

                          <div className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${bubbleRounding} ${bubbleColor}`}>
                            {msg.body}
                          </div>

                          {/* Timestamp — only on last in cluster */}
                          {!isSameAsNext && (
                            <div className={`flex items-center gap-1 mt-1 ${isOutbound ? "justify-end pr-1" : "justify-start pl-1"}`}>
                              <span className="text-[9px] text-white/20 tabular-nums">{formatTime(msg.createdAt)}</span>
                              {isBotMsg && <Bot className="w-2.5 h-2.5 text-[#25D366]/40" />}
                              {isAdmin && <CheckCheck className="w-3 h-3 text-indigo-400/50" />}
                            </div>
                          )}
                        </div>

                        {/* Outbound avatar spacer */}
                        {isOutbound && (
                          <div className="w-7 flex-shrink-0 self-end mb-0.5">
                            {showAvatar && (
                              isBotMsg
                                ? <div className="w-7 h-7 rounded-full bg-[#25D366]/15 border border-[#25D366]/20 flex items-center justify-center">
                                    <Bot className="w-3.5 h-3.5 text-[#25D366]" />
                                  </div>
                                : <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                    <User className="w-3.5 h-3.5 text-indigo-400" />
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

            <div ref={messagesEndRef} className="h-2" />
          </div>

          {/* Quick Replies Panel */}
          {showQuickReplies && (
            <div className="border-t border-white/[0.06] bg-slate-900 px-4 py-2 flex-shrink-0">
              <p className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-2">Quick Replies</p>
              <div className="space-y-1">
                {QUICK_REPLIES.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => { setReplyText(qr); setShowQuickReplies(false); textareaRef.current?.focus(); }}
                    className="w-full text-left text-xs text-white/60 hover:text-white px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-all leading-relaxed"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reply Box */}
          <div className="px-4 py-3 border-t border-white/[0.06] bg-slate-950 flex-shrink-0" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div className="flex items-end gap-2">
              {/* Quick replies toggle */}
              <button
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all mb-0.5 ${
                  showQuickReplies ? "bg-indigo-600 text-white" : "bg-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.1]"
                }`}
                title="Quick replies"
              >
                <Zap className="w-4 h-4" />
              </button>

              {/* Textarea */}
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message… (Enter to send, Shift+Enter for new line)"
                  className="resize-none bg-slate-800/80 border-white/[0.08] text-white placeholder:text-white/20 text-sm min-h-[42px] max-h-[120px] py-2.5 px-3.5 rounded-xl focus:border-white/20 focus:bg-slate-800 transition-all leading-relaxed"
                  rows={1}
                  data-testid="reply-input"
                />
              </div>

              {/* Send button */}
              <Button
                onClick={handleSend}
                disabled={!replyText.trim() || sendMutation.isPending}
                className="w-9 h-9 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white flex-shrink-0 p-0 flex items-center justify-center mb-0.5 disabled:opacity-40 transition-all"
                data-testid="send-reply"
              >
                {sendMutation.isPending
                  ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
              </Button>
            </div>

            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[9px] text-white/20">
                Sending as <span className="text-indigo-400">Admin</span> · customer receives on WhatsApp
              </p>
              {replyText.length > 0 && (
                <span className={`text-[9px] tabular-nums ${replyText.length > 900 ? "text-red-400" : "text-white/20"}`}>
                  {replyText.length}/1024
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── Empty State (desktop, no conversation selected) ── */
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-4 text-white/20">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <MessageCircle className="w-8 h-8" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs mt-1 text-white/15">Choose from the list to view messages and reply</p>
          </div>
        </div>
      )}

      {/* ── RIGHT: Customer Info Panel (desktop, toggleable) ──────────────── */}
      {selectedPhone && showInfo && (
        <div className="hidden xl:flex flex-col w-72 flex-shrink-0 border-l border-white/[0.06] bg-slate-950 overflow-y-auto">
          <div className="px-4 py-4 border-b border-white/[0.06]">
            <p className="text-[9px] font-black text-white/25 uppercase tracking-widest mb-4">Customer Info</p>

            {/* Avatar + name */}
            <div className="flex flex-col items-center text-center gap-2 mb-5">
              <Avatar name={selectedConvo?.name ?? null} phone={selectedPhone} size="lg" />
              <div>
                <p className="text-sm font-bold text-white">{selectedConvo?.name || "Unknown"}</p>
                <p className="text-xs text-white/40 mt-0.5">{formatPhone(selectedPhone)}</p>
              </div>
              <a
                href={`https://wa.me/${selectedPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#25D366] hover:text-[#25D366]/80 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Open in WhatsApp
              </a>
            </div>

            {/* State */}
            {selectedConvo?.state && (
              <div className="bg-white/[0.04] rounded-xl px-3 py-2.5 mb-3">
                <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">Bot State</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStateConfig(selectedConvo.state).dot}`} />
                  <span className={`text-xs font-semibold ${getStateConfig(selectedConvo.state).color}`}>
                    {getStateConfig(selectedConvo.state).label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Session details */}
          {session && (
            <div className="px-4 py-4 space-y-3">
              <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">Quote in Progress</p>

              {session.collectedAddress && (
                <InfoRow icon={<MapPin className="w-3 h-3" />} label="Address" value={session.collectedAddress} />
              )}
              {session.collectedToAddress && (
                <InfoRow icon={<MapPin className="w-3 h-3" />} label="Destination" value={session.collectedToAddress} />
              )}
              {session.collectedItems && session.collectedItems !== "__scanning__" && (
                <InfoRow
                  icon={<Package className="w-3 h-3" />}
                  label="Items"
                  value={session.collectedItems.replace(/^[•\-]\s*/gm, "").trim()}
                  multiline
                />
              )}
              {session.floorLevel && (
                <InfoRow icon={<Building2 className="w-3 h-3" />} label="Floor" value={`Level ${session.floorLevel} · ${session.hasLift ? "Lift ✓" : "No lift"}`} />
              )}
              {session.accessDifficulty && (
                <InfoRow icon={<Layers className="w-3 h-3" />} label="Access" value={
                  { easy: "Easy", medium: "Moderate", hard: "Difficult" }[session.accessDifficulty as string] || session.accessDifficulty
                } />
              )}
              {session.preferredDate && (
                <InfoRow icon={<Calendar className="w-3 h-3" />} label="Preferred Date" value={session.preferredDate} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, multiline = false }: { icon: React.ReactNode; label: string; value: string; multiline?: boolean }) {
  return (
    <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1 text-white/30">
        {icon}
        <span className="text-[9px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className={`text-xs text-white/70 leading-relaxed ${multiline ? "whitespace-pre-line" : "truncate"}`}>{value}</p>
    </div>
  );
}
