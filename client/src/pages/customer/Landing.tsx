import { Link } from "wouter";
import { motion } from "framer-motion";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Package,
  Zap,
  MessageCircle,
  Shield,
  Clock,
  Building2,
  Home,
  Truck,
  Star,
  ChevronDown,
  Sofa,
  Monitor,
  Dumbbell,
  BedDouble,
  Wind,
  ChefHat,
  Plus,
  Minus,
  CalendarDays,
  Wrench,
  CreditCard,
  FileText,
  Mail,
  ScanSearch,
  ListChecks,
  Users,
  Receipt,
} from "lucide-react";
import { useState } from "react";
import { usePromoBar } from "@/hooks/use-promo-bar";

const WHATSAPP = "https://wa.me/6580880757?text=hi";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};

const fadeUpDelayed = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay },
});

const MARQUEE_ITEMS = [
  "Wardrobe Installation",
  "Bed Frame Assembly",
  "Office Fit-Out",
  "Furniture Dismantling",
  "IKEA Assembly",
  "Gym Equipment",
  "Kitchen Cabinets",
  "Sofa Relocation",
  "HDB · Condo · Landed",
  "Blind & Curtain Fitting",
  "Commercial Spaces",
  "Same-Week Scheduling",
];

const SERVICES = [
  { icon: BedDouble,  label: "Beds & Frames",      count: "40+" },
  { icon: Package,    label: "Wardrobes",           count: "60+" },
  { icon: Monitor,    label: "Office Furniture",    count: "80+" },
  { icon: Sofa,       label: "Sofas & Lounges",     count: "30+" },
  { icon: Dumbbell,   label: "Gym Equipment",       count: "50+" },
  { icon: ChefHat,    label: "Kitchen Furniture",   count: "45+" },
  { icon: Wind,       label: "Blinds & Curtains",   count: "35+" },
  { icon: Truck,      label: "Appliance Relocation", count: "20+" },
];

const REVIEWS = [
  {
    name: "Priya T.",
    loc: "Sengkang",
    stars: 5,
    text: "Had them install our entire IKEA bedroom set — wardrobe, bed frame, study desk. Efficient, clean, no damage. Done in under 3 hours.",
  },
  {
    name: "Jason L.",
    loc: "Tanjong Pagar",
    stars: 5,
    text: "Office fit-out for 20 workstations done in a single day. The team was professional and knew exactly what they were doing. Will use again.",
  },
  {
    name: "Michelle K.",
    loc: "Tampines",
    stars: 5,
    text: "Got an instant quote online, booked a slot for the next day. Crew arrived on time and completed the job without any fuss. Great service.",
  },
];

