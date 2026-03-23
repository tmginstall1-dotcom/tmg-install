import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle, Send, Phone, RefreshCw, User, Bot, Search, X,
  ExternalLink, MapPin, Package, Calendar, Building2, Layers,
  CheckCheck, Zap, ArrowLeft, ImageIcon, ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  mediaUrl: string | null;
  sentBy: string | null;
  readAt: string | null;
  createdAt: string;
};

type ThreadData = {
  messages: WaMessage[];
  session: any;
};

// ── State config ───────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  awaiting_name:         { label: "Getting name",    color: "text-sky-600",     bg: "bg-sky-50 border-sky-200",       dot: "bg-sky-500" },
  awaiting_address:      { label: "Getting address", color: "text-sky-600",     bg: "bg-sky-50 border-sky-200",       dot: "bg-sky-500" },
  awaiting_items:        { label: "Listing items",   color: "text-violet-600",  bg: "bg-violet-50 border-violet-200", dot: "bg-violet-500" },
  awaiting_items_verify: { label: "Verifying items", color: "text-violet-600",  bg: "bg-violet-50 border-violet-200", dot: "bg-violet-500" },
  awaiting_service_type: { label: "Service type",    color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-500" },
  awaiting_floor:        { label: "Floor details",   color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-500" },
  awaiting_access:       { label: "Access info",     color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-500" },
  awaiting_to_address:   { label: "Destination",     color: "text-amber-600",   bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-500" },
  awaiting_date:         { label: "Choosing date",   color: "text-orange-600",  bg: "bg-orange-50 border-orange-200", dot: "bg-orange-500" },
  awaiting_confirmation: { label: "Confirming",      color: "text-yellow-700",  bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500" },
  submitted:             { label: "Submitted ✓",     color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
};

function getState(state: string | null) {
  if (!state) return { label: "No session", color: "text-gray-400", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-300" };
  return STATE_CONFIG[state] || { label: state.replace(/_/g, " "), color: "text-gray-500", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-400" };
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function formatPhone(phone: string) {
  if (phone.startsWith("65") && phone.length >= 10)
    return `+65 ${phone.slice(2, 6)} ${phone.slice(6)}`;
  return `+${phone}`;
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Now";
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

// ── Avatar ─────────────────────────────────────────────────────────────────────

const PALETTES = [
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-rose-600",
  "from-indigo-400 to-blue-600",
  "from-teal-400 to-cyan-600",
  "from-fuchsia-400 to-pink-600",
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

// ── Quick replies ──────────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "Hi! We have received your request and will get back to you shortly 😊",
  "Could you please send us more photos of the furniture?",
  "Our team will contact you within 1 business day to confirm the booking.",
  "Please check your quote link for the latest status update.",
  "Thank you for choosing TMG Install! 🙏 Our team will be in touch soon.",
];

// ── Skeletons ──────────────────────────────────────────────────────────────────

function ConvoSkeleton() {
  return (
    <div className="px-4 py-3.5 border-b border-gray-100 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="flex justify-between">
            <div className="h-3.5 bg-gray-200 rounded w-28" />
            <div className="h-2.5 bg-gray-100 rounded w-8" />
          </div>
          <div className="h-2.5 bg-gray-100 rounded w-44" />
          <div className="h-2.5 bg-gray-100 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

// ── InfoRow ────────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, multiline = false }: {
  icon: React.ReactNode; label: string; value: string; multiline?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
      <div className="flex items-center gap-1.5 mb-1 text-gray-400">
        {icon}
        <span className="text-[9px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className={`text-xs text-gray-700 leading-relaxed ${multiline ? "whitespace-pre-line" : "truncate"}`}>{value}</p>
    </div>
  );
}

// ── Image lightbox ─────────────────────────────────────────────────────────────

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Customer photo"
        className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

// ── Message bubble (handles text + image) ──────────────────────────────────────

function MessageBubble({
  msg, isOut, isAdm, isBot, samePrev, sameNext, adminLabel, selectedPhone, selectedConvoName,
}: {
  msg: WaMessage; isOut: boolean; isAdm: boolean; isBot: boolean;
  samePrev: boolean; sameNext: boolean; adminLabel: string | null;
  selectedPhone: string; selectedConvoName: string | null;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const isImage = msg.mediaType?.startsWith("image") ?? false;
  // mediaUrl stores the WhatsApp media ID — route it through our proxy endpoint.
  // Fall back to body if it happens to be a direct URL (legacy support).
  const imgSrc = msg.mediaUrl
    ? (msg.mediaUrl.startsWith("http") ? msg.mediaUrl : `${API_BASE}/api/admin/whatsapp/media/${msg.mediaUrl}`)
    : (msg.body?.startsWith("http") ? msg.body : null);

  const bubbleStyle = isOut
    ? isAdm
      ? "bg-indigo-600 text-white"
      : "bg-[#25D366] text-white"
    : "bg-white text-gray-800 border border-gray-200 shadow-sm";

  const radius = isOut
    ? `rounded-2xl ${samePrev ? "rounded-tr-md" : ""} ${sameNext ? "rounded-br-md" : "rounded-br-sm"}`
    : `rounded-2xl ${samePrev ? "rounded-tl-md" : ""} ${sameNext ? "rounded-bl-md" : "rounded-bl-sm"}`;

  const topGap = samePrev ? "mt-0.5" : "mt-4";

  return (
    <>
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div
        key={msg.id}
        data-testid={`msg-${msg.id}`}
        className={`flex items-end gap-2 ${isOut ? "justify-end" : "justify-start"} ${topGap}`}
      >
        {/* Inbound avatar */}
        {!isOut && (
          <div className="w-8 flex-shrink-0 self-end mb-0.5">
            {!sameNext && (
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(selectedPhone)} flex items-center justify-center text-white text-[10px] font-bold`}>
                {getInitials(selectedConvoName, selectedPhone)}
              </div>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className="max-w-[72%] sm:max-w-[60%] lg:max-w-[55%]">
          {isAdm && !samePrev && (
            <p className="text-[10px] text-indigo-500 text-right mb-1 mr-1 font-semibold">
              {adminLabel || "Admin"}
            </p>
          )}

          {/* Image bubble */}
          {isImage && imgSrc ? (
            <div className={`overflow-hidden ${radius} ${bubbleStyle} p-1`}>
              <div className="relative group cursor-pointer" onClick={() => setLightbox(imgSrc)}>
                <img
                  src={imgSrc}
                  alt="Photo"
                  className="rounded-xl max-w-full max-h-64 object-cover w-full block"
                  onError={e => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                  }}
                />
                <div className="hidden items-center gap-2 p-3 text-xs opacity-70">
                  <ImageIcon className="w-4 h-4" />
                  <span>Photo</span>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
                </div>
              </div>
              {msg.body && !msg.body.startsWith("http") && msg.body !== "[image]" && (
                <p className="text-sm px-2 pt-1 pb-0.5 leading-relaxed break-words">{msg.body}</p>
              )}
            </div>
          ) : (
            /* Text bubble */
            <div className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${radius} ${bubbleStyle}`}>
              {isImage && !imgSrc ? (
                <span className="flex items-center gap-2 opacity-70">
                  <ImageIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="italic">Photo</span>
                </span>
              ) : (
                msg.body
              )}
            </div>
          )}

          {!sameNext && (
            <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end pr-1" : "pl-1"}`}>
              <span className="text-[10px] text-gray-400 tabular-nums">{formatTime(msg.createdAt)}</span>
              {isBot && <Bot className="w-3 h-3 text-[#25D366]/70" />}
              {isAdm && <CheckCheck className="w-3 h-3 text-indigo-400" />}
            </div>
          )}
        </div>

        {/* Outbound avatar */}
        {isOut && (
          <div className="w-8 flex-shrink-0 self-end mb-0.5">
            {!sameNext && (
              isBot
                ? <div className="w-8 h-8 rounded-full bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-[#25D366]" />
                  </div>
                : <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Chat Modal ─────────────────────────────────────────────────────────────────

function ChatModal({
  selectedPhone,
  selectedConvo,
  onClose,
}: {
  selectedPhone: string;
  selectedConvo: Conversation | undefined;
  onClose: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: thread, isLoading: loadingThread } = useQuery<ThreadData>({
    queryKey: ["/api/admin/whatsapp/conversations", selectedPhone],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/conversations/${selectedPhone}`, { credentials: "include" });
      return res.json();
    },
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
    setTimeout(() => messagesEndRef.current?.scrollIntoView(), 80);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSend() {
    if (!replyText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(replyText.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const session = thread?.session;

  const grouped: { date: string; messages: WaMessage[] }[] = [];
  if (thread?.messages) {
    let lastDate = "";
    for (const msg of thread.messages) {
      const d = formatDateHeader(msg.createdAt);
      if (d !== lastDate) { grouped.push({ date: d, messages: [] }); lastDate = d; }
      grouped[grouped.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-stretch" data-testid="chat-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal container */}
      <div className="relative z-10 flex w-full h-full md:m-4 lg:m-6 md:rounded-2xl overflow-hidden shadow-2xl">

        {/* ═══ LEFT: Info Panel ═══════════════════════════════════════════════ */}
        {showInfo && session && (
          <div className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
            <div className="px-4 py-5">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Customer Info</p>

              <div className="flex flex-col items-center text-center gap-2 mb-5">
                <Avatar name={selectedConvo?.name ?? null} phone={selectedPhone} size="lg" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{selectedConvo?.name || "Unknown"}</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{formatPhone(selectedPhone)}</p>
                </div>
                <a
                  href={`https://wa.me/${selectedPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-[#25D366] hover:underline font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in WhatsApp
                </a>
              </div>

              {selectedConvo?.state && (
                <div className={`rounded-xl px-3 py-3 mb-3 border ${getState(selectedConvo.state).bg}`}>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1.5 font-semibold">Bot State</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getState(selectedConvo.state).dot}`} />
                    <span className={`text-xs font-semibold ${getState(selectedConvo.state).color}`}>
                      {getState(selectedConvo.state).label}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {session.collectedAddress && <InfoRow icon={<MapPin className="w-3 h-3" />} label="Address" value={session.collectedAddress} />}
                {session.collectedToAddress && <InfoRow icon={<MapPin className="w-3 h-3" />} label="Destination" value={session.collectedToAddress} />}
                {session.collectedItems && session.collectedItems !== "__scanning__" && (
                  <InfoRow icon={<Package className="w-3 h-3" />} label="Items" value={session.collectedItems} multiline />
                )}
                {session.floorLevel && (
                  <InfoRow icon={<Building2 className="w-3 h-3" />} label="Floor" value={`Level ${session.floorLevel} · ${session.hasLift ? "Lift" : "No lift"}`} />
                )}
                {session.accessDifficulty && (
                  <InfoRow icon={<Layers className="w-3 h-3" />} label="Access" value={({ easy: "Easy", medium: "Moderate", hard: "Difficult" } as any)[session.accessDifficulty] || session.accessDifficulty} />
                )}
                {session.preferredDate && <InfoRow icon={<Calendar className="w-3 h-3" />} label="Preferred Date" value={session.preferredDate} />}
              </div>
            </div>
          </div>
        )}

        {/* ═══ RIGHT: Chat Panel ═══════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">

          {/* Header */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-3">
              <button
                onClick={onClose}
                data-testid="close-chat-modal"
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 text-blue-600 transition-all -ml-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex-shrink-0">
                <Avatar name={selectedConvo?.name ?? null} phone={selectedPhone} size="sm" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {selectedConvo?.name || formatPhone(selectedPhone)}
                  </p>
                  {selectedConvo?.state && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${getState(selectedConvo.state).color} ${getState(selectedConvo.state).bg}`}>
                      {getState(selectedConvo.state).label}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                  {selectedConvo?.name ? formatPhone(selectedPhone) : "WhatsApp"}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a
                  href={`https://wa.me/${selectedPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 transition-all sm:w-auto sm:px-3 sm:rounded-xl sm:gap-1.5 sm:text-xs sm:font-semibold"
                  data-testid="open-whatsapp"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
                {session && (
                  <button
                    onClick={() => setShowInfo(v => !v)}
                    className={`hidden lg:flex px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      showInfo ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                    }`}
                    data-testid="toggle-info"
                  >
                    Info
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                  data-testid="close-modal-x"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-5 py-4 bg-[#F5F5F7]">
            {loadingThread && (
              <div className="space-y-4 py-2 animate-pulse">
                {[false, true, false, true, false].map((r, i) => (
                  <div key={i} className={`flex ${r ? "justify-end" : "justify-start"}`}>
                    <div className={`rounded-2xl bg-gray-200 ${r ? "w-52 h-12" : "w-60 h-14"}`} />
                  </div>
                ))}
              </div>
            )}

            {!loadingThread && grouped.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No messages yet
              </div>
            )}

            {grouped.map(group => (
              <div key={group.date}>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[11px] text-gray-400 font-medium px-3 py-1 rounded-full bg-white border border-gray-200 shadow-sm">
                    {group.date}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
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
                    return (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isOut={isOut}
                        isAdm={isAdm}
                        isBot={isBot}
                        samePrev={samePrev}
                        sameNext={sameNext}
                        adminLabel={adminLabel}
                        selectedPhone={selectedPhone}
                        selectedConvoName={selectedConvo?.name ?? null}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* Quick Replies */}
          {showQuickReplies && (
            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Quick Replies</p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {QUICK_REPLIES.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => { setReplyText(qr); setShowQuickReplies(false); textareaRef.current?.focus(); }}
                    className="w-full text-left text-xs text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all leading-relaxed border border-transparent hover:border-gray-200"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reply Box */}
          <div
            className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3"
            style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowQuickReplies(v => !v)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-all border ${
                  showQuickReplies
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-gray-50 text-gray-400 hover:text-gray-700 hover:bg-gray-100 border-gray-200"
                }`}
                title="Quick replies"
              >
                <Zap className="w-4 h-4" />
              </button>

              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send)"
                  className="resize-none bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm min-h-[42px] max-h-[120px] py-2.5 px-3.5 rounded-xl focus:border-blue-400 focus:bg-white transition-all leading-relaxed"
                  rows={1}
                  data-testid="reply-input"
                />
              </div>

              <Button
                onClick={handleSend}
                disabled={!replyText.trim() || sendMutation.isPending}
                className="w-9 h-9 rounded-xl bg-[#25D366] hover:bg-[#1db954] text-white flex-shrink-0 p-0 flex items-center justify-center mb-0.5 disabled:opacity-40 transition-all shadow-sm"
                data-testid="send-reply"
              >
                {sendMutation.isPending
                  ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
              </Button>
            </div>

            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[10px] text-gray-400">
                Sending as <span className="text-indigo-600 font-semibold">Admin</span> · delivered to customer's WhatsApp
              </p>
              {replyText.length > 100 && (
                <span className={`text-[10px] tabular-nums font-medium ${replyText.length > 900 ? "text-red-500" : "text-gray-400"}`}>
                  {replyText.length}/1024
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function AdminConversations() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "active" | "submitted">("all");
  const queryClient = useQueryClient();

  const { data: convos = [], isLoading: loadingConvos } = useQuery<Conversation[]>({
    queryKey: ["/api/admin/whatsapp/conversations"],
    refetchInterval: 8000,
  });

  const selectedConvo = convos.find(c => c.phone === selectedPhone);
  const totalUnread = convos.reduce((s, c) => s + c.unreadCount, 0);

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

  function openConvo(phone: string) {
    setSelectedPhone(phone);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
  }

  return (
    <div className="flex mt-14 h-[calc(100dvh-56px)] bg-[#F5F5F7] overflow-hidden lg:pl-56" data-testid="admin-conversations">

      {/* Chat Modal */}
      {selectedPhone && (
        <ChatModal
          selectedPhone={selectedPhone}
          selectedConvo={selectedConvo}
          onClose={() => setSelectedPhone(null)}
        />
      )}

      {/* ═══ Conversation List (always visible) ════════════════════════════ */}
      <div className="flex flex-col w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
              </div>
              <span className="text-sm font-semibold text-gray-900">WhatsApp</span>
              {totalUnread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[20px] text-center">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] })}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-all"
              data-testid="refresh-conversations"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 pl-8 pr-7 py-2 focus:outline-none focus:border-blue-400 focus:bg-white transition-all"
              data-testid="search-conversations"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(["all", "unread", "active", "submitted"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-[10px] font-semibold py-1 rounded-lg capitalize transition-all ${
                  filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
                data-testid={`filter-${f}`}
              >
                {f === "unread" && totalUnread > 0 ? `Unread (${totalUnread})` : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loadingConvos && [0,1,2,3].map(i => <ConvoSkeleton key={i} />)}

          {!loadingConvos && filteredConvos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">
                {search ? "No results found" : filter !== "all" ? `No ${filter} conversations` : "No conversations yet"}
              </p>
            </div>
          )}

          {filteredConvos.map(convo => {
            const sc = getState(convo.state);
            const hasUnread = convo.unreadCount > 0;
            return (
              <button
                key={convo.phone}
                onClick={() => openConvo(convo.phone)}
                data-testid={`convo-${convo.phone}`}
                className="w-full text-left px-4 py-3.5 transition-all border-b border-gray-100 hover:bg-blue-50 active:bg-blue-100 border-l-[3px] border-l-transparent hover:border-l-blue-400"
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <Avatar name={convo.name} phone={convo.phone} size="md" />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${sc.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-sm leading-tight truncate ${hasUnread ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>
                        {convo.name || formatPhone(convo.phone)}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
                        {relativeTime(convo.lastAt)}
                      </span>
                    </div>
                    {convo.name && (
                      <p className="text-[11px] text-gray-400 mb-0.5 font-mono">{formatPhone(convo.phone)}</p>
                    )}
                    <p className={`text-xs truncate leading-snug ${hasUnread ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                      {convo.lastMessage}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${sc.color} ${sc.bg}`}>
                        {sc.label}
                      </span>
                      {hasUnread && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 self-center text-gray-300">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-400">{convos.length} conversation{convos.length !== 1 ? "s" : ""} · auto-refreshes</p>
        </div>
      </div>

      {/* Desktop: right side placeholder when no modal open */}
      <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-4 bg-[#F5F5F7]">
        <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
          <MessageCircle className="w-8 h-8 text-gray-300" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-400">Select a conversation</p>
          <p className="text-xs text-gray-300 mt-1">Click any chat to open it</p>
        </div>
      </div>
    </div>
  );
}
