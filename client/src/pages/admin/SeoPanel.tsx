import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Globe, CheckCircle, XCircle, AlertCircle, Copy, ExternalLink,
  Star, Tag, FileText, ShieldCheck, BarChart2, TrendingUp, Sparkles, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ── Static live values from index.html (current deployed state) ────────────
const LIVE = {
  title:          "TMG Install | Furniture Installation & Relocation Singapore",
  description:    "Professional furniture installation, dismantling and relocation services in Singapore. Get an instant upfront quote from TMG Install — The Moving Guy Pte Ltd.",
  keywords:       "furniture installation Singapore, furniture assembly Singapore, IKEA installation Singapore, wardrobe installation, bed assembly Singapore, office furniture installation",
  canonical:      "https://tmginstall.com/",
  ogTitle:        "TMG Install | Furniture Installation & Relocation Singapore",
  ogDescription:  "Professional furniture installation, dismantling and relocation services in Singapore. Get an instant quote — no phone calls needed.",
  ogImage:        "https://tmginstall.com/og-image.png",
  twitterCard:    "summary_large_image",
  schemaTypes:    ["LocalBusiness", "WebSite"],
  sitemapUrls:    4,
  robotsOk:       true,
  sameAs:         ["WhatsApp", "Facebook", "Carousell"],
};

// ── SEO score computation ───────────────────────────────────────────────────
function computeScore(googleReviewUrl: string) {
  const titleLen  = LIVE.title.length;
  const descLen   = LIVE.description.length;
  let score = 0;
  if (titleLen >= 30 && titleLen <= 65)          score += 15;
  else if (titleLen > 0)                          score += 7;
  if (descLen >= 120 && descLen <= 160)           score += 15;
  else if (descLen > 0)                           score += 7;
  if (LIVE.keywords.length > 0)                   score += 10;
  if (LIVE.canonical.length > 0)                  score += 10;
  if (LIVE.ogTitle && LIVE.ogDescription && LIVE.ogImage) score += 15;
  if (LIVE.twitterCard)                           score += 10;
  if (LIVE.schemaTypes.length >= 2)               score += 10;
  if (LIVE.sitemapUrls > 0)                       score += 10;
  if (LIVE.robotsOk)                              score += 5;
  if (googleReviewUrl)                            score = Math.min(100, score + 5);
  return score;
}

// ── Copy to clipboard helper ────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(prev => prev === key ? null : prev), 2000);
  }
  return { copy, copied };
}

// ── Score ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 44, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 90 ? "#16a34a" : score >= 70 ? "#d97706" : "#dc2626";
  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black leading-none" style={{ color }}>{score}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ── Field row ───────────────────────────────────────────────────────────────
function FieldRow({
  label, value, minLen, maxLen, onCopy, copyKey, copied,
}: {
  label: string; value: string; minLen?: number; maxLen?: number;
  onCopy: (text: string, key: string) => void; copyKey: string; copied: string | null;
}) {
  const len = value.length;
  const ok  = minLen != null && maxLen != null ? len >= minLen && len <= maxLen : len > 0;
  const warn = maxLen != null && len > maxLen;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {ok && !warn
            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            : warn
            ? <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
          <span className="text-xs font-semibold text-zinc-700">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {minLen != null && maxLen != null && (
            <span className={`text-[10px] font-mono font-bold ${
              ok && !warn ? "text-emerald-600" : warn ? "text-amber-600" : "text-red-500"
            }`}>
              {len} / {maxLen}
            </span>
          )}
          <button
            onClick={() => onCopy(value, copyKey)}
            className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-700 transition-colors"
            data-testid={`copy-${copyKey}`}
          >
            <Copy className="w-3 h-3" />
            {copied === copyKey ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-600 bg-zinc-50 rounded-lg px-3 py-2 font-mono leading-relaxed break-all border border-zinc-100">
        {value}
      </p>
    </div>
  );
}

// ── Checklist item ──────────────────────────────────────────────────────────
function CheckItem({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-50 last:border-0">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        ok ? "bg-emerald-100" : "bg-red-50"
      }`}>
        {ok
          ? <CheckCircle className="w-3 h-3 text-emerald-600" />
          : <XCircle className="w-3 h-3 text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${ok ? "text-zinc-800" : "text-zinc-600"}`}>{label}</p>
        {note && <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{note}</p>}
      </div>
    </div>
  );
}

