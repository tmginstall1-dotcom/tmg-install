import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { ArrowRight, Phone, MessageCircle } from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";
import tmgLogo from "@assets/generated_images/tmg_icon_1024.png";
import photoWardrobeWood from "@assets/01a8aed4-9419-48c0-8d66-5586d2d67599_1774688688302.jpeg";
import photoWardrobeWhite from "@assets/62426ebb-051a-4898-809d-94840e3259db_1774688688302.jpeg";
import photoBedroomChair from "@assets/76026a64-d9a1-4b57-9482-557bbaf4addd_1777034083394.jpeg";
import photoOfficeFitout from "@assets/36116e50-6291-442a-86cb-0ddc9540b6bc_1774689529777.jpeg";
import photoConference from "@assets/6219e4af-4150-47a9-8625-09448ff10459_1774689529777.jpeg";
import photoFloor from "@assets/4686003C-E52D-4EB5-800C-7EEE918170F1_1773287156949.jpeg";

/* ────────────────────────────────────────────────────────────────────────────
   TMG Install — premium editorial homepage.
   An original, mobile-first, conversion-focused landing page for furniture
   installation, dismantling, relocation and B2B furniture support in
   Singapore. Bold black/white blocks, oversized typography, restrained
   accent colour. NO 3D, NO heavy libraries — only framer-motion which is
   already in the project.

   Strict scope: this file replaces only the visual homepage. Routes,
   /estimate, /portal, WhatsApp links, analytics and the quote pipeline
   are untouched.
   ──────────────────────────────────────────────────────────────────────── */

const ACCENT = "#1aff7e"; // lime accent — used sparingly
const WHATSAPP_URL = "https://wa.me/6580880757";
const WHATSAPP_DISPLAY = "+65 8088 0757";

/* ─── Reveal — small wrapper that fades + lifts content into view once.
       Honours prefers-reduced-motion so users on accessibility settings
       see no movement at all. ─── */