const FAQS = [
  {
    q: "How is the price calculated?",
    a: "We use a fixed-price catalog of 450+ items. Select exactly what needs to be installed, dismantled, or relocated and the total is generated instantly — no guesswork, no surprise charges.",
  },
  {
    q: "Do you cover all of Singapore?",
    a: "Yes. We serve all 28 districts including HDB towns, condominiums, landed properties, shophouses, offices, and commercial or industrial premises.",
  },
  {
    q: "How quickly can you schedule a job?",
    a: "Same-week appointments are often available. After you receive your estimate, you'll choose a preferred date and we'll confirm via WhatsApp.",
  },
  {
    q: "Do I need to provide any tools or materials?",
    a: "No. Our team arrives with all necessary tools and equipment. Just let us know what needs to be done and we'll handle everything.",
  },
  {
    q: "What if I need to cancel or reschedule?",
    a: "Just message us on WhatsApp as early as possible. We're flexible for reasonable reschedules with adequate notice.",
  },
  {
    q: "Can you handle large commercial or office jobs?",
    a: "Absolutely. We regularly handle full office fit-outs, workstation installations, partition setups, and large-scale strip-outs. Just describe your requirements in the estimate wizard or WhatsApp us directly.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-black/8">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-sm font-semibold text-black pr-6 leading-snug group-hover:text-black/70 transition-colors">
          {q}
        </span>
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {open ? <Minus className="w-4 h-4 text-black/40" /> : <Plus className="w-4 h-4 text-black/40" />}
        </span>
      </button>
      {open && (
        <div className="pb-5 pr-8">
          <p className="font-body text-sm text-gray-500 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  usePageTracker("/");
  const { visible: promoVisible } = usePromoBar();

  return (
    <div className={`min-h-screen bg-white text-black ${promoVisible ? "pt-24" : "pt-14"}`}>

      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] opacity-[0.03]"
            style={{ background: "radial-gradient(circle at top right, #000 0%, transparent 70%)" }} />
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── LEFT: Copy ── */}
            <motion.div {...fadeUp}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-black/15 bg-black/[0.03] mb-8">
                <Zap className="w-3.5 h-3.5 text-black" />
                <span className="text-[10px] font-black tracking-[0.18em] text-black uppercase">
                  Singapore's Furniture Installation Specialists
                </span>
              </div>

              <h1 className="hero-title text-black mb-6">
                Installation,<br />Dismantling &amp;<br />Relocation.
              </h1>

              <p className="font-body text-base sm:text-lg text-gray-500 mb-10 leading-relaxed max-w-md">
                From a single wardrobe to a full office fit-out — TMG Install
                handles every job across Singapore with transparent, upfront pricing.
                Get your quote in under 60 seconds, no calls required.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-12">
                <Link
                  href="/estimate"
                  data-testid="hero-cta-guided"
                  onClick={() => trackEvent("cta_click", "/", "hero_get_estimate")}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white font-black text-xs uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors"
                >
                  GET ESTIMATE <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="hero-cta-whatsapp"
                  onClick={() => trackEvent("cta_click", "/", "hero_whatsapp")}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border border-black/20 text-black font-black text-xs uppercase tracking-[0.12em] hover:border-black/50 hover:bg-gray-50 transition-all"
                >
                  <MessageCircle className="w-4 h-4" /> WHATSAPP US
                </a>
              </div>

              {/* Trust row — desktop */}
              <div className="hidden sm:flex flex-wrap gap-x-8 gap-y-3">
                {[
                  { icon: Building2, label: "HDB / Condo / Office / Commercial" },
                  { icon: MapPin, label: "All Singapore Districts" },
                  { icon: Clock, label: "Flexible Same-Week Scheduling" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-black/40 flex-shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {/* Mobile stats strip */}
              <div className="sm:hidden grid grid-cols-3 gap-3 pt-2">
                {[
                  { val: "450+", label: "Items" },
                  { val: "60s",  label: "Quote" },
                  { val: "SG",   label: "Island-wide" },
                ].map(({ val, label }) => (
                  <div key={label} className="border border-black/10 p-3 text-center">
                    <div className="font-heading font-bold text-2xl leading-none text-black mb-1">{val}</div>
                    <div className="text-[10px] font-semibold text-black/40 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── RIGHT: Visual Quote Card (desktop only) ── */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute inset-0 translate-x-3 translate-y-3 border border-black/8 bg-black/[0.02]" />
                <div className="relative bg-white border border-black/12 shadow-[0_8px_48px_rgba(0,0,0,0.08)]">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-black/8">
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase" style={{ letterSpacing: "0.15em" }}>
                        Estimate
                      </p>
                      <p className="font-heading font-bold text-black text-lg leading-tight">TMG-INSTANT</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 border border-black/12 bg-black/[0.02]">
                      <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                      <span className="text-[10px] font-semibold text-black tracking-widest uppercase" style={{ letterSpacing: "0.1em" }}>AI Generated</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-black/35 font-semibold uppercase mb-1" style={{ letterSpacing: "0.12em" }}>Service Type</p>
                        <div className="flex gap-2">
                          {["Installation", "Dismantling"].map(s => (
                            <span key={s} className={`text-xs px-2.5 py-0.5 border font-medium ${s === "Installation" ? "border-black/20 bg-black text-white" : "border-black/12 text-black/50"}`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-black/[0.025] border border-black/6">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-black/40 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-black/35 font-semibold uppercase mb-0.5" style={{ letterSpacing: "0.1em" }}>Location</p>
                          <p className="text-xs text-black font-medium">22 Tampines Industrial Ave 4, #04-01</p>
                          <p className="text-xs text-black/40">Singapore 528763</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-black/35 font-semibold uppercase" style={{ letterSpacing: "0.12em" }}>Items <span className="text-black/25">— 3 selected</span></p>
                        <Package className="w-3.5 h-3.5 text-black/20" />
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { name: "3-Door Wardrobe", qty: 2, price: "$110" },
                          { name: "Queen Bed Frame", qty: 1, price: "$80" },
                          { name: "L-Shaped Desk",   qty: 1, price: "$65" },
                        ].map(item => (
                          <div key={item.name} className="flex items-center justify-between py-2 border-b border-black/5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-black/25 font-mono w-4">×{item.qty}</span>
                              <span className="text-xs text-black font-medium">{item.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-black">{item.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border border-black/8 p-4 space-y-2">
                      {[
                        { label: "Subtotal",  val: "$255.00" },
                        { label: "Transport", val: "$120.00" },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs text-black/50">
                          <span>{r.label}</span><span>{r.val}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-black/8 flex justify-between">
                        <span className="text-xs font-bold text-black uppercase tracking-wide">Total Estimate</span>
                        <span className="text-sm font-bold text-black">$375.00</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1 py-3 bg-black text-center text-xs font-semibold text-white tracking-widest uppercase cursor-default select-none" style={{ letterSpacing: "0.12em" }}>
                        Pay Deposit
                      </div>
                      <div className="px-4 py-3 border border-black/15 text-center flex items-center justify-center cursor-default select-none">
                        <MessageCircle className="w-3.5 h-3.5 text-black/40" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ MARQUEE TICKER ════════════════════════ */}
      <div className="border-t border-b border-black/8 bg-black overflow-hidden py-3.5 select-none">
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-4 px-6">
              <span className="text-[10px] font-black tracking-[0.18em] uppercase text-white/60 whitespace-nowrap">
                {item}
              </span>
              <span className="w-1 h-1 bg-white/20 flex-shrink-0" />
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ TRUST STRIP ═══════════════════════ */}
      <section className="border-b border-black/8 bg-black/[0.018] px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x sm:divide-black/8">
            {[
              { icon: Shield,    label: "Experienced Installers",   sub: "Skilled & professional team" },
              { icon: Zap,       label: "Upfront Pricing",          sub: "No hidden costs, ever" },
              { icon: Clock,     label: "Fast Scheduling",          sub: "Same-week availability" },
              { icon: Building2, label: "Residential & Commercial", sub: "HDB, condo, office & more" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="sm:px-8 first:pl-0 last:pr-0 flex items-start sm:items-center gap-3">
                <Icon className="w-4 h-4 text-black/40 mt-0.5 sm:mt-0 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-black">{label}</p>
                  <p className="text-xs text-black/40 font-body mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ WHAT WE HANDLE ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-12">
            <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
              Our Catalog
            </p>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h2 className="section-title text-black">What we handle.</h2>
              <Link
                href="/estimate"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-black border-b border-black/30 pb-0.5 hover:border-black transition-colors whitespace-nowrap"
              >
                Browse full catalog <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-black/8">
            {SERVICES.map(({ icon: Icon, label, count }, i) => (
              <motion.div
                key={label}
                {...fadeUpDelayed(i * 0.06)}
                className="bg-white p-7 group hover:bg-black hover:text-white transition-colors duration-300 cursor-default"
              >
                <Icon className="w-5 h-5 text-black/30 group-hover:text-white/40 mb-5 transition-colors" />
                <p className="text-sm font-semibold text-black group-hover:text-white transition-colors leading-snug mb-1">
                  {label}
                </p>
                <p className="text-[11px] text-black/30 group-hover:text-white/30 transition-colors font-mono">
                  {count} items
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════ BOOKING FLOW ══════════════════════ */}
      <section className="bg-white px-4 sm:px-6 lg:px-8 py-28 border-t border-black/8">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <motion.div {...fadeUpDelayed(0)} className="mb-16">
            <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
              The Full Booking Flow
            </p>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h2 className="section-title text-black">From enquiry to job done.</h2>
              <Link
                href="/estimate"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-black border-b border-black/30 pb-0.5 hover:border-black transition-colors whitespace-nowrap"
              >
                Start now <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="font-body text-sm text-gray-500 mt-4 max-w-xl leading-relaxed">
              Ten clear steps — from choosing your service to final payment. Every stage is transparent, online, and confirmed in writing.
            </p>
          </motion.div>

          {/* ══════════ DESKTOP LAYOUT ══════════ */}
          <div className="hidden lg:block space-y-0">

            {/* ── Phase 1: YOU DO ONLINE ── */}
            <motion.div {...fadeUpDelayed(0.04)} className="flex items-center gap-3 mb-4">
              <span className="text-[9px] font-black tracking-[0.2em] uppercase text-black/40 px-2.5 py-1 border border-black/10 bg-black/[0.025] flex-shrink-0">
                Step 1–4 &nbsp;·&nbsp; You complete online
              </span>
              <div className="flex-1 h-px bg-black/8" />
            </motion.div>

            <div className="grid grid-cols-4 gap-px bg-black/8 mb-6">
              {([
                { n: "01", icon: ListChecks,  title: "Choose Your Service",   body: "Select installation, dismantling, or relocation — or any combination. Covers home, office, and commercial.",   tag: "Service type"    },
                { n: "02", icon: MapPin,       title: "Enter Your Location",   body: "Your Singapore address. All HDB, condo, landed, shophouse, and commercial premises across every district.",     tag: "Island-wide"     },
                { n: "03", icon: Package,      title: "Select Items",          body: "Pick from 450+ items — beds, wardrobes, workstations, gym equipment, blinds, appliances, and more.",            tag: "450+ catalog"    },
                { n: "04", icon: CalendarDays, title: "Choose Date & Time",    body: "Select your preferred appointment window. Same-week slots are usually available — we confirm quickly.",          tag: "Same-week slots" },
              ] as const).map(({ n, icon: Icon, title, body, tag }, i) => (
                <motion.div key={n} {...fadeUpDelayed(0.06 + i * 0.07)} className="bg-white p-8 group hover:bg-black/[0.018] transition-colors duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-heading font-bold text-[52px] leading-none text-black/[0.05] select-none group-hover:text-black/10 transition-colors">{n}</span>
                    <div className="w-9 h-9 border border-black/12 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-black/40" />
                    </div>
                  </div>
                  <h3 className="card-title text-black mb-2">{title}</h3>
                  <p className="font-body text-sm text-gray-500 leading-relaxed mb-4">{body}</p>
                  <span className="inline-flex text-[10px] font-semibold px-2.5 py-1 border border-black/10 text-black/40 tracking-wide">{tag}</span>
                </motion.div>
              ))}
            </div>

            {/* ── Phase 2: WE PREPARE ── */}
            <motion.div {...fadeUpDelayed(0.34)} className="flex items-center gap-3 mb-4">
              <span className="text-[9px] font-black tracking-[0.2em] uppercase text-black/40 px-2.5 py-1 border border-black/10 bg-black/[0.025] flex-shrink-0">
                Step 5–7 &nbsp;·&nbsp; We prepare your booking
              </span>
              <div className="flex-1 h-px bg-black/8" />
            </motion.div>

            <div className="grid grid-cols-3 gap-px bg-black/8 mb-6">
              {([
                {
                  n: "05", icon: FileText,
                  title: "Estimate Generated",
                  body: "An itemised quote is produced instantly — every item priced individually. Transport, floor, and access surcharges are listed separately so there are no surprises.",
                  tag: "Instant & itemised",
                  dark: false,
                },
                {
                  n: "06", icon: ScanSearch,
                  title: "Admin Review & Approval",
                  body: "Our team reviews your submission, verifies the scope of work, resolves any questions, and greenlights the job before sending payment details.",
                  tag: "Team verified",
                  dark: false,
                },
                {
                  n: "07", icon: Mail,
                  title: "Deposit Invoice — Pay via Stripe",
                  body: "A deposit invoice is emailed to you with a secure Stripe payment link. Click to pay 50% online by card. Your time slot is held for 48 hours.",
                  tag: "Secure · Stripe · 50% deposit",
                  dark: false,
                },
              ] as const).map(({ n, icon: Icon, title, body, tag, dark }, i) => (
                <motion.div key={n} {...fadeUpDelayed(0.36 + i * 0.07)} className={`p-8 group transition-colors duration-300 ${dark ? "bg-black hover:bg-neutral-900" : "bg-white hover:bg-black/[0.018]"}`}>
                  <div className="flex items-start justify-between mb-6">
                    <span className={`font-heading font-bold text-[52px] leading-none select-none transition-colors ${dark ? "text-white/[0.06] group-hover:text-white/10" : "text-black/[0.05] group-hover:text-black/10"}`}>{n}</span>
                    <div className={`w-9 h-9 border flex items-center justify-center flex-shrink-0 ${dark ? "border-white/15" : "border-black/12"}`}>
                      <Icon className={`w-4 h-4 ${dark ? "text-white/50" : "text-black/40"}`} />
                    </div>
                  </div>
                  <h3 className={`card-title mb-2 ${dark ? "text-white" : "text-black"}`}>{title}</h3>
                  <p className={`font-body text-sm leading-relaxed mb-4 ${dark ? "text-white/45" : "text-gray-500"}`}>{body}</p>
                  <span className={`inline-flex text-[10px] font-semibold px-2.5 py-1 border tracking-wide ${dark ? "border-white/15 text-white/40" : "border-black/10 text-black/40"}`}>{tag}</span>
                </motion.div>
              ))}
            </div>

            {/* ── Phase 3: JOB DAY & COMPLETION ── */}
            <motion.div {...fadeUpDelayed(0.6)} className="flex items-center gap-3 mb-4">
              <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/50 px-2.5 py-1 border border-white/10 bg-white/[0.06] flex-shrink-0">
                Step 8–10 &nbsp;·&nbsp; Job day & completion
              </span>
              <div className="flex-1 h-px bg-white/10" />
            </motion.div>

            <div className="grid grid-cols-3 gap-px bg-white/8">
              {([
                {
                  n: "08", icon: CheckCircle2,
                  title: "Booking Confirmed",
                  body: "Once deposit clears, your booking is locked. You receive a confirmation email with your appointment date, time window, and job reference number.",
                  tag: "Confirmed by email",
                },
                {
                  n: "09", icon: Users,
                  title: "Crew Arrives & Completes",
                  body: "Our experienced team shows up at your door on time with all tools and equipment. Just direct us — we handle everything from start to finish.",
                  tag: "Tools included",
                },
                {
                  n: "10", icon: Receipt,
                  title: "Final Payment — Pay via Stripe",
                  body: "After the job is complete, a final invoice is emailed with a secure Stripe payment link. Pay the remaining 50% online by card. Receipt issued instantly.",
                  tag: "Secure · Stripe · Balance due",
                },
              ] as const).map(({ n, icon: Icon, title, body, tag }, i) => (
                <motion.div key={n} {...fadeUpDelayed(0.62 + i * 0.07)} className="bg-black p-8 group hover:bg-neutral-900 transition-colors duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-heading font-bold text-[52px] leading-none text-white/[0.06] select-none group-hover:text-white/10 transition-colors">{n}</span>
                    <div className="w-9 h-9 border border-white/15 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-white/50" />
                    </div>
                  </div>
                  <h3 className="card-title text-white mb-2">{title}</h3>
                  <p className="font-body text-sm text-white/45 leading-relaxed mb-4">{body}</p>
                  <span className="inline-flex text-[10px] font-semibold px-2.5 py-1 border border-white/15 text-white/40 tracking-wide">{tag}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ══════════ MOBILE LAYOUT ══════════ */}
          <div className="lg:hidden">
            <div className="relative pl-12">
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-black/10" />

              {([
                { n: "01", icon: ListChecks,   title: "Choose Your Service",          body: "Installation, dismantling, or relocation — home, office, commercial.",                                                                    tag: "Service type",                    dark: false },
                { n: "02", icon: MapPin,        title: "Enter Your Location",          body: "All Singapore districts — HDB, condo, landed, office, commercial.",                                                                         tag: "Island-wide",                     dark: false },
                { n: "03", icon: Package,       title: "Select Items",                 body: "450+ item catalog — beds, wardrobes, workstations, gym equipment, and more.",                                                               tag: "450+ catalog",                    dark: false },
                { n: "04", icon: CalendarDays,  title: "Choose Date & Time",           body: "Pick your preferred slot. Same-week availability most weeks.",                                                                              tag: "Same-week",                       dark: false },
                { n: "05", icon: FileText,      title: "Estimate Generated",           body: "Instant itemised quote — every item and fee listed clearly.",                                                                               tag: "Instant & itemised",              dark: false },
                { n: "06", icon: ScanSearch,    title: "Admin Review & Approval",      body: "Our team checks the scope and verifies everything before sending payment.",                                                                 tag: "Team verified",                   dark: false },
                { n: "07", icon: Mail,          title: "Deposit Invoice via Email",    body: "Email with a secure Stripe payment link. Pay 50% online by card — slot held 48 hrs.",                                                      tag: "Stripe · 50% deposit",            dark: true  },
                { n: "08", icon: CheckCircle2,  title: "Booking Confirmed",            body: "Deposit cleared — booking locked. Confirmation email with date, time, and job reference.",                                                  tag: "Confirmed by email",              dark: true  },
                { n: "09", icon: Users,         title: "Crew Arrives & Completes",     body: "Team arrives on time with all tools. We handle everything — you just direct us.",                                                           tag: "Tools included",                  dark: true  },
                { n: "10", icon: Receipt,       title: "Final Payment via Email",      body: "Job done — final invoice emailed with a Stripe link. Pay the remaining 50% online. Receipt issued instantly.",                              tag: "Stripe · Balance due",            dark: true  },
              ] as const).map(({ n, icon: Icon, title, body, tag, dark }, i) => (
                <motion.div key={n} {...fadeUpDelayed(i * 0.05)} className="relative flex gap-0 mb-5 last:mb-0">
                  <div className={`absolute -left-12 top-0 w-9 h-9 border flex items-center justify-center flex-shrink-0 z-10 ${dark ? "bg-black border-black/25" : "bg-white border-black/12"}`}>
                    <Icon className={`w-3.5 h-3.5 ${dark ? "text-white/55" : "text-black/40"}`} />
                  </div>
                  <div className={`flex-1 p-4 border ${dark ? "bg-black border-black/20" : "bg-white border-black/8"}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${dark ? "text-white/20" : "text-black/20"}`} style={{ letterSpacing: "0.2em" }}>Step {n}</p>
                    <h3 className={`card-title mb-1.5 ${dark ? "text-white" : "text-black"}`}>{title}</h3>
                    <p className={`font-body text-xs leading-relaxed mb-2.5 ${dark ? "text-white/40" : "text-gray-500"}`}>{body}</p>
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 border tracking-wide ${dark ? "border-white/12 text-white/35" : "border-black/10 text-black/35"}`}>{tag}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── CTA ── */}
          <motion.div {...fadeUpDelayed(0.8)} className="mt-14 pt-10 border-t border-black/8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-black mb-1">Ready to begin?</p>
              <p className="text-xs text-gray-400 font-body">Use the online wizard or WhatsApp us — both generate your full estimate in under 60 seconds.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "booking_flow_estimate")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-black text-xs uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors"
              >
                Get Estimate <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("cta_click", "/", "booking_flow_whatsapp")}
                className="inline-flex items-center gap-2 px-6 py-3 border border-black/20 text-black font-black text-xs uppercase tracking-[0.12em] hover:border-black/50 hover:bg-gray-50 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════ WHY TMG INSTALL ═══════════════════ */}
      <section className="bg-black px-4 sm:px-6 lg:px-8 py-28">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-16">
            <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
              Why Choose Us
            </p>
            <h2 className="section-title text-white">Built for every job.</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/8">
            {[
              {
                icon: Building2,
                title: "Office & Commercial",
                body: "Workstations, sit-stand desks, partitions, ergonomic chairs, reception counters — full office fits and strip-outs.",
              },
              {
                icon: Home,
                title: "Home & Residential",
                body: "Beds, wardrobes, gym equipment, kitchen furniture, blinds, appliance relocation — all property types across Singapore.",
              },
              {
                icon: Truck,
                title: "End-to-End Relocation",
                body: "We dismantle, wrap, shift, and reinstall your furniture within the same unit, building, or across town.",
              },
              {
                icon: MessageCircle,
                title: "Direct Team Updates",
                body: "WhatsApp updates straight from your assigned crew. No call centres, no chasing — just real communication.",
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                {...fadeUpDelayed(i * 0.08)}
                className="bg-black p-8 border border-white/8 hover:border-white/18 transition-colors duration-300 group"
              >
                <div className="w-8 h-8 border border-white/15 flex items-center justify-center mb-7 group-hover:border-white/30 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-white/50" />
                </div>
                <h3 className="card-title text-white mb-3">{title}</h3>
                <p className="font-body text-sm text-white/40 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ SOCIAL PROOF ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-12">
            <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
              Customer Reviews
            </p>
            <h2 className="section-title text-black">What clients say.</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-px bg-black/8">
            {REVIEWS.map(({ name, loc, stars, text }, i) => (
              <motion.div
                key={name}
                {...fadeUpDelayed(i * 0.1)}
                className="bg-white p-8"
              >
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: stars }).map((_, s) => (
                    <Star key={s} className="w-3.5 h-3.5 fill-black text-black" />
                  ))}
                </div>
                <p className="font-body text-sm text-gray-600 leading-relaxed mb-6">"{text}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-black/8 flex items-center justify-center text-[11px] font-bold text-black/60">
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-black leading-none">{name}</p>
                    <p className="text-[11px] text-black/35 mt-0.5">{loc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ CONFIDENCE STATS ═════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-px bg-black/8">
            {[
              {
                stat: "450+",
                label: "Item Catalog",
                body: "Beds, wardrobes, sofas, office furniture, gym equipment, kitchen pieces, blinds, appliances — all priced upfront.",
              },
              {
                stat: "SG-Wide",
                label: "Island Coverage",
                body: "All 28 districts — HDB, condo, landed, shophouse, commercial, and industrial premises.",
              },
              {
                stat: "60s",
                label: "Instant Quote",
                body: "Select your items and get a full, itemised quote with transport in under a minute — no calls, no waiting.",
              },
            ].map(({ stat, label, body }, i) => (
              <motion.div
                key={label}
                {...fadeUpDelayed(i * 0.1)}
                className="bg-white p-10"
              >
                <div className="font-heading font-bold text-[64px] leading-none text-black/[0.07] mb-4 select-none">{stat}</div>
                <h3 className="card-title text-black mb-2">{label}</h3>
                <p className="font-body text-sm text-gray-500 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════ FAQ ═══════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-[1fr_2fr] gap-16">
            <motion.div {...fadeUpDelayed(0)}>
              <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
                FAQ
              </p>
              <h2 className="section-title text-black mb-4">Common questions.</h2>
              <p className="font-body text-sm text-gray-500 leading-relaxed">
                Can't find your answer? WhatsApp us — we reply fast.
              </p>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-black border-b border-black/30 pb-0.5 hover:border-black transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Ask via WhatsApp
              </a>
            </motion.div>

            <motion.div {...fadeUpDelayed(0.1)} className="border-t border-black/8">
              {FAQS.map((faq) => (
                <FAQItem key={faq.q} {...faq} />
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═════════════════════ BOTTOM CTA BAND ═════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-28">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="max-w-2xl">
            <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-4" style={{ letterSpacing: "0.2em" }}>
              Ready to start?
            </p>
            <h2 className="section-title text-black mb-6">
              Get your quote<br />in under 60 seconds.
            </h2>
            <p className="font-body text-base text-gray-500 mb-10 max-w-md leading-relaxed">
              No account needed. No phone calls. Select your items, confirm your address, and receive a full itemised quote with transport included.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/estimate"
                data-testid="bottom-cta-estimate"
                onClick={() => trackEvent("cta_click", "/", "bottom_get_estimate")}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white font-black text-xs uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors"
              >
                GET ESTIMATE <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="bottom-cta-whatsapp"
                onClick={() => trackEvent("cta_click", "/", "bottom_whatsapp")}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border border-black/20 text-black font-black text-xs uppercase tracking-[0.12em] hover:border-black/50 hover:bg-gray-50 transition-all"
              >
                <MessageCircle className="w-4 h-4" /> WHATSAPP US
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════ FOOTER ═══════════════════════════ */}
      <footer className="bg-black text-white px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-14">
            <div className="md:col-span-2">
              <h3 className="brand-title text-white mb-4">TMG INSTALL</h3>
              <p className="font-body text-white/35 text-sm leading-relaxed max-w-xs">
                Professional furniture installation, dismantling, and relocation across all of Singapore —
                HDB, condo, landed, office, and commercial. Transparent pricing, no hidden fees.
              </p>
              <p className="font-body text-white/20 text-xs mt-3">
                The Moving Guy Pte Ltd · UEN: 202424156H
              </p>
              <div className="flex gap-3 mt-6">
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-white/15 text-white/60 text-xs font-medium hover:border-white/35 hover:text-white transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <Link
                  href="/estimate"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors"
                >
                  Get Estimate
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-body font-semibold text-white/60 text-[10px] tracking-widest uppercase mb-5" style={{ letterSpacing: "0.18em" }}>
                Contact
              </h4>
              <div className="space-y-3">
                <p className="font-body text-sm">
                  <span className="text-white/35">WhatsApp</span><br />
                  <a href={WHATSAPP} className="text-white hover:text-white/70 transition-colors">+65 8088 0757</a>
                </p>
                <p className="font-body text-sm">
                  <span className="text-white/35">Email</span><br />
                  <a href="mailto:sales@tmginstall.com" className="text-white hover:text-white/70 transition-colors">sales@tmginstall.com</a>
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-body font-semibold text-white/60 text-[10px] tracking-widest uppercase mb-5" style={{ letterSpacing: "0.18em" }}>
                Legal
              </h4>
              <div className="space-y-3">
                <p><Link href="/privacy" className="font-body text-sm text-white/50 hover:text-white transition-colors">Privacy Policy</Link></p>
                <p><Link href="/terms" className="font-body text-sm text-white/50 hover:text-white transition-colors">Terms of Service</Link></p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/8 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="font-body text-white/20 text-xs">
              © {new Date().getFullYear()} The Moving Guy Pte Ltd · UEN: 202424156H · Singapore
            </p>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-white/15 text-white/15" />
              ))}
              <span className="text-white/20 text-xs ml-2 font-body">Rated 5.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