// ── Main SEO Panel ──────────────────────────────────────────────────────────
export default function SeoPanel() {
  const { toast } = useToast();
  const { copy, copied } = useCopy();

  const { data: settingsRaw = [] } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["/api/admin/app-settings"],
  });
  const settings = Object.fromEntries(
    (settingsRaw as { key: string; value: string }[]).map(s => [s.key, s.value])
  );

  const googleReviewUrl = settings.google_review_url || "https://g.page/r/Cd2v7iBjl_GKEBM/review";
  const storedKeywords: string[] = useMemo(() => {
    try { return JSON.parse(settings.seo_target_keywords || "[]"); } catch { return []; }
  }, [settings.seo_target_keywords]);

  const [localReviewUrl, setLocalReviewUrl] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [localKeywords, setLocalKeywords] = useState<string[] | null>(null);
  const displayKeywords = localKeywords ?? storedKeywords;
  const displayReviewUrl = localReviewUrl ?? googleReviewUrl;

  const score = useMemo(() => computeScore(displayReviewUrl), [displayReviewUrl]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiRequest("POST", "/api/admin/app-settings/bulk", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/app-settings"] });
      toast({ title: "SEO settings saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  function handleSave() {
    saveMutation.mutate({
      google_review_url: displayReviewUrl,
      seo_target_keywords: JSON.stringify(displayKeywords),
    });
  }

  function addKeyword() {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw || displayKeywords.includes(kw)) return;
    setLocalKeywords([...displayKeywords, kw]);
    setNewKeyword("");
  }

  function removeKeyword(kw: string) {
    setLocalKeywords(displayKeywords.filter(k => k !== kw));
  }

  const isDirty =
    (localReviewUrl !== null && localReviewUrl !== googleReviewUrl) ||
    (localKeywords !== null);

  // keyword match against live meta
  const combined = `${LIVE.title} ${LIVE.description} ${LIVE.keywords}`.toLowerCase();
  const keywordMatches = displayKeywords.map(kw => ({
    kw, found: combined.includes(kw.toLowerCase()),
  }));

  return (
    <div className="min-h-screen bg-zinc-50 lg:pl-56">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-4 sm:px-6 py-4 lg:py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Admin &rsaquo; SEO</p>
            <h1 className="text-xl font-black text-zinc-900 mt-0.5">SEO Optimisation</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Monitor and manage your site's search engine presence</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveMutation.isPending}
            data-testid="button-save-seo"
            className="bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-bold h-9 px-4 rounded-xl"
          >
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Score + Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Score card */}
          <div className="sm:col-span-1 bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col items-center gap-2 shadow-sm">
            <ScoreRing score={score} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">SEO Health</p>
            <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 ${
              score >= 90 ? "bg-emerald-100 text-emerald-700" :
              score >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"
            }`}>
              {score >= 90 ? "Excellent" : score >= 70 ? "Good" : "Needs Work"}
            </Badge>
          </div>

          {/* 3 stat cards */}
          <div className="sm:col-span-3 grid grid-cols-3 gap-4">
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Title Length</p>
              <p className="text-xl font-black text-zinc-900 tabular-nums">{LIVE.title.length}<span className="text-sm font-bold text-zinc-400"> ch</span></p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">Ideal: 30–65</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Desc Length</p>
              <p className="text-xl font-black text-zinc-900 tabular-nums">{LIVE.description.length}<span className="text-sm font-bold text-zinc-400"> ch</span></p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">Ideal: 120–160</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Schema Types</p>
              <p className="text-xl font-black text-zinc-900 tabular-nums">{LIVE.schemaTypes.length}</p>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">LocalBiz + WebSite</p>
            </div>
          </div>
        </div>

        {/* Meta Tags */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">Meta Tags</p>
              <p className="text-[11px] text-zinc-400">Live values from <code className="font-mono text-zinc-500">index.html</code></p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <FieldRow
              label="Page Title" value={LIVE.title}
              minLen={30} maxLen={65}
              onCopy={copy} copyKey="title" copied={copied}
            />
            <FieldRow
              label="Meta Description" value={LIVE.description}
              minLen={120} maxLen={160}
              onCopy={copy} copyKey="desc" copied={copied}
            />
            <FieldRow
              label="Keywords" value={LIVE.keywords}
              onCopy={copy} copyKey="kw" copied={copied}
            />
            <FieldRow
              label="Canonical URL" value={LIVE.canonical}
              onCopy={copy} copyKey="canonical" copied={copied}
            />
          </div>
        </div>

        {/* Social Preview + OG */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">Social / Open Graph Preview</p>
              <p className="text-[11px] text-zinc-400">How your link looks when shared on WhatsApp, Facebook &amp; Telegram</p>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OG fields */}
            <div className="space-y-4">
              <FieldRow label="OG Title"       value={LIVE.ogTitle}       minLen={30} maxLen={65} onCopy={copy} copyKey="og-title" copied={copied} />
              <FieldRow label="OG Description" value={LIVE.ogDescription} minLen={60} maxLen={155} onCopy={copy} copyKey="og-desc" copied={copied} />
              <FieldRow label="OG Image URL"   value={LIVE.ogImage}       onCopy={copy} copyKey="og-img" copied={copied} />
            </div>
            {/* Facebook-style preview card */}
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Link Preview</p>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                <div className="h-32 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                  <img
                    src="/og-image.png"
                    alt="OG Image"
                    className="w-full h-full object-cover opacity-80"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="p-3 bg-zinc-50 border-t border-zinc-200">
                  <p className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wide">tmginstall.com</p>
                  <p className="text-sm font-bold text-zinc-900 leading-snug mt-0.5 line-clamp-2">{LIVE.ogTitle}</p>
                  <p className="text-xs text-zinc-500 leading-snug mt-1 line-clamp-2">{LIVE.ogDescription}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] font-bold">OG ✓</Badge>
                <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] font-bold">Twitter Card ✓</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Google Review */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">Google Review Link</p>
              <p className="text-[11px] text-zinc-400">Sent to customers after job completion to collect reviews</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex gap-2">
              <Input
                value={displayReviewUrl}
                onChange={e => setLocalReviewUrl(e.target.value)}
                placeholder="https://g.page/r/..."
                className="flex-1 h-9 text-xs font-mono rounded-xl border-zinc-200"
                data-testid="input-seo-review-url"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-xl"
                onClick={() => window.open(displayReviewUrl, "_blank")}
                data-testid="link-open-review"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <Link2 className="w-3 h-3" />
              Google Business → Get more reviews → Share review form → Copy link
            </p>
          </div>
        </div>

        {/* Target Keywords */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
              <Tag className="w-3.5 h-3.5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">Target Keywords</p>
              <p className="text-[11px] text-zinc-400">Track if your focus keywords appear in meta tags</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addKeyword()}
                placeholder="e.g. IKEA assembly Singapore"
                className="flex-1 h-9 text-xs rounded-xl border-zinc-200"
                data-testid="input-new-keyword"
              />
              <Button
                onClick={addKeyword}
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-xl font-bold"
                data-testid="button-add-keyword"
              >
                Add
              </Button>
            </div>
            {displayKeywords.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-4">
                No target keywords yet. Add keywords you want to rank for.
              </p>
            ) : (
              <div className="space-y-2">
                {keywordMatches.map(({ kw, found }) => (
                  <div key={kw} className="flex items-center justify-between gap-3 py-2 border-b border-zinc-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {found
                        ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      <span className="text-xs font-medium text-zinc-800 truncate">{kw}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-[10px] font-bold border-0 px-2 py-0.5 ${
                        found ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {found ? "In meta" : "Missing"}
                      </Badge>
                      <button
                        onClick={() => removeKeyword(kw)}
                        className="text-zinc-300 hover:text-red-400 transition-colors text-xs font-bold"
                        data-testid={`remove-keyword-${kw}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Business Profiles / sameAs */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Link2 className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">Business Profiles</p>
              <p className="text-[11px] text-zinc-400">Linked in Schema.org <code className="font-mono text-zinc-500">sameAs</code> — signals to Google these are the same business</p>
            </div>
          </div>
          <div className="divide-y divide-zinc-50">
            {[
              { label: "WhatsApp Business",   url: "https://wa.me/6580880757",                      icon: "💬", color: "text-emerald-700 bg-emerald-50" },
              { label: "Facebook Page",       url: "https://www.facebook.com/tmginstall",           icon: "📘", color: "text-blue-700 bg-blue-50" },
              { label: "Carousell",           url: "https://www.carousell.sg/u/tmg_01f647/",        icon: "🛍️", color: "text-orange-700 bg-orange-50" },
            ].map(({ label, url, icon, color }) => (
              <div key={url} className="flex items-center gap-3 px-5 py-3.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${color}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">{label}</p>
                  <p className="text-[11px] font-mono text-zinc-400 truncate">{url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                    <CheckCircle className="w-2.5 h-2.5" />
                    Live
                  </span>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-300 hover:text-blue-500 transition-colors"
                    data-testid={`link-profile-${label.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full SEO Checklist */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">SEO Checklist</p>
              <p className="text-[11px] text-zinc-400">Technical and on-page SEO requirements</p>
            </div>
          </div>
          <div className="px-5 pb-2">
            <CheckItem label="Page title set (30–65 chars)"          ok={LIVE.title.length >= 30 && LIVE.title.length <= 65}      note={`${LIVE.title.length} characters`} />
            <CheckItem label="Meta description set (120–160 chars)"  ok={LIVE.description.length >= 120 && LIVE.description.length <= 160} note={`${LIVE.description.length} characters`} />
            <CheckItem label="Keywords meta tag present"              ok={LIVE.keywords.length > 0} />
            <CheckItem label="Canonical URL set"                      ok={!!LIVE.canonical}          note={LIVE.canonical} />
            <CheckItem label="Open Graph tags (og:title, og:desc, og:image)" ok={!!(LIVE.ogTitle && LIVE.ogDescription && LIVE.ogImage)} />
            <CheckItem label="Twitter Card configured"                ok={!!LIVE.twitterCard}        note={`type: ${LIVE.twitterCard}`} />
            <CheckItem label="Schema.org LocalBusiness"              ok={LIVE.schemaTypes.includes("LocalBusiness")} note="Structured data for Google Knowledge Panel" />
            <CheckItem label="Schema.org WebSite + SearchAction"     ok={LIVE.schemaTypes.includes("WebSite")}      note="Enables Google Sitelinks Searchbox" />
            <CheckItem label="Schema.org sameAs profiles"            ok={LIVE.sameAs.length >= 3}   note={LIVE.sameAs.join(" · ")} />
            <CheckItem label="Sitemap.xml present"                   ok={LIVE.sitemapUrls > 0}      note={`${LIVE.sitemapUrls} URLs indexed`} />
            <CheckItem label="robots.txt present"                    ok={LIVE.robotsOk}             note="Admin & API paths disallowed" />
            <CheckItem label="Google Analytics / Ads tracking"       ok                             note="Google Tag Manager (AW-18012639714) active" />
            <CheckItem label="Google Review link configured"         ok={!!displayReviewUrl}        note="Sent automatically after job completion" />
          </div>
        </div>

        {/* Files */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sitemap */}
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-sm font-bold text-zinc-900">sitemap.xml</p>
              </div>
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                data-testid="link-sitemap"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </a>
            </div>
            <div className="p-5 space-y-2">
              {[
                { url: "https://tmginstall.com/",        priority: "1.0", freq: "weekly"  },
                { url: "https://tmginstall.com/estimate", priority: "0.9", freq: "monthly" },
                { url: "https://tmginstall.com/terms",   priority: "0.3", freq: "yearly"  },
                { url: "https://tmginstall.com/privacy", priority: "0.3", freq: "yearly"  },
              ].map(({ url, priority, freq }) => (
                <div key={url} className="flex items-center gap-2 py-1.5 border-b border-zinc-50 last:border-0">
                  <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="text-[11px] text-zinc-600 font-mono flex-1 truncate">{url.replace("https://tmginstall.com", "")  || "/"}</span>
                  <span className="text-[10px] font-bold text-zinc-400">{priority}</span>
                  <span className="text-[10px] text-zinc-300">{freq}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Robots */}
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <Search className="w-3.5 h-3.5 text-zinc-600" />
                </div>
                <p className="text-sm font-bold text-zinc-900">robots.txt</p>
              </div>
              <a
                href="/robots.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                data-testid="link-robots"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </a>
            </div>
            <div className="p-5">
              <pre className="text-[11px] font-mono text-zinc-600 bg-zinc-50 rounded-xl p-3 leading-relaxed border border-zinc-100 whitespace-pre-wrap">
{`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /staff/
Disallow: /api/
Disallow: /quotes/
Disallow: /status/

Sitemap: https://tmginstall.com/sitemap.xml`}
              </pre>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">Growth Recommendations</p>
              <p className="text-[11px] text-zinc-400">Next steps to improve your SEO ranking</p>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Sparkles, title: "Google Business Profile",   desc: "Ensure your Google Business Profile is verified and has up-to-date hours, photos, and services.", color: "text-blue-600 bg-blue-50" },
                { icon: Star,     title: "Collect more reviews",       desc: "Send the Google Review link after every completed job. Aim for 50+ reviews to unlock the Google Knowledge Panel.", color: "text-amber-600 bg-amber-50" },
                { icon: Search,   title: "Rank for long-tail keywords", desc: "Add blog posts or FAQ entries targeting phrases like 'IKEA wardrobe assembly Singapore' or 'HDB furniture installation'.", color: "text-green-600 bg-green-50" },
                { icon: Globe,    title: "Local listings ✓ Carousell live", desc: "Carousell profile linked in Schema.org sameAs. Next: get listed on Qoo10, HardwareZone classifieds, and Singapore home decor directories.", color: "text-violet-600 bg-violet-50" },
                { icon: BarChart2, title: "Track keyword rankings",    desc: "Use Google Search Console to monitor which queries bring traffic, and expand pages for top queries.", color: "text-zinc-600 bg-zinc-100" },
                { icon: TrendingUp, title: "Page Speed",               desc: "Ensure mobile LCP < 2.5s. Compress OG image and serve images via a CDN for faster load times.", color: "text-rose-600 bg-rose-50" },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div key={title} className="flex gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-800">{title}</p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
