import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, useVelocity, useAnimationFrame, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, ChevronRight, Play } from "lucide-react";

// --- Custom Hooks ---

function useCountUp(target: number, duration = 1.5) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRun) {
          setHasRun(true);
          let startTime: number;
          const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
            setCount(Math.floor(progress * target));
            if (progress < 1) {
              window.requestAnimationFrame(step);
            }
          };
          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, hasRun]);

  return { count, ref };
}

// --- Components ---

function MagneticButton({ children, className = "", href, testid }: { children: React.ReactNode; className?: string; href?: string; testid?: string }) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent<HTMLElement>) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current!.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.2, y: middleY * 0.2 });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  const Component = href ? motion.a : motion.button;

  return (
    <Component
      ref={ref as any}
      href={href}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className={`inline-block ${className}`}
      data-testid={testid}
    >
      {children}
    </Component>
  );
}

function AuroraBackground() {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#0A0A0A] pointer-events-none">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
          rotate: [0, 90, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vh] rounded-full bg-[radial-gradient(circle,rgba(217,143,39,0.15)_0%,rgba(0,0,0,0)_70%)] blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.1, 0.15, 0.1],
          rotate: [0, -90, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vh] rounded-full bg-[radial-gradient(circle,rgba(150,150,150,0.1)_0%,rgba(0,0,0,0)_70%)] blur-3xl"
      />
    </div>
  );
}

