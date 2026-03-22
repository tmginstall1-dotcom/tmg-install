import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, Phone, RefreshCw, User, Bot, Clock, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

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

function stateLabel(state: string | null) {
  if (!state) return "Closed";
  const map: Record<string, string> = {
    awaiting_name: "Name",
    awaiting_address: "Address",
    awaiting_items: "Items",
    awaiting_items_verify: "Verify Items",
    awaiting_service_type: "Service",
    awaiting_floor: "Floor",
    awaiting_access: "Access",
    awaiting_to_address: "Dest. Address",
    awaiting_date: "Date",
    awaiting_confirmation: "Confirming",
    submitted: "Submitted",
  };
  return map[state] || state.replace(/_/g, " ");
}

function stateColor(state: string | null) {
  if (!state || state === "submitted") return "bg-green-500/20 text-green-400";
  if (state === "awaiting_confirmation") return "bg-amber-500/20 text-amber-400";
  return "bg-blue-500/20 text-blue-400";
}

function formatPhone(phone: string) {
  if (phone.startsWith("65") && phone.length >= 10) {
    return `+65 ${phone.slice(2, 6)} ${phone.slice(6)}`;
  }
  return `+${phone}`;
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminConversations() {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: convos = [], isLoading: loadingConvos } = useQuery<Conversation[]>({
    queryKey: ["/api/admin/whatsapp/conversations"],
    refetchInterval: 10000,
  });

  const { data: thread, isLoading: loadingThread } = useQuery<ThreadData>({
    queryKey: ["/api/admin/whatsapp/conversations", selectedPhone],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/whatsapp/conversations/${selectedPhone}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedPhone,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", `/api/admin/whatsapp/conversations/${selectedPhone}/send`, { message });
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (thread?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread?.messages?.length]);

  useEffect(() => {
    if (selectedPhone) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] });
    }
  }, [selectedPhone]);

  function handleSend() {
    if (!replyText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(replyText.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const selectedConvo = convos.find(c => c.phone === selectedPhone);

  // Group messages by date for display
  const grouped: { date: string; messages: WaMessage[] }[] = [];
  if (thread?.messages) {
    let lastDate = "";
    for (const msg of thread.messages) {
      const d = formatDate(msg.createdAt);
      if (d !== lastDate) { grouped.push({ date: d, messages: [] }); lastDate = d; }
      grouped[grouped.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] bg-slate-950" data-testid="admin-conversations">
      {/* Conversation List */}
      <div className={`${selectedPhone ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-80 xl:w-96 border-r border-white/[0.06] flex-shrink-0`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-white">WhatsApp</span>
            {convos.reduce((s, c) => s + c.unreadCount, 0) > 0 && (
              <span className="text-[10px] font-black bg-green-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                {convos.reduce((s, c) => s + c.unreadCount, 0)}
              </span>
            )}
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/whatsapp/conversations"] })}
            className="text-white/30 hover:text-white/70 transition-colors"
            data-testid="refresh-conversations"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvos && (
            <div className="flex items-center justify-center py-16 text-white/30 text-sm">Loading…</div>
          )}
          {!loadingConvos && convos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/30">
              <MessageCircle className="w-8 h-8" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Messages will appear here once customers chat with the bot</p>
            </div>
          )}
          {convos.map(convo => (
            <button
              key={convo.phone}
              onClick={() => setSelectedPhone(convo.phone)}
              data-testid={`convo-${convo.phone}`}
              className={`w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors hover:bg-white/[0.04] ${
                selectedPhone === convo.phone ? "bg-white/[0.07]" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-green-400" />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold text-white truncate">
                      {convo.name || formatPhone(convo.phone)}
                    </span>
                    <span className="text-[10px] text-white/30 flex-shrink-0">{relativeTime(convo.lastAt)}</span>
                  </div>
                  {convo.name && (
                    <p className="text-[10px] text-white/30 truncate">{formatPhone(convo.phone)}</p>
                  )}
                  <p className="text-xs text-white/50 truncate mt-0.5">{convo.lastMessage}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-sm ${stateColor(convo.state)}`}>
                      {stateLabel(convo.state)}
                    </span>
                    {convo.unreadCount > 0 && (
                      <span className="text-[9px] font-black bg-green-500 text-white w-4 h-4 rounded-full flex items-center justify-center leading-none">
                        {convo.unreadCount > 9 ? "9+" : convo.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Message Thread */}
      {selectedPhone ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Thread Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 bg-slate-950">
            <button
              onClick={() => setSelectedPhone(null)}
              className="lg:hidden text-white/50 hover:text-white mr-1"
              data-testid="back-to-list"
            >
              ←
            </button>
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {selectedConvo?.name || formatPhone(selectedPhone)}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-white/40">{formatPhone(selectedPhone)}</p>
                {selectedConvo?.state && (
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-sm ${stateColor(selectedConvo.state)}`}>
                    {stateLabel(selectedConvo.state)}
                  </span>
                )}
              </div>
            </div>
            <a
              href={`https://wa.me/${selectedPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 hover:text-green-400 transition-colors"
              data-testid="open-whatsapp"
              title="Open in WhatsApp"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ background: "rgba(15,23,42,0.8)" }}>
            {loadingThread && (
              <div className="flex items-center justify-center py-16 text-white/30 text-sm">Loading messages…</div>
            )}

            {grouped.map(group => (
              <div key={group.date}>
                {/* Date divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[10px] text-white/30 font-medium">{group.date}</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {group.messages.map((msg, idx) => {
                  const isOutbound = msg.direction === "outbound";
                  const isAdmin = msg.sentBy && msg.sentBy.startsWith("admin:");
                  const adminName = isAdmin ? msg.sentBy!.replace("admin:", "") : null;
                  const showSender = isOutbound && idx > 0 &&
                    group.messages[idx - 1].direction === "outbound" &&
                    group.messages[idx - 1].sentBy !== msg.sentBy;

                  return (
                    <div
                      key={msg.id}
                      data-testid={`msg-${msg.id}`}
                      className={`flex ${isOutbound ? "justify-end" : "justify-start"} mb-1`}
                    >
                      {!isOutbound && (
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                          <User className="w-3 h-3 text-green-400" />
                        </div>
                      )}
                      <div className={`max-w-[75%] lg:max-w-[60%]`}>
                        {isAdmin && showSender && (
                          <p className="text-[9px] text-white/30 text-right mb-0.5">{adminName}</p>
                        )}
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                            isOutbound
                              ? isAdmin
                                ? "bg-indigo-600 text-white rounded-br-sm"
                                : "bg-green-700 text-white rounded-br-sm"
                              : "bg-slate-800 text-white/90 rounded-bl-sm"
                          }`}
                        >
                          {msg.body}
                        </div>
                        <div className={`flex items-center gap-1 mt-0.5 ${isOutbound ? "justify-end" : "justify-start"}`}>
                          <span className="text-[9px] text-white/25">{formatTime(msg.createdAt)}</span>
                          {isOutbound && (
                            isAdmin
                              ? <span className="text-[9px] text-indigo-400/70">Admin</span>
                              : <Bot className="w-2.5 h-2.5 text-green-400/50" />
                          )}
                        </div>
                      </div>
                      {isOutbound && (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ml-2 mt-1 ${isAdmin ? "bg-indigo-500/20" : "bg-green-700/30"}`}>
                          {isAdmin ? <User className="w-3 h-3 text-indigo-400" /> : <Bot className="w-3 h-3 text-green-400" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Box */}
          <div className="px-4 py-3 border-t border-white/[0.06] bg-slate-950">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <Textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Ctrl+Enter to send)"
                  className="resize-none bg-slate-800 border-white/10 text-white placeholder:text-white/30 text-sm min-h-[60px] max-h-[140px] pr-3"
                  rows={2}
                  data-testid="reply-input"
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!replyText.trim() || sendMutation.isPending}
                className="bg-green-600 hover:bg-green-500 text-white h-[60px] px-4 flex-shrink-0"
                data-testid="send-reply"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-white/20 mt-1.5">
              Sending as <span className="text-indigo-400">Admin</span> — customer receives this on WhatsApp
            </p>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 text-white/20">
          <MessageCircle className="w-12 h-12" />
          <p className="text-sm">Select a conversation</p>
        </div>
      )}
    </div>
  );
}
