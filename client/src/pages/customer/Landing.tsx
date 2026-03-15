import { Link } from "wouter";
import { motion } from "framer-motion";
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
} from "lucide-react";

const WHATSAPP = "https://wa.me/6580880757";

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

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-black pt-14">

      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
        {/* Subtle background texture */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] opacity-[0.03]"
            style={{ background: "radial-gradient(circle at top right, #000 0%, transparent 70%)" }} />
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── LEFT: Copy ── */}
            <motion.div {...fadeUp}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/15 bg-black/[0.03] mb-8">
                <Zap className="w-3.5 h-3.5 text-black" />
                <span className="text-xs font-semibold tracking-wide text-black uppercase" style={{ letterSpacing: "0.08em" }}>
                  Singapore's Furniture Installation Specialists
                </span>
              </div>

              {/* H1 */}
              <h1 className="hero-title text-black mb-6">
                Installation,<br />Dismantling &amp;<br />Relocation.
              </h1>

              {/* Body */}
              <p className="font-body text-base sm:text-lg text-gray-500 mb-10 leading-relaxed max-w-md">
                From a single wardrobe to a full office fit-out — TMG Install
                handles every job across Singapore with transparent, upfront pricing.
                Get your quote in under 60 seconds, no calls required.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-12">
                <Link
                  href="/estimate"
                  data-testid="hero-cta-guided"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white font-semibold text-sm tracking-wide hover:bg-black/85 transition-colors"
                  style={{ letterSpacing: "0.04em" }}
                >
                  GET ESTIMATE <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="hero-cta-whatsapp"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border border-black/20 text-black font-semibold text-sm tracking-wide hover:border-black/50 hover:bg-gray-50 transition-all"
                  style={{ letterSpacing: "0.04em" }}
                >
                  <MessageCircle className="w-4 h-4" /> WHATSAPP US
                </a>
              </div>

              {/* Trust row */}
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {[
                  { icon: Building2, label: "HDB / Condo / Office / Commercial" },
                  { icon: MapPin, label: "All Singapore Districts" },
                  { icon: Clock, label: "Flexible Same-Week Scheduling" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-4 h-4 rounded-full border border-black/20 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    </div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── RIGHT: Visual Quote Card ── */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              className="hidden lg:block"
            >
              <div className="relative">
                {/* Shadow card behind */}
                <div className="absolute inset-0 translate-x-3 translate-y-3 border border-black/8 bg-black/[0.02]" />

                {/* Main card */}
                <div className="relative bg-white border border-black/12 shadow-[0_8px_48px_rgba(0,0,0,0.08)]">
                  {/* Card header */}
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
                    {/* Service type */}
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

                    {/* Address */}
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

                    {/* Items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-black/35 font-semibold uppercase" style={{ letterSpacing: "0.12em" }}>Items <span className="text-black/25">— 3 selected</span></p>
                        <Package className="w-3.5 h-3.5 text-black/20" />
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { name: "3-Door Wardrobe", qty: 2, price: "$110" },
                          { name: "Queen Bed Frame", qty: 1, price: "$80" },
                          { name: "L-Shaped Desk", qty: 1, price: "$65" },
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

                    {/* Estimate breakdown */}
                    <div className="border border-black/8 p-4 space-y-2">
                      {[
                        { label: "Subtotal", val: "$255.00" },
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

                    {/* CTA row */}
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

      {/* ═══════════════════════ TRUST STRIP ═══════════════════════ */}
      <section className="border-t border-b border-black/8 bg-black/[0.018] px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x sm:divide-black/8">
            {[
              { icon: Shield, label: "Experienced Installers", sub: "Skilled & professional team" },
              { icon: Zap, label: "Upfront Pricing", sub: "No hidden costs, ever" },
              { icon: Clock, label: "Fast Scheduling", sub: "Same-week availability" },
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

      {/* ═══════════════════════ HOW IT WORKS ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-28">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-16">
            <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
              The Process
            </p>
            <h2 className="section-title text-black">How it works.</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-px bg-black/8">
            {[
              {
                n: "01",
                icon: Zap,
                title: "Select Service",
                body: "Choose installation, dismantling, relocation, or any combination — across home, office, or commercial spaces.",
              },
              {
                n: "02",
                icon: MapPin,
                title: "Tell Us Your Location",
                body: "Enter your Singapore address. We cover all districts — HDB, condo, landed, shophouse, and commercial premises.",
              },
              {
                n: "03",
                icon: Package,
                title: "Pick Items & Get Quote",
                body: "Browse our 450+ item catalog spanning beds, wardrobes, gym equipment, appliances, blinds, and more. Pricing is generated instantly.",
              },
            ].map(({ n, icon: Icon, title, body }, i) => (
              <motion.div
                key={n}
                {...fadeUpDelayed(i * 0.1)}
                className="bg-white p-10 group hover:bg-black/[0.018] transition-colors duration-300"
              >
                <div className="flex items-start justify-between mb-8">
                  <span className="font-heading font-bold text-[48px] leading-none text-black/8 select-none group-hover:text-black/12 transition-colors">
                    {n}
                  </span>
                  <div className="w-9 h-9 border border-black/12 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-black/50" />
                  </div>
                </div>
                <h3 className="card-title text-black mb-3">{title}</h3>
                <p className="font-body text-sm text-gray-500 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>

          {/* CTA under steps */}
          <motion.div {...fadeUpDelayed(0.3)} className="mt-10 flex justify-center">
            <Link
              href="/estimate"
              className="inline-flex items-center gap-2 text-sm font-semibold text-black border-b-2 border-black pb-0.5 hover:opacity-60 transition-opacity"
            >
              Start your estimate <ArrowRight className="w-4 h-4" />
            </Link>
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

      {/* ════════════════════ CONFIDENCE LAYER ═════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-10 md:gap-16">
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
              <motion.div key={label} {...fadeUpDelayed(i * 0.1)}>
                <div className="font-heading font-bold text-[52px] leading-none text-black/8 mb-3 select-none">{stat}</div>
                <h3 className="card-title text-black mb-2">{label}</h3>
                <p className="font-body text-sm text-gray-500 leading-relaxed">{body}</p>
              </motion.div>
            ))}
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
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white font-semibold text-sm hover:bg-black/85 transition-colors"
                style={{ letterSpacing: "0.04em" }}
              >
                GET ESTIMATE <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="bottom-cta-whatsapp"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border border-black/20 text-black font-semibold text-sm hover:border-black/50 hover:bg-gray-50 transition-all"
                style={{ letterSpacing: "0.04em" }}
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
            {/* Brand */}
            <div className="md:col-span-2">
              <h3 className="brand-title text-white mb-4">TMG INSTALL</h3>
              <p className="font-body text-white/35 text-sm leading-relaxed max-w-xs">
                Professional furniture installation, dismantling, and relocation across all of Singapore —
                HDB, condo, landed, office, and commercial. Transparent pricing, no hidden fees.
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

            {/* Contact */}
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

            {/* Legal */}
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

          <div className="border-t border-white/8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-body text-white/25 text-xs">© 2026 The Moving Guy Pte Ltd. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <p className="font-body text-white/25 text-xs">Singapore</p>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <p className="font-body text-white/25 text-xs">UEN: 202424156H</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