function Marquee({ velocity = 0 }) {
  const baseX = useRef(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 400
  });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], {
    clamp: false
  });

  const [x, setX] = useState(0);

  const directionFactor = useRef<number>(1);
  useAnimationFrame((t, delta) => {
    let moveBy = directionFactor.current * -1 * (delta / 1000) * 50;
    if (velocityFactor.get() < 0) {
      directionFactor.current = -1;
    } else if (velocityFactor.get() > 0) {
      directionFactor.current = 1;
    }
    moveBy += directionFactor.current * moveBy * velocityFactor.get();
    baseX.current += moveBy;
    if (baseX.current <= -50) baseX.current = 0;
    if (baseX.current > 0) baseX.current = -50;
    setX(baseX.current);
  });

  const items = [
    "Wardrobe Installation",
    "Bed Frame Assembly",
    "Office Fit-Out",
    "Furniture Dismantling",
    "IKEA Assembly",
    "Gym Equipment",
    "Kitchen Cabinets",
    "Sofa Relocation",
  ];

  return (
    <div className="overflow-hidden whitespace-nowrap bg-[#111] py-6 border-y border-[#333] flex relative">
      <motion.div className="flex whitespace-nowrap gap-16 px-8 text-2xl font-serif text-[#D98F27]/80 tracking-wide" style={{ x: `${x}%` }}>
        {[...items, ...items, ...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-8">
            <span>{item}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#D98F27]/30" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function PricingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const y = useTransform(scrollYProgress, [0, 1], [100, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const items = [
    { name: "IKEA Hemnes 3-door wardrobe", price: "$120" },
    { name: "Queen bed frame", price: "$80" },
    { name: "2-seater sofa", price: "$60" },
    { name: "Roller blind (per window)", price: "$50" }
  ];

  return (
    <section ref={ref} className="py-32 px-6 lg:px-24 bg-[#0A0A0A] relative overflow-hidden text-white" id="pricing">
      <motion.img 
        style={{ y, opacity: useTransform(opacity, v => v * 0.3) }}
        src="/__mockup/images/hero/abstract-chrome.png" 
        alt="Abstract Chrome"
        className="absolute top-0 right-0 w-1/2 h-full object-cover mix-blend-screen pointer-events-none"
      />
      <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <motion.div style={{ opacity, y }} className="space-y-6">
            <h2 className="text-4xl md:text-6xl font-serif leading-tight">
              Transparent Pricing.<br />Zero Ambiguity.
            </h2>
            <p className="text-[#888] text-lg md:text-xl font-sans max-w-lg leading-relaxed">
              We operate on absolute transparency. 250+ catalog items with fixed prices. No hourly rates. No quotes that change at the door.
            </p>
            <div className="pt-8">
               <MagneticButton href="/estimate" className="bg-[#D98F27] text-black px-8 py-4 rounded-none font-medium uppercase tracking-widest text-sm hover:bg-[#e09d3b] transition-colors" testid="pricing-cta">
                 Get an Instant Quote
               </MagneticButton>
            </div>
          </motion.div>
        </div>
        
        <motion.div style={{ opacity, y: useTransform(scrollYProgress, [0, 1], [150, 0]) }} className="space-y-4">
          <div className="bg-[#111] border border-[#222] p-8 space-y-6">
            <div className="flex justify-between text-sm uppercase tracking-widest text-[#666] border-b border-[#333] pb-4">
              <span>Item</span>
              <span>Install Price</span>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex justify-between items-center group cursor-default">
                <span className="text-lg font-serif text-[#CCC] group-hover:text-white transition-colors">{item.name}</span>
                <span className="text-xl font-sans text-[#D98F27]">{item.price}</span>
              </div>
            ))}
            <div className="pt-6 border-t border-[#333] flex justify-between items-center text-sm">
              <span className="text-[#888]">+ $60 Mobilisation Fee per appt</span>
              <a href="/estimate" className="text-[#CCC] hover:text-white flex items-center gap-2 uppercase tracking-widest">Full Catalog <ChevronRight size={14} /></a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function StickyScrollStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  
  const imgScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const opacity1 = useTransform(scrollYProgress, [0, 0.2, 0.4], [1, 1, 0]);
  const opacity2 = useTransform(scrollYProgress, [0.3, 0.5, 0.7], [0, 1, 0]);
  const opacity3 = useTransform(scrollYProgress, [0.6, 0.8, 1], [0, 1, 1]);

  return (
    <section ref={containerRef} className="h-[300vh] relative bg-[#0A0A0A]">
      <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center">
        <motion.img 
          src="/__mockup/images/hero/install-moment.png" 
          alt="Installation Moment"
          style={{ scale: imgScale }}
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent w-1/2 md:w-2/3" />
        
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-24">
          <div className="max-w-xl">
            <motion.div style={{ opacity: opacity1 }} className="absolute top-1/2 -translate-y-1/2">
              <h2 className="text-4xl md:text-5xl font-serif text-white leading-tight mb-4">Precision down to the last bolt.</h2>
              <p className="text-[#888] text-lg">We approach every piece with the respect it deserves, from flatpacks to bespoke joinery.</p>
            </motion.div>
            
            <motion.div style={{ opacity: opacity2 }} className="absolute top-1/2 -translate-y-1/2">
              <h2 className="text-4xl md:text-5xl font-serif text-white leading-tight mb-4">The right tools.<br/>The right attitude.</h2>
              <p className="text-[#888] text-lg">Our crews arrive fully equipped, treating your space with immaculate care.</p>
            </motion.div>
            
            <motion.div style={{ opacity: opacity3 }} className="absolute top-1/2 -translate-y-1/2">
              <h2 className="text-4xl md:text-5xl font-serif text-white leading-tight mb-4">Dignity of a job<br/>done perfectly.</h2>
              <p className="text-[#888] text-lg">Once we start, everything settles. Nothing bounces, nothing wiggles.</p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ImageGrid() {
  const images = [
    { src: "/__mockup/images/work/office-fitout-1600.webp", alt: "Office Fit-out", aspect: "aspect-[16/9]" },
    { src: "/__mockup/images/work/wardrobe-oak-800.webp", alt: "Oak Wardrobe", aspect: "aspect-[3/4]" },
    { src: "/__mockup/images/work/bed-completed-1600.webp", alt: "Bed Assembly", aspect: "aspect-[4/3]" },
    { src: "/__mockup/images/work/conference-table-800.webp", alt: "Conference Table", aspect: "aspect-[16/9]" },
  ];

  return (
    <section className="py-32 px-6 lg:px-24 bg-[#0A0A0A]" id="portfolio">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-16">
          <h2 className="text-4xl md:text-5xl font-serif text-white">Selected Works</h2>
          <span className="text-[#888] uppercase tracking-widest text-sm">Portfolio</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
          {images.map((img, i) => (
            <motion.div 
              key={i}
              initial={{ clipPath: "inset(100% 0 0 0)" }}
              whileInView={{ clipPath: "inset(0% 0 0 0)" }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
              className={`relative overflow-hidden group ${img.aspect} ${i % 2 !== 0 ? 'md:mt-24' : ''}`}
            >
              <img src={img.src} alt={img.alt} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-700" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { label: "Catalog Items", value: 250, suffix: "+" },
    { label: "Districts Served", value: 28, suffix: "" },
    { label: "Days a Week", value: 7, suffix: "" },
  ];

  return (
    <section className="py-24 border-y border-[#222] bg-[#0A0A0A]">
      <div className="max-w-7xl mx-auto px-6 lg:px-24 grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left divide-y md:divide-y-0 md:divide-x divide-[#222]">
        {stats.map((stat, i) => {
          const { count, ref } = useCountUp(stat.value);
          return (
            <div key={i} className="pt-8 md:pt-0 md:pl-12 first:pl-0 first:pt-0">
              <h3 className="text-[#888] uppercase tracking-widest text-xs mb-4">{stat.label}</h3>
              <div className="text-6xl md:text-7xl font-serif text-[#D98F27] flex items-baseline justify-center md:justify-start">
                <span ref={ref}>{count}</span>
                <span className="text-4xl text-[#D98F27]/60 ml-1">{stat.suffix}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HorizontalScroll() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: targetRef });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);

  const catalog = [
    { title: "Beds & Frames", desc: "Queen, king, storage beds.", img: "/__mockup/images/work/bed-assembly-800.webp" },
    { title: "Wardrobes", desc: "PAX, Hemnes, custom builds.", img: "/__mockup/images/work/wardrobe-white-800.webp" },
    { title: "Office Workstations", desc: "Desks, chairs, partitions.", img: "/__mockup/images/work/office-fitout-800.webp" },
    { title: "Privacy Pods", desc: "Acoustic phone booths.", img: "/__mockup/images/work/phone-booth-install-800.webp" },
  ];

  return (
    <section ref={targetRef} className="h-[200vh] bg-[#0A0A0A] relative" id="services">
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden py-24">
        <div className="px-6 lg:px-24 mb-16">
          <h2 className="text-4xl md:text-5xl font-serif text-white">The Catalog</h2>
          <p className="text-[#888] mt-4 max-w-md">Browse our comprehensive fixed-price catalog covering residential and commercial assemblies.</p>
        </div>
        
        <motion.div style={{ x }} className="flex gap-8 px-6 lg:px-24">
          {catalog.map((item, i) => (
            <div key={i} className="w-[85vw] md:w-[40vw] flex-shrink-0 group">
              <div className="aspect-[4/3] overflow-hidden bg-[#111] mb-6">
                <img src={item.img} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
              </div>
              <h3 className="text-2xl font-serif text-white mb-2">{item.title}</h3>
              <p className="text-[#888] font-sans">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Timeline() {
  const steps = [
    { title: "Instant Quote", desc: "Select your items online and get an immediate fixed price. No waiting for callbacks." },
    { title: "Schedule", desc: "Choose a convenient date. We offer same-week availability and operate 7 days a week." },
    { title: "Execution", desc: "Our crew arrives with all necessary tools to assemble, dismantle, or relocate with precision." },
    { title: "Handover", desc: "We clear the packaging, inspect the work, and ensure everything is structurally sound." },
  ];

  return (
    <section className="py-32 px-6 lg:px-24 bg-[#0A0A0A]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-serif text-white text-center mb-24">The Process</h2>
        
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-[15px] top-0 bottom-0 w-[1px] bg-[#333]" />
          
          <div className="space-y-16">
            {steps.map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20%" }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
                className="relative pl-16"
              >
                <motion.div 
                  initial={{ backgroundColor: "#111", borderColor: "#333" }}
                  whileInView={{ backgroundColor: "#D98F27", borderColor: "#D98F27" }}
                  viewport={{ once: true, margin: "-20%" }}
                  transition={{ duration: 0.5, delay: i * 0.1 + 0.3 }}
                  className="absolute left-0 top-1 w-[31px] h-[31px] rounded-full border-2 bg-[#111] z-10 flex items-center justify-center"
                >
                  <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: "-20%" }}
                    transition={{ delay: i * 0.1 + 0.5 }}
                  >
                    <CheckCircle2 size={16} className="text-black" />
                  </motion.div>
                </motion.div>
                
                <h3 className="text-2xl font-serif text-white mb-3">{step.title}</h3>
                <p className="text-[#888] font-sans leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const TESTIMONIALS = [
  {
    name: "Darren L.",
    loc: "Tampines",
    job: "Wardrobe Installation",
    text: "Booked for wardrobe installation and they were done in under two hours. Very professional, no mess left behind. Price was exactly as quoted — will use again for my second unit.",
  },
  {
    name: "Mei Ling T.",
    loc: "Bishan",
    job: "IKEA PAX Assembly",
    text: "Got a quote via WhatsApp in minutes. Team arrived on time and assembled our IKEA PAX wardrobe perfectly. No hidden charges — completely transparent from start to finish.",
  },
  {
    name: "Ravi K.",
    loc: "Raffles Place",
    job: "20-Station Office Fit-Out",
    text: "Used TMG for a full office fit-out — 20 workstations, overhead cabinets, boardroom table. Efficient team, competitive pricing, and they cleaned up thoroughly afterwards.",
  },
];

function Testimonials() {
  return (
    <section className="py-32 px-6 lg:px-24 bg-[#0A0A0A] relative overflow-hidden" data-testid="section-testimonials">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        {/* Toolkit flatlay — the "craft" visual */}
        <motion.div
          initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
          whileInView={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 relative"
        >
          <div className="relative aspect-[3/4] overflow-hidden border border-[#1a1a1a]">
            <motion.img
              src="/__mockup/images/hero/toolkit-flatlay.png"
              alt="The TMG installer toolkit, arranged with precision"
              className="w-full h-full object-cover"
              initial={{ scale: 1.15 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-60" />
            <div className="absolute bottom-6 left-6 right-6">
              <p className="text-[10px] tracking-[0.25em] uppercase text-[#D98F27] mb-2">The Standard Kit</p>
              <p className="font-serif text-white text-2xl leading-tight italic">Every job. Every time.</p>
            </div>
          </div>
        </motion.div>

        {/* Quotes */}
        <div className="lg:col-span-7 lg:pl-8">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-[10px] tracking-[0.3em] uppercase text-[#D98F27] mb-6"
          >
            From the customers
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-4xl md:text-5xl text-white leading-[1.1] mb-16 max-w-xl"
          >
            What it sounds like <span className="italic text-white/70">when the job is done right.</span>
          </motion.h2>

          <div className="space-y-12">
            {TESTIMONIALS.map((t, i) => (
              <motion.figure
                key={t.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.9, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="border-t border-[#1a1a1a] pt-8"
                data-testid={`testimonial-${t.name.toLowerCase().replace(/[^a-z]/g,'-')}`}
              >
                <blockquote className="font-serif text-white text-xl md:text-2xl leading-relaxed mb-6">
                  &ldquo;{t.text}&rdquo;
                </blockquote>
                <figcaption className="flex items-baseline justify-between gap-6 flex-wrap">
                  <div>
                    <div className="text-white text-sm tracking-wide">{t.name}</div>
                    <div className="text-[#666] text-xs uppercase tracking-[0.2em] mt-1">{t.loc}</div>
                  </div>
                  <div className="text-[#D98F27] text-[10px] uppercase tracking-[0.25em]">{t.job}</div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CinematicHero() {
  const { scrollYProgress } = useScroll();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-[#D98F27] selection:text-black">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .font-sans { font-family: 'Inter', sans-serif; }
        .font-serif { font-family: 'Playfair Display', serif; }
      `}} />

      <AuroraBackground />

      {/* Scroll Progress */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-1 bg-[#D98F27] origin-left z-50"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 p-6 lg:px-12 flex justify-between items-center mix-blend-difference">
        <div className="font-serif text-2xl tracking-widest uppercase">TMG Install</div>
        <div className="hidden md:flex gap-8 text-xs tracking-widest uppercase text-[#CCC]">
          <a href="#services" className="hover:text-white transition-colors">Services</a>
          <a href="#portfolio" className="hover:text-white transition-colors">Portfolio</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <a href="https://wa.me/6580880757?text=Hi%2C+I%27d+like+a+furniture+installation+quote" className="text-xs uppercase tracking-widest border-b border-[#D98F27] text-[#D98F27] pb-1 hover:text-white hover:border-white transition-colors">
          WhatsApp Us
        </a>
      </nav>

      {/* Hero */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <motion.div 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-0"
        >
          <motion.img 
            style={{ y: useTransform(scrollYProgress, [0, 1], ["0%", "30%"]) }}
            src="/__mockup/images/hero/exploded-wardrobe.png" 
            alt="Exploded Wardrobe 3D Render"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0A0A]/40 to-[#0A0A0A]" />
        </motion.div>

        <div className="relative z-10 text-center px-6 mt-32 max-w-5xl mx-auto">
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-[#D98F27] uppercase tracking-[0.2em] text-sm mb-6 font-medium"
          >
            The Moving Guy Pte Ltd
          </motion.p>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-7xl lg:text-8xl font-serif leading-[1.1] tracking-tight mb-8"
          >
            Editorial luxury meets <br className="hidden md:block" />
            <span className="italic text-white/90">technical precision.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="text-[#888] max-w-2xl mx-auto text-lg md:text-xl font-light mb-12"
          >
            Singapore’s premier furniture installation, dismantling, and relocation crew. Transparent fixed pricing from a 250+ item catalog.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
          >
            <MagneticButton href="/estimate" className="bg-white text-black px-10 py-5 rounded-none font-medium uppercase tracking-widest text-sm hover:bg-[#D98F27] transition-colors" testid="hero-cta">
              Get a Quote
            </MagneticButton>
          </motion.div>
        </div>
      </section>

      <Marquee />
      <Stats />
      <StickyScrollStory />
      <HorizontalScroll />
      <PricingSection />
      <ImageGrid />
      <Timeline />
      <Testimonials />

      {/* Coverage Map Section */}
      <section className="py-32 relative overflow-hidden bg-[#0A0A0A]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 opacity-40 z-0"
        >
          <img src="/__mockup/images/hero/hdb-isometric.png" alt="HDB Isometric" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/50 to-transparent" />
        </motion.div>
        
        <div className="relative z-10 max-w-3xl mx-auto text-center px-6">
          <h2 className="text-4xl md:text-6xl font-serif mb-6">Serving all of Singapore.</h2>
          <p className="text-[#888] text-lg mb-12">All 28 districts. HDBs, Condominiums, Landed Properties, and Commercial Spaces. Same-week scheduling available.</p>
          <MagneticButton href="/estimate" className="border border-[#333] bg-black/50 backdrop-blur-sm text-white px-8 py-4 uppercase tracking-widest text-sm hover:border-[#D98F27] transition-colors" testid="coverage-cta">
            Check Availability
          </MagneticButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 px-6 lg:px-24 bg-[#050505] border-t border-[#111]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="font-serif text-3xl tracking-widest uppercase mb-6">TMG Install</div>
            <p className="text-[#666] max-w-sm mb-8">Professional furniture installation, dismantling, and relocation. Fixed prices, zero surprises.</p>
            <div className="flex gap-4">
              <img src="/__mockup/images/hero/precision-bolt.png" alt="Precision Bolt" className="w-12 h-12 object-cover rounded-full border border-[#333]" />
            </div>
          </div>
          <div>
            <h4 className="text-white uppercase tracking-widest text-sm mb-6">Services</h4>
            <ul className="space-y-4 text-[#888] text-sm">
              <li><a href="/services/wardrobe-installation-singapore" className="hover:text-[#D98F27] transition-colors">Wardrobe Installation</a></li>
              <li><a href="/services/ikea-assembly-singapore" className="hover:text-[#D98F27] transition-colors">IKEA Assembly</a></li>
              <li><a href="/services/office-fit-out-singapore" className="hover:text-[#D98F27] transition-colors">Office Fit-Out</a></li>
              <li><a href="/services/furniture-relocation-singapore" className="hover:text-[#D98F27] transition-colors">Furniture Relocation</a></li>
              <li><a href="/services/gym-equipment-assembly-singapore" className="hover:text-[#D98F27] transition-colors">Gym Equipment</a></li>
              <li><a href="/services/bed-frame-installation-singapore" className="hover:text-[#D98F27] transition-colors">Bed Frame Assembly</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white uppercase tracking-widest text-sm mb-6">Contact</h4>
            <ul className="space-y-4 text-[#888] text-sm">
              <li><a href="https://wa.me/6580880757?text=Hi%2C+I%27d+like+a+furniture+installation+quote" className="hover:text-[#D98F27] transition-colors">WhatsApp: +65 8088 0757</a></li>
              <li>7 Days a Week</li>
              <li>Including Public Holidays</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
