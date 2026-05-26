import { ReactNode } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Yeezy / editorial design tokens
//
//   PAPER  = warm off-white background (#F5F4F0)
//   INK    = near-black ink (#0A0A0A)
//   STONE  = subtle muted bg (#EBE9E2)
//   HAIRLINE / HAIRLINE_SOFT = hard but quiet borders
//
//   Type:   uppercase, heavy weight, wide tracking for labels.
//           tabular-nums + font-black for numerics.
//   Corners: hard / minimal (rounded-none, rounded-sm only).
//   No shadows, no gradients, no blur effects.
// ────────────────────────────────────────────────────────────────────────────

export const Y = {
  paper:        "bg-[#F5F4F0]",
  paperSolid:   "#F5F4F0",
  ink:          "text-[#0A0A0A]",
  inkBg:        "bg-[#0A0A0A]",
  inkSolid:     "#0A0A0A",
  stone:        "bg-[#EBE9E2]",
  stoneBorder:  "border-black/12",
  hairline:     "border-black/15",
  hairlineSoft: "border-black/8",
  label:        "uppercase tracking-[0.18em] font-black",
  num:          "tabular-nums font-black tracking-tight",
  urgent:       "text-[#C1121F]",
  urgentBg:     "bg-[#C1121F]",
};

// ────────────────────────────────────────────────────────────────────────────
// PageHeader — unified header for every admin page
// ────────────────────────────────────────────────────────────────────────────
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="bg-white border-b border-black/12 px-4 sm:px-6 py-5 sm:py-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-black/55 mb-2">
                {eyebrow}
              </p>
            )}
            <h1 className="text-[26px] sm:text-[32px] font-black text-[#0A0A0A] tracking-tight leading-[1.05]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[13px] sm:text-[14px] text-black/60 font-medium mt-2 max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">{actions}</div>}
        </div>
        {meta && <div className="mt-5 pt-5 border-t border-black/8">{meta}</div>}
      </div>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PageShell — wraps a page in PAPER background + standard spacing
// ────────────────────────────────────────────────────────────────────────────
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pt-14 pb-24 lg:pb-10 lg:pl-56 bg-[#F5F4F0] overflow-x-hidden">
      {children}
    </div>
  );
}

export function PageBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 ${className}`}>{children}</div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Card — flat editorial surface
// ────────────────────────────────────────────────────────────────────────────
export function Card({
  children, className = "", as: As = "div", ...rest
}: {
  children: ReactNode; className?: string; as?: any;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={`bg-white border border-black/12 ${className}`}
      {...rest}
    >
      {children}
    </As>
  );
}

export function SectionHeader({
  icon: Icon, title, badge, badgeUrgent, action,
}: {
  icon?: any; title: string; badge?: number; badgeUrgent?: boolean; action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 h-12 border-b border-black/10 bg-white">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className="w-3.5 h-3.5 text-[#0A0A0A] shrink-0" />}
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0A0A0A] truncate">{title}</h2>
        {badge != null && badge > 0 && (
          <span className={`inline-flex items-center h-5 px-1.5 text-[10px] font-black tabular-nums ${
            badgeUrgent ? "bg-[#C1121F] text-white" : "bg-[#0A0A0A] text-white"
          }`}>
            {badge}
          </span>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Buttons
// ────────────────────────────────────────────────────────────────────────────
type BtnVariant = "ink" | "outline" | "ghost" | "danger";
const BTN_VARIANT: Record<BtnVariant, string> = {
  ink:     "bg-[#0A0A0A] text-white hover:bg-black",
  outline: "bg-white text-[#0A0A0A] border border-black/25 hover:border-[#0A0A0A]",
  ghost:   "bg-transparent text-[#0A0A0A]/70 hover:text-[#0A0A0A] hover:bg-black/5",
  danger:  "bg-[#C1121F] text-white hover:bg-[#a30f1a]",
};

export function Button({
  variant = "ink", size = "md", icon: Icon, children, className = "", ...rest
}: {
  variant?: BtnVariant;
  size?: "sm" | "md";
  icon?: any;
  children?: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeCls = size === "sm" ? "h-8 px-3 text-[10px]" : "h-10 px-4 text-[11px]";
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-black uppercase tracking-[0.15em] transition-colors ${sizeCls} ${BTN_VARIANT[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />}
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pill / status chip
// ────────────────────────────────────────────────────────────────────────────
export function Pill({
  tone = "ink", children, className = "",
}: {
  tone?: "ink" | "stone" | "urgent" | "outline" | "ok";
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    ink:     "bg-[#0A0A0A] text-white",
    stone:   "bg-[#EBE9E2] text-[#0A0A0A]",
    urgent:  "bg-[#C1121F] text-white",
    ok:      "bg-[#0A0A0A] text-white",
    outline: "bg-white text-[#0A0A0A] border border-black/25",
  };
  return (
    <span className={`inline-flex items-center h-5 px-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Empty / loading states — consistent across pages
// ────────────────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, hint }: { icon?: any; title: string; hint?: string }) {
  return (
    <div className="py-14 px-6 flex flex-col items-center gap-3 text-center">
      {Icon && <Icon className="w-8 h-8 text-black/20" strokeWidth={1.4} />}
      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]">{title}</p>
      {hint && <p className="text-[12px] text-black/55 font-medium max-w-xs">{hint}</p>}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-black/45">
      <Loader2 className="w-4 h-4 animate-spin" />
      <p className="text-[11px] font-black uppercase tracking-[0.22em]">{label}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stat — labelled big number block (PAPER style)
// ────────────────────────────────────────────────────────────────────────────
export function Stat({
  label, value, hint, accent = "ink", icon: Icon, href, "data-testid": testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: "ink" | "urgent" | "ok" | "stone";
  icon?: any;
  href?: string;
  "data-testid"?: string;
}) {
  const accentText = accent === "urgent" ? "text-[#C1121F]" : "text-[#0A0A0A]";
  const inner = (
    <div
      className="bg-white border border-black/12 px-4 sm:px-5 py-4 sm:py-5 hover:border-[#0A0A0A] transition-colors"
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55">{label}</p>
        {Icon && <Icon className="w-3.5 h-3.5 text-black/40" />}
      </div>
      <div className={`text-[28px] sm:text-[34px] leading-none ${accentText} ${Y.num}`}>{value}</div>
      {hint && <div className="text-[11px] text-black/55 font-medium mt-2.5">{hint}</div>}
    </div>
  );
  if (href) return <Link href={href}><a className="block">{inner}</a></Link>;
  return inner;
}