function Reveal({
  children,
  delay = 0,
  y = 24,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── PrimaryCTA — large, accessible call-to-action used in hero, B2B
       and the closing block. Tracks click to analytics. ─── */
function PrimaryCTA({
  href,
  children,
  testId,
  variant = "solid",
  external = false,
  ariaLabel,
  onClickEvent,
}: {
  href: string;
  children: React.ReactNode;
  testId?: string;
  variant?: "solid" | "outline" | "accent";
  external?: boolean;
  ariaLabel?: string;
  onClickEvent?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-4 text-[13px] sm:text-sm font-semibold tracking-[0.18em] uppercase whitespace-nowrap transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0";
  const styles: Record<string, string> = {
    solid: "bg-white text-black hover:bg-neutral-200",
    outline:
      "bg-transparent text-white border border-white/30 hover:border-white hover:bg-white hover:text-black",
    accent: "text-black hover:opacity-90",
  };
  const inlineStyle =
    variant === "accent" ? { background: ACCENT } : undefined;
  const onClick = () => {
    if (onClickEvent) trackEvent(onClickEvent, "home");
  };
  const inner = (
    <>
      {children}
      <ArrowRight className="w-4 h-4" aria-hidden="true" />
    </>
  );
  const cls = `${base} ${styles[variant]}`;
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        style={inlineStyle}
        aria-label={ariaLabel}
        data-testid={testId}
        onClick={onClick}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className={cls}
      style={inlineStyle}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={onClick}
    >
      {inner}
    </Link>
  );
}

/* ─── Floating WhatsApp button — visible on every section but never
       blocking content (small, bottom-right, respects mobile safe-area). ─── */
function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Message TMG Install on WhatsApp"
      data-testid="cta-whatsapp-float"
      onClick={() => trackEvent("cta_whatsapp_float_click", "home")}
      className="fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex items-center gap-2 px-4 py-3 rounded-full text-black font-semibold text-sm shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 transition-transform"
      style={{ background: ACCENT, paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <MessageCircle className="w-5 h-5" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp us</span>
    </a>
  );
}

/* ─── HEADER — sticky, black, slim. Brand mark + WhatsApp + Get a quote. ─── */
function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 bg-black text-white border-b transition-all duration-300 ${
        scrolled ? "border-white/10" : "border-transparent"
      }`}
      data-testid="site-header"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
          <img
            src={tmgLogo}
            alt="TMG Install"
            className="h-7 w-7 sm:h-8 sm:w-8 object-cover"
          />
          <span className="text-[13px] sm:text-sm font-semibold tracking-[0.22em] uppercase">
            TMG Install
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-[12px] tracking-[0.22em] uppercase">
          <a href="#services" className="hover:text-[color:var(--accent,#1aff7e)] transition-colors" data-testid="nav-services">Services</a>
          <a href="#process" className="hover:text-[color:var(--accent,#1aff7e)] transition-colors" data-testid="nav-process">Process</a>
          <a href="#b2b" className="hover:text-[color:var(--accent,#1aff7e)] transition-colors" data-testid="nav-b2b">B2B</a>
          <a href="#contact" className="hover:text-[color:var(--accent,#1aff7e)] transition-colors" data-testid="nav-contact">Contact</a>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-[12px] tracking-[0.18em] uppercase border border-white/30 hover:bg-white hover:text-black transition-colors"
            aria-label="Chat with TMG on WhatsApp"
            data-testid="header-whatsapp"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
          <Link
            href="/estimate"
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[12px] sm:text-[13px] font-semibold tracking-[0.18em] uppercase text-black"
            style={{ background: ACCENT }}
            data-testid="header-cta-quote"
            onClick={() => trackEvent("header_quote_click", "home")}
          >
            Get quote
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─── 1. HERO — oversized type, two CTAs, three trust micro-pills. ─── */
function Hero() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.4]);
  const reduce = useReducedMotion();

  return (
    <section
      ref={ref}
      className="relative bg-black text-white overflow-hidden pt-24 sm:pt-28 pb-20 sm:pb-32"
      data-testid="section-hero"
    >
      {/* Subtle grid backdrop — pure CSS, no images. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        {/* Eyebrow */}
        <Reveal>
          <div className="flex items-center gap-3 text-[11px] sm:text-[12px] tracking-[0.32em] uppercase text-white/60">
            <span style={{ background: ACCENT, width: 8, height: 8, display: "inline-block" }} />
            Singapore furniture specialists — since 2018
          </div>
        </Reveal>

        {/* Headline */}
        <motion.h1
          style={reduce ? undefined : { y, opacity }}
          className="mt-6 sm:mt-8 font-bold tracking-[-0.02em] leading-[0.92]"
        >
          {[
            "Furniture installation.",
            "Dismantling.",
            "Relocation.",
            <>
              Done <span style={{ color: ACCENT }}>properly</span>.
            </>,
          ].map((line, i) => (
            <Reveal key={i} delay={0.05 + i * 0.08}>
              <span
                className="block text-[12vw] sm:text-[8.5vw] lg:text-[6.6vw] xl:text-[100px]"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                {line}
              </span>
            </Reveal>
          ))}
        </motion.h1>

        {/* Subtext + CTAs in a 12-col layout on desktop */}
        <div className="mt-10 sm:mt-12 grid grid-cols-12 gap-6 sm:gap-8 items-end">
          <Reveal delay={0.4} className="col-span-12 lg:col-span-7">
            <p className="text-base sm:text-lg lg:text-xl text-white/75 max-w-2xl leading-relaxed">
              TMG Install helps homes, offices, landlords and businesses handle
              furniture assembly, dismantling, relocation and setup — with clear
              pricing and reliable workmanship.
            </p>
          </Reveal>

          <Reveal delay={0.5} className="col-span-12 lg:col-span-5">
            <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
              <PrimaryCTA
                href="/estimate"
                variant="accent"
                testId="hero-cta-quote"
                ariaLabel="Get an instant furniture installation quote"
                onClickEvent="hero_quote_click"
              >
                Get instant quote
              </PrimaryCTA>
              <PrimaryCTA
                href={WHATSAPP_URL}
                external
                variant="outline"
                testId="hero-cta-whatsapp"
                ariaLabel="Message TMG on WhatsApp"
                onClickEvent="hero_whatsapp_click"
              >
                WhatsApp us
              </PrimaryCTA>
            </div>
          </Reveal>
        </div>

        {/* Trust micro-row */}
        <Reveal delay={0.6}>
          <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 border-t border-white/10 pt-6">
            {[
              { k: "Singapore", v: "Island-wide service" },
              { k: "Fast response", v: "Usually within the hour, on WhatsApp" },
              { k: "Who we serve", v: "Residential · Office · B2B" },
            ].map((item) => (
              <div key={item.k} className="min-w-0">
                <div className="text-[10px] sm:text-[11px] tracking-[0.28em] uppercase text-white/50">
                  {item.k}
                </div>
                <div className="mt-1.5 text-sm sm:text-base text-white truncate sm:whitespace-normal">
                  {item.v}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── 2. MANIFESTO — short lines on white, generous spacing, scroll reveal. ─── */
function Manifesto() {
  const lines = [
    "Most furniture problems",
    "are not just about tools.",
    <>They are about <span style={{ color: ACCENT, background: "black", padding: "0 0.2em" }}>planning</span>.</>,
    "Protection.",
    "Timing.",
    "And getting the job done — without damage.",
  ];
  return (
    <section
      className="bg-white text-black border-y border-black/10 py-24 sm:py-36"
      data-testid="section-manifesto"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <div className="text-[11px] sm:text-[12px] tracking-[0.32em] uppercase text-black/55 mb-10 sm:mb-14">
            — Manifesto
          </div>
        </Reveal>
        <div className="space-y-2 sm:space-y-3">
          {lines.map((line, i) => (
            <Reveal key={i} delay={i * 0.08} y={32}>
              <h2
                className="text-[8vw] sm:text-[5.5vw] lg:text-[4.4vw] xl:text-[68px] font-bold tracking-[-0.02em] leading-[1.04]"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                {line}
              </h2>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.6}>
          <p className="mt-14 sm:mt-20 max-w-3xl text-lg sm:text-xl text-black/70 leading-relaxed">
            We built TMG Install for customers who want the work handled
            properly — from first quote, to careful execution, to a clean,
            finished job.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── 3. TRUST / PROBLEM — 4 reasons, simple grid. ─── */
function TrustGrid() {
  const items = [
    {
      title: "Clear, itemised quotes",
      body:
        "You see what every item costs before you confirm. No vague all-in numbers, no surprise add-ons on the day.",
    },
    {
      title: "Installation and dismantling",
      body:
        "Beds, wardrobes, office desks, modular cabinets — we install, and we dismantle properly when you need to move.",
    },
    {
      title: "Office and home setup",
      body:
        "From a single workstation to a full office reset, our team coordinates the layout and finish so you can use the space the next day.",
    },
    {
      title: "WhatsApp-first coordination",
      body:
        "Send photos, dimensions and addresses on WhatsApp. We reply quickly and stay reachable through the entire job.",
    },
  ];
  return (
    <section
      id="why"
      className="bg-neutral-50 text-black py-24 sm:py-32 border-b border-black/10"
      data-testid="section-trust"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-12 gap-6 sm:gap-10 items-end mb-14 sm:mb-20">
          <Reveal className="col-span-12 lg:col-span-7">
            <div className="text-[11px] sm:text-[12px] tracking-[0.32em] uppercase text-black/55 mb-4">
              — Why TMG
            </div>
            <h2
              className="text-[10vw] sm:text-[6vw] lg:text-[4.4vw] xl:text-[68px] font-bold tracking-[-0.02em] leading-[0.98]"
              style={{ fontFamily: "var(--font-heading, inherit)" }}
            >
              Built for real
              <br />
              furniture jobs.
            </h2>
          </Reveal>
          <Reveal delay={0.15} className="col-span-12 lg:col-span-5">
            <p className="text-base sm:text-lg text-black/65 leading-relaxed">
              Singapore homes and offices have tight lifts, narrow doorways, and
              tighter timelines. We plan for that — so the install actually
              finishes the day you booked it.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black/10 border border-black/10">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 0.08}>
              <div className="bg-white p-7 sm:p-10 h-full" data-testid={`trust-card-${i}`}>
                <div
                  className="text-[12px] tracking-[0.32em] uppercase text-black/45 mb-3"
                  style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
                >
                  0{i + 1}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                  {it.title}
                </h3>
                <p className="text-base text-black/65 leading-relaxed">
                  {it.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 4. SERVICE PILLARS — 5 numbered editorial blocks. ─── */
function ServicePillars() {
  const pillars = [
    {
      n: "One",
      title: "Furniture installation",
      body:
        "Assembly for beds, wardrobes, dining tables, chairs, cabinets, modular storage and office furniture — done with the right tools and the right care for your floors and walls.",
      photo: photoWardrobeWood,
      alt: "TMG technician installing a wood-finish wardrobe in a Singapore home",
    },
    {
      n: "Two",
      title: "Dismantling",
      body:
        "Safe dismantling for moving, disposal, renovation or storage. Hardware kept, panels protected, packed for transport so nothing arrives damaged.",
      photo: photoFloor,
      alt: "Carefully dismantled furniture panels stacked and protected",
    },
    {
      n: "Three",
      title: "Relocation support",
      body:
        "Van-based furniture relocation across Singapore with careful handling, protective wrapping, loading, unloading and re-setup at the destination.",
      photo: photoBedroomChair,
      alt: "TMG team relocating bedroom furniture including a massage chair",
    },
    {
      n: "Four",
      title: "Office setup",
      body:
        "Workstations, ergonomic chairs, meeting tables, pedestals and storage installed and aligned — so the team can sit down and work the next morning.",
      photo: photoOfficeFitout,
      alt: "Office workstation fit-out by TMG Install",
    },
    {
      n: "Five",
      title: "Repair & adjustment",
      body:
        "Tightening, alignment, hinge fixes, door re-hangs and basic furniture handyman work — the small jobs that stop a piece of furniture from feeling broken.",
      photo: photoConference,
      alt: "Conference table being assembled and aligned",
    },
  ];
  return (
    <section
      id="services"
      className="bg-black text-white py-24 sm:py-36"
      data-testid="section-services"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <div className="flex items-center justify-between flex-wrap gap-4 mb-14 sm:mb-20">
            <div>
              <div className="text-[11px] sm:text-[12px] tracking-[0.32em] uppercase text-white/55 mb-4">
                — 5 Core services
              </div>
              <h2
                className="text-[10vw] sm:text-[6vw] lg:text-[4.4vw] xl:text-[68px] font-bold tracking-[-0.02em] leading-[1]"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                What we handle.
              </h2>
            </div>
            <Link
              href="/estimate"
              className="hidden sm:inline-flex items-center gap-2 text-[12px] tracking-[0.22em] uppercase border-b border-white/40 hover:border-white pb-1"
              data-testid="services-cta-quote"
            >
              Get a quote for any of these
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </Reveal>

        <div className="divide-y divide-white/10 border-y border-white/10">
          {pillars.map((p, i) => (
            <Reveal key={p.n} delay={i * 0.05} y={40}>
              <article
                className="grid grid-cols-12 gap-4 sm:gap-8 items-center py-8 sm:py-12 group"
                data-testid={`pillar-${i + 1}`}
              >
                <div className="col-span-2 sm:col-span-1 text-[11px] sm:text-[13px] tracking-[0.32em] uppercase text-white/45">
                  {p.n}
                </div>
                <div className="col-span-10 sm:col-span-5">
                  <h3
                    className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.02em] leading-[1] transition-transform duration-300 ease-out group-hover:translate-x-2"
                    style={{ fontFamily: "var(--font-heading, inherit)" }}
                  >
                    {p.title}
                  </h3>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                    {p.body}
                  </p>
                </div>
                <div className="col-span-12 sm:col-span-2">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-900">
                    <img
                      src={p.photo}
                      alt={p.alt}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                    />
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 5. PROCESS — 4 horizontal steps (stack on mobile). ─── */
function Process() {
  const steps = [
    {
      n: "01",
      title: "Send job details",
      body: "Tell us what needs to be installed, dismantled, moved or repaired.",
    },
    {
      n: "02",
      title: "Upload photos",
      body: "Photos help us quote accurately and avoid surprise charges on the day.",
    },
    {
      n: "03",
      title: "Receive quote",
      body: "We send a clear, itemised estimate before any booking is confirmed.",
    },
    {
      n: "04",
      title: "Confirm & book",
      body: "Lock in your slot. Our team arrives prepared and finishes properly.",
    },
  ];
  return (
    <section
      id="process"
      className="bg-white text-black py-24 sm:py-32 border-b border-black/10"
      data-testid="section-process"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <div className="text-[11px] sm:text-[12px] tracking-[0.32em] uppercase text-black/55 mb-4">
            — How it works
          </div>
          <h2
            className="text-[10vw] sm:text-[6vw] lg:text-[4.4vw] xl:text-[68px] font-bold tracking-[-0.02em] leading-[1] mb-14 sm:mb-20"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            Quote to install,
            <br />
            in four steps.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-black/10 border border-black/10">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div
                className="bg-white p-7 sm:p-8 h-full flex flex-col"
                data-testid={`process-step-${i + 1}`}
              >
                <div
                  className="text-[12px] tracking-[0.32em] uppercase text-black/40 mb-6"
                  style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
                >
                  Step {s.n}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                  {s.title}
                </h3>
                <p className="text-base text-black/65 leading-relaxed">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row gap-3">
            <PrimaryCTA
              href="/estimate"
              variant="solid"
              testId="process-cta-quote"
              ariaLabel="Start your quote"
              onClickEvent="process_quote_click"
            >
              Start a quote
            </PrimaryCTA>
            <PrimaryCTA
              href={WHATSAPP_URL}
              external
              variant="outline"
              testId="process-cta-whatsapp"
              ariaLabel="WhatsApp TMG"
              onClickEvent="process_whatsapp_click"
            >
              Send photos on WhatsApp
            </PrimaryCTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── 6. WORK GALLERY — visual section with real install photos. ─── */
function WorkGallery() {
  const cells = [
    { src: photoWardrobeWhite, label: "Wardrobe install · Tanjong Pagar", span: "md:col-span-7 md:row-span-2 aspect-[4/3] md:aspect-auto" },
    { src: photoOfficeFitout, label: "Office fit-out · CBD", span: "md:col-span-5 aspect-[4/3]" },
    { src: photoBedroomChair, label: "Bedroom relocation · East Coast", span: "md:col-span-3 aspect-square" },
    { src: photoConference, label: "Conference table · One-North", span: "md:col-span-2 aspect-[3/4]" },
  ];
  return (
    <section
      className="bg-neutral-100 text-black py-24 sm:py-32 border-b border-black/10"
      data-testid="section-work"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <Reveal>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 sm:mb-16">
            <div>
              <div className="text-[11px] sm:text-[12px] tracking-[0.32em] uppercase text-black/55 mb-4">
                — On the job
              </div>
              <h2
                className="text-[10vw] sm:text-[6vw] lg:text-[4.4vw] xl:text-[68px] font-bold tracking-[-0.02em] leading-[1]"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                Real installs.
                <br />
                Real homes & offices.
              </h2>
            </div>
            <p className="text-base sm:text-lg text-black/60 max-w-md">
              A small selection of recent furniture jobs across Singapore —
              residential, office and B2B.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-12 md:auto-rows-[200px] gap-3 sm:gap-4">
          {cells.map((c, i) => (
            <Reveal key={i} delay={i * 0.05} className={c.span}>
              <figure className="relative w-full h-full overflow-hidden bg-neutral-200 group">
                <img
                  src={c.src}
                  alt={c.label}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                />
                <figcaption className="absolute left-0 bottom-0 m-3 px-2.5 py-1.5 text-[10px] sm:text-[11px] tracking-[0.22em] uppercase font-semibold bg-black text-white">
                  {c.label}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 7. B2B — dedicated section for offices, landlords, operators. ─── */
function B2BSection() {
  const verticals = [
    "Co-living operators",
    "Office relocations",
    "Landlord turn-overs",
    "Retail & F&B fit-outs",
    "Property managers",
    "Interior designers",
  ];
  return (
    <section
      id="b2b"
      className="relative bg-black text-white py-24 sm:py-36 overflow-hidden"
      data-testid="section-b2b"
    >
      {/* huge accent slash in the corner */}
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-20 w-[460px] h-[460px] hidden lg:block"
        style={{
          background: ACCENT,
          clipPath: "polygon(0 0, 100% 0, 100% 100%)",
          opacity: 0.18,
        }}
      />
      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-12 gap-6 sm:gap-10 items-start">
          <Reveal className="col-span-12 lg:col-span-7">
            <div className="text-[11px] sm:text-[12px] tracking-[0.32em] uppercase text-white/55 mb-4">
              — For business
            </div>
            <h2
              className="text-[9vw] sm:text-[5.5vw] lg:text-[4vw] xl:text-[60px] font-bold tracking-[-0.02em] leading-[1.02]"
              style={{ fontFamily: "var(--font-heading, inherit)" }}
            >
              Furniture support for
              <br />
              <span style={{ color: ACCENT }}>offices, landlords</span> and operators.
            </h2>
          </Reveal>

          <Reveal delay={0.15} className="col-span-12 lg:col-span-5">
            <p className="text-base sm:text-lg text-white/75 leading-relaxed">
              From a one-time office reset to recurring support across co-living
              units, rental flats and retail spaces — TMG Install helps teams
              cut downtime and coordinate furniture work without the back and
              forth.
            </p>
            <div className="mt-8">
              <PrimaryCTA
                href="/estimate?b2b=1"
                variant="accent"
                testId="b2b-cta"
                ariaLabel="Request a B2B furniture quote"
                onClickEvent="b2b_quote_click"
              >
                Request B2B quote
              </PrimaryCTA>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.25}>
          <ul className="mt-16 sm:mt-20 grid grid-cols-2 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
            {verticals.map((v) => (
              <li
                key={v}
                className="bg-black px-5 py-5 text-sm sm:text-base font-medium tracking-tight"
                data-testid={`b2b-vertical-${v.toLowerCase().replace(/\W+/g, "-")}`}
              >
                {v}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── 8. FINAL CTA ─── */
function FinalCTA() {
  return (
    <section
      id="contact"
      className="bg-white text-black py-28 sm:py-40 border-b border-black/10"
      data-testid="section-final-cta"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 text-center">
        <Reveal>
          <div className="text-[11px] sm:text-[12px] tracking-[0.32em] uppercase text-black/55 mb-6">
            — Ready when you are
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <h2
            className="text-[12vw] sm:text-[7vw] lg:text-[5.4vw] xl:text-[88px] font-bold tracking-[-0.02em] leading-[0.98] max-w-[15ch] mx-auto"
            style={{ fontFamily: "var(--font-heading, inherit)" }}
          >
            Need furniture work
            <br />
            done <span style={{ color: ACCENT, background: "black", padding: "0 0.18em" }}>properly</span>?
          </h2>
        </Reveal>
        <Reveal delay={0.18}>
          <p className="mt-8 mx-auto max-w-2xl text-base sm:text-lg text-black/70 leading-relaxed">
            Send your item list, photos and address. We'll quote clearly before
            any booking is confirmed — no surprise charges on the day.
          </p>
        </Reveal>
        <Reveal delay={0.28}>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <PrimaryCTA
              href="/estimate"
              variant="accent"
              testId="final-cta-quote"
              ariaLabel="Get an instant quote"
              onClickEvent="final_quote_click"
            >
              Get instant quote
            </PrimaryCTA>
            <PrimaryCTA
              href={WHATSAPP_URL}
              external
              variant="solid"
              testId="final-cta-whatsapp"
              ariaLabel="WhatsApp TMG Install"
              onClickEvent="final_whatsapp_click"
            >
              WhatsApp {WHATSAPP_DISPLAY}
            </PrimaryCTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── 9. FOOTER ─── */
function SiteFooter() {
  return (
    <footer
      className="bg-black text-white py-16 sm:py-20"
      data-testid="site-footer"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-12 gap-8 sm:gap-12">
          <div className="col-span-12 md:col-span-5">
            <div className="flex items-center gap-3 mb-4">
              <img src={tmgLogo} alt="TMG Install" className="h-10 w-10 object-cover" />
              <div>
                <div className="text-base font-semibold tracking-[0.18em] uppercase">TMG Install</div>
                <div className="text-[12px] text-white/55">The Moving Guy Pte Ltd · Singapore</div>
              </div>
            </div>
            <p className="text-sm text-white/65 max-w-md leading-relaxed">
              Furniture installation, dismantling, relocation, office setup and
              handyman support across Singapore. Clear quotes, careful work,
              reliable scheduling.
            </p>
          </div>

          <div className="col-span-6 md:col-span-3">
            <div className="text-[11px] tracking-[0.28em] uppercase text-white/45 mb-4">Services</div>
            <ul className="space-y-2 text-sm">
              <li><a href="#services" className="hover:text-[color:var(--accent,#1aff7e)]">Furniture installation</a></li>
              <li><a href="#services" className="hover:text-[color:var(--accent,#1aff7e)]">Dismantling</a></li>
              <li><a href="#services" className="hover:text-[color:var(--accent,#1aff7e)]">Relocation</a></li>
              <li><a href="#services" className="hover:text-[color:var(--accent,#1aff7e)]">Office setup</a></li>
              <li><a href="#services" className="hover:text-[color:var(--accent,#1aff7e)]">Repair & adjustment</a></li>
            </ul>
          </div>

          <div className="col-span-6 md:col-span-4">
            <div className="text-[11px] tracking-[0.28em] uppercase text-white/45 mb-4">Contact</div>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-[color:var(--accent,#1aff7e)]"
                  data-testid="footer-whatsapp"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp · {WHATSAPP_DISPLAY}
                </a>
              </li>
              <li>
                <a
                  href={`tel:+6580880757`}
                  className="inline-flex items-center gap-2 hover:text-[color:var(--accent,#1aff7e)]"
                  data-testid="footer-phone"
                >
                  <Phone className="w-4 h-4" />
                  Call {WHATSAPP_DISPLAY}
                </a>
              </li>
              <li>
                <Link href="/estimate" className="underline-offset-4 hover:underline" data-testid="footer-quote">
                  Get an instant quote →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-[12px] text-white/45">
          <div>© {new Date().getFullYear()} The Moving Guy Pte Ltd · Singapore</div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── PAGE ROOT ─── */
export default function LandingHome() {
  usePageTracker("home");
  useSEO({
    title: "TMG Install | Furniture Installation, Dismantling & Relocation Singapore",
    description:
      "TMG Install provides furniture installation, dismantling, office setup, relocation support, and handyman services in Singapore. Get a fast quote online or via WhatsApp.",
  });

  return (
    <div
      className="bg-white text-black antialiased"
      data-testid="page-home"
    >
      <SiteHeader />
      <main className="pt-0">
        <Hero />
        <Manifesto />
        <TrustGrid />
        <ServicePillars />
        <Process />
        <WorkGallery />
        <B2BSection />
        <FinalCTA />
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </div>
  );
}
