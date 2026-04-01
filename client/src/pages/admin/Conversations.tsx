import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle, Send, Phone, RefreshCw, User, Bot, Search, X,
  ExternalLink, MapPin, Package, Calendar, Building2, Layers,
  CheckCheck, Zap, ArrowLeft, ImageIcon, ZoomIn, BotOff, FileText,
  TriangleAlert, AlertCircle, ChevronDown, Paperclip, Smile,
  Download, Music, File, StickyNote, Plus, RotateCcw, ListChecks, Trash2,
} from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
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
  botPaused: boolean;
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

// ── WhatsApp markdown helpers ─────────────────────────────────────────────────

function stripWhatsAppMarkdown(text: string): string {
  return text
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/~([^~\n]+)~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\n/g, " ")
    .trim();
}

function formatWhatsAppText(text: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const bold = remaining.match(/^\*([^*\n]+)\*/);
    const italic = remaining.match(/^_([^_\n]+)_/);
    const strike = remaining.match(/^~([^~\n]+)~/);
    const mono = remaining.match(/^`([^`\n]+)`/);
    const nl = remaining.match(/^(\n)/);

    if (bold) {
      segments.push(<strong key={key++} className="font-bold">{bold[1]}</strong>);
      remaining = remaining.slice(bold[0].length);
    } else if (italic) {
      segments.push(<em key={key++} className="italic">{italic[1]}</em>);
      remaining = remaining.slice(italic[0].length);
    } else if (strike) {
      segments.push(<del key={key++} className="line-through opacity-80">{strike[1]}</del>);
      remaining = remaining.slice(strike[0].length);
    } else if (mono) {
      segments.push(<code key={key++} className="font-mono text-[0.9em] bg-black/10 rounded px-0.5">{mono[1]}</code>);
      remaining = remaining.slice(mono[0].length);
    } else if (nl) {
      segments.push(<br key={key++} />);
      remaining = remaining.slice(1);
    } else {
      // consume characters until next special char or newline
      const nextSpecial = remaining.search(/[*_~`\n]/);
      if (nextSpecial === -1) {
        segments.push(<span key={key++}>{remaining}</span>);
        remaining = "";
      } else if (nextSpecial === 0) {
        segments.push(<span key={key++}>{remaining[0]}</span>);
        remaining = remaining.slice(1);
      } else {
        segments.push(<span key={key++}>{remaining.slice(0, nextSpecial)}</span>);
        remaining = remaining.slice(nextSpecial);
      }
    }
  }
  return <>{segments}</>;
}

// ── Skeletons ──────────────────────────────────────────────────────────────────

function ConvoSkeleton() {
  return (
    <div className="px-4 py-3.5 border-b border-zinc-100 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-200 flex-shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="flex justify-between">
            <div className="h-3.5 bg-zinc-200 rounded w-28" />
            <div className="h-2.5 bg-zinc-100 rounded w-8" />
          </div>
          <div className="h-2.5 bg-zinc-100 rounded w-44" />
          <div className="h-2.5 bg-zinc-100 rounded w-20" />
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
    <div className="bg-zinc-50 rounded-lg px-3 py-2.5 border border-zinc-200">
      <div className="flex items-center gap-1.5 mb-1 text-zinc-400">
        {icon}
        <span className="text-[9px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <p className={`text-xs text-zinc-700 leading-relaxed ${multiline ? "whitespace-pre-line" : "truncate"}`}>{value}</p>
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

  const isImage    = msg.mediaType?.startsWith("image") ?? false;
  const isDocument = !isImage && !!msg.mediaUrl && !!msg.mediaType && !msg.mediaType.startsWith("video") && !msg.mediaType.startsWith("audio");
  const isVideo    = msg.mediaType?.startsWith("video") ?? false;
  const isAudio    = msg.mediaType?.startsWith("audio") ?? false;

  // Detect legacy [Document] body (no mediaUrl stored — old messages before fix)
  const isLegacyDoc = !msg.mediaUrl && (msg.body?.startsWith("[Document") ?? false);

  // mediaUrl stores the WhatsApp media ID — route it through our proxy endpoint.
  // Fall back to body if it happens to be a direct URL (legacy support).
  const mediaSrc = msg.mediaUrl
    ? (msg.mediaUrl.startsWith("http") ? msg.mediaUrl : `${API_BASE}/api/admin/whatsapp/media/${msg.mediaUrl}`)
    : (msg.body?.startsWith("http") ? msg.body : null);
  const imgSrc = isImage ? mediaSrc : null;

  // Filename: prefer body text when it contains [Document: filename.pdf], else use mime type
  const docFilename = (() => {
    const m = msg.body?.match(/^\[Document:\s*(.+)\]$/);
    if (m) return m[1];
    if (msg.mediaType && msg.mediaType !== 'application/octet-stream') {
      const ext = msg.mediaType.split("/")[1]?.split(";")[0] || "file";
      return `document.${ext}`;
    }
    return "document";
  })();

  const docIcon = msg.mediaType?.includes("pdf") ? <FileText className="w-5 h-5 flex-shrink-0" />
    : msg.mediaType?.includes("word") || msg.mediaType?.includes("document") ? <File className="w-5 h-5 flex-shrink-0" />
    : <File className="w-5 h-5 flex-shrink-0" />;

  const isNote = !!msg.sentBy?.startsWith("note:");
  const noteAuthor = isNote ? msg.sentBy!.replace("note:", "") : null;

  const bubbleStyle = isNote
    ? "bg-amber-50 text-amber-900 border border-amber-200 shadow-sm"
    : isOut
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
          {isNote && !samePrev && (
            <div className="flex items-center justify-end gap-1 mb-1 mr-1">
              <StickyNote className="w-3 h-3 text-amber-500" />
              <p className="text-[10px] text-amber-600 font-semibold">Internal Note · {noteAuthor || "Admin"}</p>
            </div>
          )}
          {isAdm && !isNote && !samePrev && (
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
                <p className="text-sm px-2 pt-1 pb-0.5 leading-relaxed break-words">{formatWhatsAppText(msg.body)}</p>
              )}
            </div>

          ) : isDocument && mediaSrc ? (
            /* Document bubble — clickable download card */
            <a
              href={mediaSrc}
              target="_blank"
              rel="noopener noreferrer"
              download={docFilename}
              className={`flex items-center gap-3 px-4 py-3 ${radius} ${bubbleStyle} hover:opacity-90 transition-opacity min-w-[200px] max-w-full`}
            >
              <div className={`p-2 rounded-lg flex-shrink-0 ${isOut ? "bg-white/20" : "bg-blue-50"}`}>
                {docIcon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{docFilename}</p>
                <p className={`text-[11px] mt-0.5 ${isOut ? "opacity-70" : "text-gray-400"}`}>
                  {msg.mediaType?.split("/")[1]?.split(";")[0]?.toUpperCase() || "FILE"} · Tap to open
                </p>
              </div>
              <Download className="w-4 h-4 flex-shrink-0 opacity-60" />
            </a>

          ) : isVideo && mediaSrc ? (
            /* Video bubble */
            <div className={`overflow-hidden ${radius} ${bubbleStyle} p-1`}>
              <video
                src={mediaSrc}
                controls
                className="rounded-xl max-w-full max-h-64 w-full block"
              />
              {msg.body && msg.body !== "[Video]" && (
                <p className="text-sm px-2 pt-1 pb-0.5 leading-relaxed break-words">{formatWhatsAppText(msg.body)}</p>
              )}
            </div>

          ) : isAudio && mediaSrc ? (
            /* Audio bubble */
            <div className={`flex items-center gap-3 px-4 py-3 ${radius} ${bubbleStyle} min-w-[200px]`}>
              <Music className="w-4 h-4 flex-shrink-0 opacity-60" />
              <audio src={mediaSrc} controls className="flex-1 h-8 max-w-[180px]" />
            </div>

          ) : isLegacyDoc ? (
            /* Legacy document — no media URL stored, show label with warning */
            <div className={`flex items-center gap-3 px-4 py-3 ${radius} ${bubbleStyle} min-w-[200px]`}>
              <div className={`p-2 rounded-lg flex-shrink-0 ${isOut ? "bg-white/20" : "bg-gray-100"}`}>
                <FileText className="w-5 h-5 flex-shrink-0 opacity-60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Document</p>
                <p className={`text-[11px] mt-0.5 ${isOut ? "opacity-60" : "text-gray-400"}`}>
                  Open WhatsApp to view
                </p>
              </div>
            </div>

          ) : (
            /* Text bubble */
            <div className={`px-3.5 py-2 text-sm leading-relaxed break-words ${radius} ${bubbleStyle}`}>
              {isImage && !imgSrc ? (
                <span className="flex items-center gap-2 opacity-70">
                  <ImageIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="italic">Photo</span>
                </span>
              ) : (
                formatWhatsAppText(msg.body || "")
              )}
            </div>
          )}

          {!sameNext && (
            <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end pr-1" : "pl-1"}`}>
              <span className="text-[10px] text-gray-400 tabular-nums">{formatTime(msg.createdAt)}</span>
              {isNote && <StickyNote className="w-3 h-3 text-amber-400" />}
              {isBot && <Bot className="w-3 h-3 text-[#25D366]/70" />}
              {isAdm && !isNote && <CheckCheck className="w-3 h-3 text-indigo-400" />}
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

// ── Chat Panel ─────────────────────────────────────────────────────────────────

function ChatPanel({
  selectedPhone,
  selectedConvo,
  onClose,
}: {
  selectedPhone: string;
  selectedConvo: Conversation | undefined;
  onClose: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [showMobileInfo, setShowMobileInfo] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<{ quoteId: number; referenceNo: string } | null>(null);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /* Auto-resize textarea as content grows */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [replyText]);

  /* Reply bar is in-flow (flex-shrink-0 at bottom of right panel flex column).
     No fixed positioning needed: interactive-widget=resizes-content in index.html
     causes the layout viewport to shrink with the keyboard, so in-flow elements
     at the container bottom are always visible above the keyboard. */

  /* When keyboard opens on mobile (viewport shrinks), scroll to bottom */
  useEffect(() => {
    const onVpResize = () => {
      const scroll = chatScrollRef.current;
      if (!scroll) return;
      setTimeout(() => {
        scroll.scrollTop = scroll.scrollHeight;
      }, 120);
    };
    window.visualViewport?.addEventListener("resize", onVpResize);
    return () => window.visualViewport?.removeEventListener("resize", onVpResize);
  }, []);

  const { data: thread, isLoading: loadingThread } = useQuery<ThreadData>({
    queryKey: ["/api/admin/whatsapp/conversations", selectedPhone],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/conversations/${selectedPhone}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });

  const { data: dbCannedReplies = [] } = useQuery<{ id: number; shortcut: string; title: string; body: string; active: boolean }[]>({
    queryKey: ["/api/admin/canned-replies"],
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) =>
      apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/send`, { message }),
    onSuccess: () => {
      setReplyText("");
      setShowQuickReplies(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
      toast({ title: "Message sent — Bot paused", description: "You are now in admin mode. Resume bot when done." });
    },
    onError: (err: any) => {
      let reason = err?.message || "Failed to send message";
      try { reason = JSON.parse(reason.replace(/^\d+:\s*/, "")).message || reason; } catch {}
      toast({ title: "Failed to send", description: reason, variant: "destructive" });
    },
  });

  const pauseBotMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/pause-bot`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      toast({ title: "Bot paused — you are now in Admin Mode" });
    },
    onError: () => toast({ title: "Failed to pause bot", variant: "destructive" }),
  });

  const resumeBotMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/resume-bot`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      toast({ title: "Bot resumed — AI is back in control" });
    },
    onError: () => toast({ title: "Failed to resume bot", variant: "destructive" }),
  });

  const generateQuoteMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/generate-quote`),
    onSuccess: (data: any) => {
      setGeneratedQuote({ quoteId: data.quoteId, referenceNo: data.referenceNo });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: `Quote ${data.referenceNo} created!`, description: "Opening quote in a new tab…" });
      window.open(`/admin/quotes/${data.quoteId}`, "_blank");
    },
    onError: (err: any) => toast({ title: "Could not generate quote", description: err?.message || "Check that address has been collected", variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: async (note: string) => apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/note`, { note }),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      toast({ title: "Note added" });
    },
    onError: (err: any) => toast({ title: "Failed to add note", description: err?.message, variant: "destructive" }),
  });

  const sendFileMutation = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (caption) formData.append("caption", caption);
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/conversations/${selectedPhone}/send-media`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to send file");
      }
      return res.json();
    },
    onSuccess: () => {
      setReplyText("");
      clearAttach();
      setShowQuickReplies(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
      toast({ title: "File sent — Bot paused" });
    },
    onError: (err: any) => toast({ title: "Failed to send file", description: err?.message, variant: "destructive" }),
  });

  const resetSessionMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/whatsapp/conversations/${selectedPhone}/session`),
    onSuccess: () => {
      setShowResetConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
      toast({ title: "Session cleared", description: "The bot will restart from the beginning on the next message." });
    },
    onError: () => toast({ title: "Failed to reset session", variant: "destructive" }),
  });

  const markReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/mark-read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] }),
  });

  /* Mark conversation as done — resumes bot and marks all as read */
  const markDoneMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/resume-bot`);
      await apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/mark-read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
      toast({ title: "Conversation marked as done", description: "Bot resumed, all messages marked read." });
    },
    onError: () => toast({ title: "Failed to mark done", variant: "destructive" }),
  });

  const isNearBottom = () => {
    const el = chatScrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
    setHasNewMessages(false);
  };

  useEffect(() => {
    if (isNearBottom()) scrollToBottom(true);
    else setHasNewMessages(true);
  }, [thread?.messages?.length]);

  useEffect(() => {
    setTimeout(() => scrollToBottom(false), 80);
  }, [selectedPhone]);

  // Auto-mark messages as read when opening a conversation
  useEffect(() => {
    if (thread?.messages?.length) markReadMutation.mutate();
  }, [selectedPhone, thread?.messages?.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  // Reset state when switching conversations
  useEffect(() => {
    setNoteMode(false);
    setReplyText("");
    clearAttach();
    setGeneratedQuote(null);
    setShowResetConfirm(false);
    setShowMobileInfo(false);
    setShowTemplates(false);
    setShowQuickReplies(false);
    setShowEmojiPicker(false);
  }, [selectedPhone]);

  function clearAttach() {
    setAttachFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedImages = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    const allowedDocs = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (![...allowedImages, ...allowedDocs].includes(file.type)) {
      toast({ title: "Invalid file type", description: "Supported: JPEG, PNG, WebP, GIF, PDF, Word, Excel", variant: "destructive" });
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 16 MB", variant: "destructive" });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAttachFile(file);
    if (allowedImages.includes(file.type)) setPreviewUrl(URL.createObjectURL(file));
    else setPreviewUrl(null);
    setShowEmojiPicker(false);
    setShowQuickReplies(false);
  }

  function handleSend() {
    if (noteMode) {
      if (!replyText.trim() || noteMutation.isPending) return;
      noteMutation.mutate(replyText.trim());
      return;
    }
    if (attachFile) {
      sendFileMutation.mutate({ file: attachFile, caption: replyText.trim() || undefined });
      return;
    }
    if (!replyText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(replyText.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function insertEmoji(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) { setReplyText(t => t + emoji); return; }
    const start = ta.selectionStart ?? replyText.length;
    const end = ta.selectionEnd ?? replyText.length;
    const newText = replyText.slice(0, start) + emoji + replyText.slice(end);
    setReplyText(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  }

  const session = thread?.session;
  const botPaused: boolean = session?.botPaused ?? selectedConvo?.botPaused ?? false;
  const canGenerateQuote = !!session?.collectedAddress && !generatedQuote;
  const threadLoaded = !loadingThread && thread !== undefined;
  const isImageFile = attachFile?.type.startsWith("image/") ?? false;
  const isSending = sendMutation.isPending || sendFileMutation.isPending || noteMutation.isPending;

  /* Quick-reply templates shown in message mode */
  const QUICK_TEMPLATES = [
    { label: "Greeting", text: "Hi there! Thank you for contacting TMG Install. How can we help you today? 😊" },
    { label: "On our way", text: "Our team is on the way and will arrive shortly. Please ensure the area is accessible. Thank you!" },
    { label: "Quote ready", text: "Your quote is ready! Please check the link we've sent and let us know if you have any questions." },
    { label: "Confirm appt", text: "Just confirming your appointment is scheduled. Our team will arrive at the agreed time. See you soon!" },
    { label: "Follow up", text: "Hi, just following up on your recent enquiry. Have you had a chance to review the quote? Let us know if you'd like to proceed. 😊" },
    { label: "Thank you", text: "Thank you for choosing TMG Install! It was a pleasure working with you. Feel free to reach out anytime. 🙏" },
  ];

  const grouped: { date: string; messages: WaMessage[] }[] = [];
  if (thread?.messages) {
    let lastDate = "";
    for (const msg of thread.messages) {
      const d = formatDateHeader(msg.createdAt);
      if (d !== lastDate) { grouped.push({ date: d, messages: [] }); lastDate = d; }
      grouped[grouped.length - 1].messages.push(msg);
    }
  }

  // On mobile: fixed inset-0 full-screen overlay (interactive-widget=resizes-content
  // makes the layout viewport shrink with keyboard, so inset-0 ends above the keyboard).
  // On desktop (lg+): static flex-1 inside the parent flex layout as before.
  return (
    <div className="fixed inset-0 z-[9999] flex overflow-hidden lg:static lg:flex-1 lg:z-auto" data-testid="chat-panel">

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

              {/* Reset Session */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                {showResetConfirm ? (
                  <div className="space-y-2">
                    <p className="text-xs text-red-600 font-semibold text-center">Clear this session?</p>
                    <p className="text-[10px] text-gray-400 text-center leading-relaxed">Bot will restart from scratch on the next message.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                      >Cancel</button>
                      <button
                        onClick={() => resetSessionMutation.mutate()}
                        disabled={resetSessionMutation.isPending}
                        data-testid="confirm-reset-session"
                        className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-60"
                      >{resetSessionMutation.isPending ? "Clearing…" : "Yes, clear"}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    data-testid="reset-session-btn"
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Bot Session
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ RIGHT: Chat Panel ═══════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">

          {/* Header */}
          <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-3">
              {/* Back button — mobile only */}
              <button
                onClick={onClose}
                data-testid="back-to-list"
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 text-blue-600 transition-all -ml-1 lg:hidden"
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

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* WhatsApp open link */}
                <a
                  href={`https://wa.me/${selectedPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 transition-all sm:w-auto sm:px-2.5 sm:rounded-xl sm:gap-1.5 sm:text-xs sm:font-semibold"
                  data-testid="open-whatsapp"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">WA</span>
                </a>

                {/* Bot pause / resume toggle */}
                {threadLoaded && (
                  botPaused ? (
                    <button
                      onClick={() => resumeBotMutation.mutate()}
                      disabled={resumeBotMutation.isPending}
                      data-testid="resume-bot-btn"
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-500 text-white border border-amber-500 hover:bg-amber-600 transition-all disabled:opacity-60 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 sm:rounded-xl sm:gap-1.5 sm:text-xs sm:font-semibold"
                      title="Resume bot"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Resume Bot</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => pauseBotMutation.mutate()}
                      disabled={pauseBotMutation.isPending}
                      data-testid="pause-bot-btn"
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-60 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 sm:rounded-xl sm:gap-1.5 sm:text-xs sm:font-semibold"
                      title="Take over from bot"
                    >
                      <BotOff className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Take Over</span>
                    </button>
                  )
                )}

                {/* Mark Done — visible when bot is paused (admin mode) */}
                {threadLoaded && botPaused && (
                  <button
                    onClick={() => markDoneMutation.mutate()}
                    disabled={markDoneMutation.isPending}
                    data-testid="mark-done-btn"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all disabled:opacity-60 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 sm:rounded-xl sm:gap-1.5 sm:text-xs sm:font-semibold"
                    title="Mark done — resume bot and mark read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Done</span>
                  </button>
                )}

                {/* Mobile: show customer info drawer */}
                <button
                  onClick={() => setShowMobileInfo(v => !v)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100 transition-all lg:hidden"
                  title="Customer info"
                  data-testid="mobile-info-btn"
                >
                  <User className="w-3.5 h-3.5" />
                </button>

                {/* Desktop: Info panel toggle */}
                {threadLoaded && (
                  <button
                    onClick={() => setShowInfo(v => !v)}
                    className={`hidden lg:flex px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      showInfo ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                    }`}
                    data-testid="toggle-info"
                  >
                    Info
                  </button>
                )}
              </div>
            </div>

            {/* Admin Mode banner — compact single-line strip */}
            {botPaused && (
              <div className="flex items-center justify-between px-3 py-1 bg-amber-500 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-white text-[11px] font-semibold min-w-0">
                  <TriangleAlert className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Admin Mode — Bot paused. No auto-reply.</span>
                </div>
                <button
                  onClick={() => resumeBotMutation.mutate()}
                  disabled={resumeBotMutation.isPending}
                  className="ml-3 text-[11px] font-bold text-white/90 hover:text-white underline underline-offset-2 flex-shrink-0 disabled:opacity-60"
                  data-testid="resume-bot-inline"
                >
                  Resume
                </button>
              </div>
            )}
          </div>

          {/* Mobile info drawer — slides down when info btn tapped */}
          {showMobileInfo && session && (
            <div className="lg:hidden flex-shrink-0 border-b border-gray-200 bg-white shadow-sm animate-in slide-in-from-top-2 duration-200 z-10">
              <div className="px-4 py-3 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.18em]">Customer Info</p>
                  <button onClick={() => setShowMobileInfo(false)} className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                  <Avatar name={selectedConvo?.name ?? null} phone={selectedPhone} size="md" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{selectedConvo?.name || "Unknown"}</p>
                    <p className="text-xs text-gray-400 font-mono">{formatPhone(selectedPhone)}</p>
                    {selectedConvo?.state && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-1 inline-block ${getState(selectedConvo.state).color} ${getState(selectedConvo.state).bg}`}>
                        {getState(selectedConvo.state).label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {session.collectedAddress && <InfoRow icon={<MapPin className="w-3 h-3" />} label="Address" value={session.collectedAddress} />}
                  {session.collectedItems && session.collectedItems !== "__scanning__" && (
                    <InfoRow icon={<Package className="w-3 h-3" />} label="Items" value={session.collectedItems} multiline />
                  )}
                  {session.floorLevel && (
                    <InfoRow icon={<Building2 className="w-3 h-3" />} label="Floor" value={`Level ${session.floorLevel} · ${session.hasLift ? "Lift" : "No lift"}`} />
                  )}
                  {session.preferredDate && <InfoRow icon={<Calendar className="w-3 h-3" />} label="Date" value={session.preferredDate} />}
                </div>
                <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                  <a
                    href={`https://wa.me/${selectedPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20 transition-all"
                  >
                    <Phone className="w-3 h-3" /> Open in WA
                  </a>
                  {canGenerateQuote && (
                    <button
                      onClick={() => { generateQuoteMutation.mutate(); setShowMobileInfo(false); }}
                      disabled={generateQuoteMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-all disabled:opacity-60"
                    >
                      <FileText className="w-3 h-3" /> Gen Quote
                    </button>
                  )}
                  {botPaused && (
                    <button
                      onClick={() => { markDoneMutation.mutate(); setShowMobileInfo(false); }}
                      disabled={markDoneMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-all disabled:opacity-60"
                    >
                      <CheckCheck className="w-3 h-3" /> Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Messages — wrapper is flex-1 + relative so chatScrollRef can use absolute inset-0.
               absolute inset-0 is bulletproof: fills the parent regardless of flex-height
               resolution quirks on iOS Safari (flex-1/h-full can both fail there). */}
          <div className="relative flex-1 overflow-hidden" style={{ background: "#e5ddd5", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8b9a8' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E\")" }}>
          {hasNewMessages && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#25D366] text-white text-xs font-semibold shadow-lg animate-bounce"
            >
              <ChevronDown className="w-3.5 h-3.5" /> New messages
            </button>
          )}
          <div ref={chatScrollRef} className="absolute inset-0 overflow-y-auto overscroll-contain px-3 sm:px-5 py-4" style={{ background: "#e5ddd5", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8b9a8' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E\")"}  }>
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
                    const isBot = isOut && !isAdm && !msg.sentBy?.startsWith("note:");
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
          </div>

          {/* Generated quote success banner */}
          {generatedQuote && (
            <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-emerald-50 border-t border-emerald-200">
              <CheckCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-700 flex-1">Quote <span className="font-bold">{generatedQuote.referenceNo}</span> created successfully</span>
              <a
                href={`/admin/quotes/${generatedQuote.quoteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline underline-offset-2 flex-shrink-0"
              >
                Open Quote
              </a>
            </div>
          )}

          {/* Generate Quote action bar — shown when session has enough data */}
          {!generatedQuote && canGenerateQuote && (
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 bg-blue-50 border-t border-blue-200 sm:gap-3 sm:px-4">
              <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="text-xs text-blue-700 flex-1 min-w-0 truncate sm:whitespace-normal sm:truncate-none">
                {session?.collectedItems
                  ? "Address & items collected — ready to generate a quote."
                  : "Address collected — generate a quote (items will be empty)."}
              </span>
              <button
                onClick={() => generateQuoteMutation.mutate()}
                disabled={generateQuoteMutation.isPending}
                data-testid="generate-quote-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-60 flex-shrink-0 whitespace-nowrap"
              >
                {generateQuoteMutation.isPending
                  ? <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  : <FileText className="w-3.5 h-3.5" />
                }
                Generate Quote
              </button>
            </div>
          )}

          {/* Reply Box — in the flex flow at the bottom of the right panel column.
               interactive-widget=resizes-content (index.html) causes the layout
               viewport to shrink when keyboard is open, so flex-shrink-0 here is
               always visible above the keyboard without any fixed positioning. */}
          <div
            className="flex-shrink-0 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.07)]"
            style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
          >

            {/* Combined Quick Templates + Canned Replies panel (inside fixed unit) */}
            {(showTemplates || showQuickReplies) && !noteMode && (
              <div className="border-b border-gray-100 bg-white px-3 pt-2.5 pb-1 max-h-52 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Quick Replies</p>
                  <button onClick={() => { setShowTemplates(false); setShowQuickReplies(false); }} className="text-gray-300 hover:text-gray-500"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {QUICK_TEMPLATES.map(t => (
                    <button
                      key={t.label}
                      onClick={() => { setReplyText(t.text); setShowTemplates(false); setShowQuickReplies(false); setTimeout(() => textareaRef.current?.focus(), 0); }}
                      className="px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {dbCannedReplies.filter(r => r.active).length > 0 && (
                  <div className="border-t border-gray-100 pt-2">
                    <p className="text-[10px] text-gray-300 font-semibold uppercase tracking-wider mb-1.5">Saved Replies</p>
                    <div className="space-y-1">
                      {dbCannedReplies.filter(r => r.active).map(r => (
                        <button
                          key={r.id}
                          onClick={() => { setReplyText(r.body.replace(/\\n/g, "\n")); setShowTemplates(false); setShowQuickReplies(false); textareaRef.current?.focus(); }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <code className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-1 rounded">{r.shortcut}</code>
                            <span className="text-xs font-semibold text-gray-700">{r.title}</span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">{r.body}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf,application/msword,.docx,.xlsx"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="file-input"
            />

            {/* Note mode indicator strip — thin, replaces the full tab row */}
            {noteMode && (
              <div className="flex items-center justify-between px-3 py-1 bg-amber-50 border-b border-amber-200">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <StickyNote className="w-3 h-3" />
                  <span>Internal Note — not sent to customer</span>
                </div>
                <button
                  onClick={() => { setNoteMode(false); clearAttach(); }}
                  className="text-[11px] text-amber-600 hover:text-amber-800 font-semibold underline"
                  data-testid="cancel-note-mode"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* File/image preview panel */}
            {attachFile && (
              <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    {isImageFile && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-20 h-20 object-cover rounded-xl border border-gray-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-gray-200 shadow-sm bg-blue-50 flex flex-col items-center justify-center gap-1">
                        <FileText className="w-7 h-7 text-blue-400" />
                        <span className="text-[9px] font-bold text-blue-400 uppercase">{attachFile.name.split(".").pop()}</span>
                      </div>
                    )}
                    <button
                      onClick={clearAttach}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-red-600 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{attachFile.name}</p>
                    <p className="text-[10px] text-gray-400 mb-1.5">{(attachFile.size / 1024).toFixed(0)} KB · {attachFile.type.split("/")[1]?.split(";")[0]?.toUpperCase()}</p>
                    <input
                      type="text"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Add a caption (optional)…"
                      className="w-full h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 placeholder:text-gray-400"
                      data-testid="file-caption-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Emoji picker — floats above reply box */}
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="absolute bottom-full left-3 z-50 mb-1 shadow-2xl rounded-2xl overflow-hidden border border-gray-200">
                <EmojiPicker
                  theme={Theme.LIGHT}
                  onEmojiClick={(data: EmojiClickData) => {
                    insertEmoji(data.emoji);
                    setShowEmojiPicker(false);
                  }}
                  width={300}
                  height={340}
                  searchDisabled={false}
                  skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}

            <div className="px-2 pb-2 pt-1.5">
              <div className="flex items-end gap-1">
                {/* Left icon group — attach + note toggle */}
                <div className="flex flex-col items-center gap-1 pb-0.5">
                  {/* Attach (message mode only) */}
                  {!noteMode ? (
                    <button
                      onClick={() => { fileInputRef.current?.click(); setShowEmojiPicker(false); }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        attachFile ? "bg-emerald-500 text-white" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                      title="Attach image or document"
                      data-testid="btn-attach-file"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  ) : (
                    <div className="w-8 h-8" />
                  )}
                </div>

                {/* Textarea wrapper */}
                <div className="flex-1 relative">
                  {/* Text input — auto-resizes via useEffect */}
                  {!attachFile && (
                    <Textarea
                      ref={textareaRef}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={noteMode ? "Internal note (not sent to customer)…" : "Message"}
                      className={`resize-none overflow-hidden text-[15px] text-gray-900 placeholder:text-gray-400 min-h-[40px] py-2 px-3 rounded-2xl border transition-colors leading-relaxed focus-visible:ring-0 ${
                        noteMode
                          ? "bg-amber-50 border-amber-200 focus:border-amber-400"
                          : "bg-[#F0F0F0] border-transparent focus:border-gray-300 focus:bg-white"
                      }`}
                      rows={1}
                      data-testid="reply-input"
                    />
                  )}
                  {attachFile && <div className="flex-1 h-10" />}
                </div>

                {/* Right icon group — emoji, note toggle, templates/canned, send */}
                <div className="flex items-center gap-0.5 pb-0.5">
                  {/* Emoji */}
                  <button
                    onClick={() => { setShowEmojiPicker(v => !v); setShowQuickReplies(false); setShowTemplates(false); }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      showEmojiPicker ? "text-yellow-500 bg-yellow-50" : "text-gray-400 hover:text-yellow-500 hover:bg-gray-100"
                    }`}
                    title="Emoji"
                    data-testid="btn-emoji-picker"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  {/* Internal Note toggle */}
                  <button
                    onClick={() => {
                      if (noteMode) { setNoteMode(false); }
                      else { setNoteMode(true); setShowQuickReplies(false); setShowTemplates(false); clearAttach(); }
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      noteMode ? "text-amber-600 bg-amber-100" : "text-gray-400 hover:text-amber-500 hover:bg-gray-100"
                    }`}
                    title={noteMode ? "Cancel note mode" : "Write internal note (not sent to customer)"}
                    data-testid="mode-note"
                  >
                    <StickyNote className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                  </button>

                  {/* Templates + Canned — shown only in message mode */}
                  {!noteMode && (
                    <button
                      onClick={() => {
                        if (showTemplates || showQuickReplies) { setShowTemplates(false); setShowQuickReplies(false); }
                        else { setShowTemplates(true); setShowEmojiPicker(false); }
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        showTemplates || showQuickReplies ? "text-violet-600 bg-violet-50" : "text-gray-400 hover:text-violet-600 hover:bg-gray-100"
                      }`}
                      title="Quick templates and canned replies"
                      data-testid="btn-templates"
                    >
                      <ListChecks className="w-[18px] h-[18px]" />
                    </button>
                  )}

                  {/* Send / record button — WhatsApp style: mic when empty, send when text */}
                  {(replyText.trim() || attachFile) ? (
                    <Button
                      onClick={handleSend}
                      disabled={attachFile ? isSending : (!replyText.trim() || isSending)}
                      className={`w-9 h-9 rounded-full text-white flex-shrink-0 p-0 flex items-center justify-center disabled:opacity-40 transition-all shadow-sm ml-0.5 ${
                        noteMode ? "bg-amber-500 hover:bg-amber-600" : "bg-[#25D366] hover:bg-[#1db954]"
                      }`}
                      data-testid="send-reply"
                    >
                      {isSending
                        ? <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                        : noteMode ? <StickyNote className="w-4 h-4" /> : <Send className="w-4 h-4" />
                      }
                    </Button>
                  ) : (
                    <button
                      className="w-9 h-9 rounded-full bg-[#25D366] text-white flex-shrink-0 flex items-center justify-center shadow-sm ml-0.5"
                      title="Hold to record voice (coming soon)"
                      data-testid="btn-voice"
                      onClick={() => textareaRef.current?.focus()}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 15.2 14.47 17 12 17s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V21c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
    </div>
  );
}

// ── SwipeableConvoRow ──────────────────────────────────────────────────────────

function SwipeableConvoRow({
  phone,
  onOpen,
  onDelete,
  isSelected,
  className,
  children,
}: {
  phone: string;
  onOpen: () => void;
  onDelete: () => void;
  isSelected: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const DELETE_W = 80;
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [animated, setAnimated] = useState(false);
  const startXRef = useRef(0);
  const movedRef = useRef(false);

  const snapTo = (x: number) => {
    setAnimated(true);
    setOffset(x);
    setIsOpen(x < 0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    movedRef.current = false;
    setAnimated(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startXRef.current;
    if (Math.abs(dx) > 5) movedRef.current = true;
    const newOffset = isOpen
      ? Math.min(0, Math.max(-DELETE_W, -DELETE_W + dx))
      : Math.max(-DELETE_W, Math.min(0, dx));
    setOffset(newOffset);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startXRef.current;
    if (!movedRef.current) {
      if (isOpen) snapTo(0);
      else onOpen();
      return;
    }
    if (isOpen) {
      if (dx > 20) snapTo(0);
      else snapTo(-DELETE_W);
    } else {
      if (dx < -40) snapTo(-DELETE_W);
      else snapTo(0);
    }
  };

  useEffect(() => {
    if (!isSelected && isOpen) {
      setAnimated(true);
      setOffset(0);
      setIsOpen(false);
    }
  }, [isSelected, isOpen]);

  return (
    <div className="relative overflow-hidden border-b border-zinc-100">
      <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-red-500">
        <button
          onTouchEnd={(e) => { e.stopPropagation(); onDelete(); }}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex flex-col items-center justify-center gap-0.5 text-white w-full h-full active:bg-red-600"
          data-testid={`delete-convo-${phone}`}
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Delete</span>
        </button>
      </div>
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: animated ? "transform 0.2s ease" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative z-10 bg-white ${className ?? ""}`}
      >
        {children}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function AdminConversations() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "active" | "submitted" | "escalation">("all");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatMessage, setNewChatMessage] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteConvoMutation = useMutation({
    mutationFn: (phone: string) => apiRequest("DELETE", `/api/admin/whatsapp/conversations/${phone}`),
    onSuccess: (_data, phone) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
      if (selectedPhone === phone) setSelectedPhone(null);
      toast({ title: "Conversation deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  /* Override the dark landing-page gradient on <html> so any layout gaps are white */
  useEffect(() => {
    const prev = document.documentElement.style.background;
    document.documentElement.style.background = "white";
    return () => { document.documentElement.style.background = prev; };
  }, []);

  /* Container height: visual viewport minus the fixed 56px admin header.
     visualViewport.height already excludes the keyboard (when open) and the
     Safari bottom toolbar, so the container stays in the visible area naturally.
     interactive-widget=resizes-content (set in index.html) makes the layout
     viewport also resize with the keyboard on iOS 16+, which means in-flow
     elements at the bottom of a 100dvh container are never behind the keyboard. */
  useEffect(() => {
    const update = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--conv-h", `${vh - 56}px`);
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const { data: convos = [], isLoading: loadingConvos } = useQuery<Conversation[]>({
    queryKey: ["/api/admin/whatsapp/conversations"],
    refetchInterval: 6_000,
    refetchIntervalInBackground: true,
  });

  const selectedConvo = convos.find(c => c.phone === selectedPhone);
  const totalUnread = convos.reduce((s, c) => s + c.unreadCount, 0);
  const totalEscalation = convos.filter(c => c.botPaused).length;

  const filteredConvos = convos.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || [c.name, c.phone, c.lastMessage].some(v => v?.toLowerCase().includes(q));
    const matchFilter =
      filter === "unread" ? c.unreadCount > 0 :
      filter === "active" ? (!!c.state && c.state !== "submitted") :
      filter === "submitted" ? c.state === "submitted" :
      filter === "escalation" ? c.botPaused :
      true;
    return matchSearch && matchFilter;
  });

  const newChatMutation = useMutation({
    mutationFn: async ({ phone, message }: { phone: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/conversations/new", { phone, message });
      return res.json();
    },
    onSuccess: (data: any) => {
      setShowNewChat(false);
      setNewChatPhone("");
      setNewChatMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
      if (data?.phone) setSelectedPhone(data.phone);
      toast({ title: "Message sent", description: "Conversation started. Bot is paused — you're in admin mode." });
    },
    onError: (err: any) => {
      let reason = err?.message || "Failed to send message";
      try { reason = JSON.parse(reason.replace(/^\d+:\s*/, "")).message || reason; } catch {}
      toast({ title: "Failed to start chat", description: reason, variant: "destructive" });
    },
  });

  function openConvo(phone: string) {
    setSelectedPhone(phone);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
  }

  return (
    <div
      className="flex bg-[#F5F5F7] overflow-hidden lg:pl-56"
      style={{ marginTop: 56, height: "var(--conv-h, calc(100dvh - 56px))" }}
      data-testid="admin-conversations"
    >

      {/* ═══ New Chat Dialog ════════════════════════════════════════════════ */}
      {showNewChat && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowNewChat(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900">New Chat</h2>
                <p className="text-xs text-gray-400 mt-0.5">Start a conversation with any number</p>
              </div>
              <button onClick={() => setShowNewChat(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone Number (SG)</label>
                <input
                  type="tel"
                  value={newChatPhone}
                  onChange={e => setNewChatPhone(e.target.value)}
                  placeholder="e.g. 91234567 or 6591234567"
                  className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50 placeholder:text-gray-400"
                  data-testid="new-chat-phone"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">First Message</label>
                <textarea
                  value={newChatMessage}
                  onChange={e => setNewChatMessage(e.target.value)}
                  placeholder="Hi! I'm reaching out from TMG Install regarding your enquiry…"
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-gray-50 placeholder:text-gray-400 resize-none"
                  data-testid="new-chat-message"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowNewChat(false)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!newChatPhone.trim() || !newChatMessage.trim()) return;
                    newChatMutation.mutate({ phone: newChatPhone.trim(), message: newChatMessage.trim() });
                  }}
                  disabled={!newChatPhone.trim() || !newChatMessage.trim() || newChatMutation.isPending}
                  data-testid="new-chat-send"
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-[#25D366] text-white hover:bg-[#1db954] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {newChatMutation.isPending
                    ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Conversation List — full width on mobile when no chat, fixed width on desktop ═══ */}
      <div className={`flex flex-col flex-shrink-0 border-r border-gray-200 bg-white w-full lg:w-[340px] xl:w-[380px] ${selectedPhone ? "hidden lg:flex" : "flex"}`}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-100 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-zinc-900">WhatsApp</span>
              {totalUnread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold min-w-[20px] text-center">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowNewChat(true)}
                data-testid="new-chat-btn"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:bg-[#1db954] transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> New Chat
              </button>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] })}
                className="w-7 h-7 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-700 transition-all"
                data-testid="refresh-conversations"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="h-9 w-full bg-white border border-zinc-300 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 pl-8 pr-7 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all"
              data-testid="search-conversations"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
            {(["all", "unread", "active", "escalation", "submitted"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-[10px] font-semibold py-1 rounded-md capitalize transition-all relative ${
                  filter === f
                    ? f === "escalation"
                      ? "bg-red-50 text-red-700 shadow-sm border border-red-200"
                      : "bg-white text-zinc-900 shadow-sm border border-zinc-200"
                    : f === "escalation" && totalEscalation > 0
                      ? "text-red-500 hover:text-red-700"
                      : "text-zinc-500 hover:text-zinc-700"
                }`}
                data-testid={`filter-${f}`}
              >
                {f === "escalation" ? (
                  <span className="flex items-center justify-center gap-0.5">
                    <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />
                    {totalEscalation > 0 ? totalEscalation : ""}
                  </span>
                ) : f === "unread" && totalUnread > 0 ? (
                  `Unread (${totalUnread})`
                ) : (
                  f.charAt(0).toUpperCase() + f.slice(1)
                )}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loadingConvos && [0,1,2,3].map(i => <ConvoSkeleton key={i} />)}

          {!loadingConvos && filteredConvos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 px-6 text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${filter === "escalation" ? "bg-red-50" : "bg-zinc-100"}`}>
                {filter === "escalation"
                  ? <AlertCircle className="w-7 h-7 text-red-300" />
                  : <MessageCircle className="w-7 h-7 text-zinc-300" />
                }
              </div>
              <p className="text-sm font-medium text-zinc-400">
                {search ? "No results found" : filter === "escalation" ? "No escalations — all clear!" : filter !== "all" ? `No ${filter} conversations` : "No conversations yet"}
              </p>
            </div>
          )}

          {filteredConvos.map(convo => {
            const sc = getState(convo.state);
            const hasUnread = convo.unreadCount > 0;
            const isPaused = convo.botPaused;
            return (
              <SwipeableConvoRow
                key={convo.phone}
                phone={convo.phone}
                onOpen={() => openConvo(convo.phone)}
                onDelete={() => deleteConvoMutation.mutate(convo.phone)}
                isSelected={selectedPhone === convo.phone}
                className={
                  selectedPhone === convo.phone ? "bg-blue-50" :
                  isPaused ? "bg-red-50/40" : ""
                }
              >
                <button
                  onClick={() => openConvo(convo.phone)}
                  data-testid={`convo-${convo.phone}`}
                  className={`w-full text-left px-4 py-3 hover:bg-zinc-50 cursor-pointer transition-colors ${
                    selectedPhone === convo.phone ? "hover:bg-blue-50" :
                    isPaused ? "hover:bg-red-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <Avatar name={convo.name} phone={convo.phone} size="md" />
                      {isPaused
                        ? <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-red-500" />
                        : <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${sc.dot}`} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-sm leading-tight truncate ${hasUnread ? "font-bold text-zinc-900" : "font-medium text-zinc-800"}`}>
                          {convo.name || formatPhone(convo.phone)}
                        </span>
                        <span className="text-[10px] text-zinc-400 flex-shrink-0 tabular-nums">
                          {relativeTime(convo.lastAt)}
                        </span>
                      </div>
                      {convo.name && (
                        <p className="text-[11px] text-zinc-400 mb-0.5 font-mono">{formatPhone(convo.phone)}</p>
                      )}
                      <p className={`text-xs truncate leading-snug ${hasUnread ? "text-zinc-700 font-medium" : "text-zinc-400"}`}>
                        {convo.lastMessage ? stripWhatsAppMarkdown(convo.lastMessage) : ""}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        {isPaused ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border text-red-700 bg-red-50 border-red-200 flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> Needs Attention
                          </span>
                        ) : (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${sc.color} ${sc.bg}`}>
                            {sc.label}
                          </span>
                        )}
                        {hasUnread && (
                          <span className="min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                            {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </SwipeableConvoRow>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-zinc-100">
          <p className="text-[10px] text-zinc-400">{convos.length} conversation{convos.length !== 1 ? "s" : ""} · auto-refreshes</p>
        </div>
      </div>

      {/* Right side: ChatPanel or empty state */}
      {selectedPhone ? (
        <ChatPanel
          selectedPhone={selectedPhone}
          selectedConvo={selectedConvo}
          onClose={() => setSelectedPhone(null)}
        />
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-4 bg-[#F5F5F7]">
          <div className="w-16 h-16 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-zinc-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-400">Select a conversation</p>
            <p className="text-xs text-zinc-300 mt-1">Click any chat to open it · or start a new one</p>
          </div>
          <button
            onClick={() => setShowNewChat(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1db954] transition-all shadow-sm"
            data-testid="empty-state-new-chat"
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
      )}
    </div>
  );
}
