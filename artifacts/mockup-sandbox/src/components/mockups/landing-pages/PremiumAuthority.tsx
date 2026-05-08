import React, { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Star, Plus } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/6580880757?text=Hi%2C+I%27d+like+a+furniture+installation+quote";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } },
};

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1], delay } },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10%" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function ParallaxImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.img style={{ y, scale: 1.1 }} src={src} alt={alt} className="w-full h-full object-cover img-editorial origin-center" />
    </div>
  );
}

const faqs = [
  {
    q: "How does your pricing work?",
    a: "We operate on absolute transparency. Our catalog contains over 250 fixed-price items. You simply select your pieces, and the total is calculated instantly. Appointments require a $60 mobilisation fee, which covers our crew and transport. If you need both dismantling and reinstallation, we apply a 40% bundle discount to the combined cost."
  },
  {
    q: "Do you service my area?",
    a: "Yes. Our crews cover all 28 districts of Singapore, from HDB estates and private condominiums to landed properties and commercial offices."
  },
  {
    q: "How quickly can you schedule the work?",
    a: "We understand that timelines can be tight. We offer same-week scheduling and operate 7 days a week, including public holidays, to accommodate your needs."
  },
  {
    q: "Can you assist with office relocations?",
    a: "Certainly. We routinely manage full office fit-outs and strip-outs, assembling workstations, partitions, boardroom tables, and privacy pods with minimal disruption to your business."
  }
];

function Accordion({ items }: { items: { q: string, a: string }[] }) {
  return (
    <div className="border-t border-[#D1CCC0]">
      {items.map((item, i) => (
        <details key={i} className="group border-b border-[#D1CCC0] cursor-pointer">
          <summary className="flex justify-between items-center font-serif text-2xl py-8 list-none pr-4">
            <span>{item.q}</span>
            <span className="transition group-open:rotate-45">
              <Plus strokeWidth={1} size={24} />
            </span>
          </summary>
          <div className="text-[#555] font-light leading-relaxed pb-8 pr-12 text-lg">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}

export function PremiumAuthority() {
  return (
    <div className="premium-authority min-h-screen bg-[#F9F8F6] text-[#1A1A1A] selection:bg-[#2A2A2A] selection:text-[#F9F8F6] overflow-x-hidden font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap');
        .premium-authority {
          --font-serif: 'Cormorant Garamond', serif;
          --font-sans: 'Inter', sans-serif;
          scroll-behavior: smooth;
        }
        .font-serif { font-family: var(--font-serif); }
        .font-sans { font-family: var(--font-sans); }
        
        .img-editorial {
          filter: grayscale(15%) contrast(1.05);
          transition: filter 1.5s ease;
        }
        .img-editorial:hover {
          filter: grayscale(0%) contrast(1);
        }
        
        details > summary::-webkit-details-marker {
          display: none;
        }
      `}} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 py-6 px-8 md:px-16 flex justify-between items-center mix-blend-difference text-[#F9F8F6]">
        <div className="font-serif text-2xl tracking-wide uppercase font-medium">TMG Install</div>
        <div className="hidden md:flex gap-12 text-xs tracking-widest uppercase font-medium">
          <a href="#philosophy" className="hover:opacity-60 transition-opacity">Philosophy</a>
          <a href="#expertise" className="hover:opacity-60 transition-opacity">Expertise</a>
          <a href="#work" className="hover:opacity-60 transition-opacity">Portfolio</a>
          <a href="#pricing" className="hover:opacity-60 transition-opacity">The Catalog</a>
        </div>
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-xs tracking-widest uppercase border-b border-current pb-1 hover:opacity-60 transition-opacity font-medium">
          Enquire
        </a>
      </nav>

      {/* Hero */}
      <section className="relative h-[100svh] w-full flex flex-col justify-end pb-24 px-8 md:px-16 bg-[#1A1A1A]">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img 
            src="/__mockup/images/work/office-fitout-1600.webp" 
            alt="Completed office with rows of workstations" 
            className="w-full h-full object-cover img-editorial opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-transparent to-transparent opacity-90" />
        </div>
        
        <div className="relative z-10 max-w-5xl text-[#F9F8F6]">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-4 mb-8"
          >
            <span className="h-[1px] w-12 bg-white/50 block"></span>
            <span className="text-xs tracking-widest uppercase font-medium text-white/70">The Moving Guy Pte Ltd</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[1.05] mb-12 font-light"
          >
            The quiet precision of <br className="hidden md:block"/> master installers.
          </motion.h1>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.5, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-8 md:gap-16 text-sm font-light tracking-wide text-white/80"
          >
            <p className="max-w-[280px] leading-relaxed">Singapore's premier assembly and relocation atelier for residences and commercial spaces.</p>
            <p className="max-w-[280px] leading-relaxed">Fixed-price catalog of 250+ items. <br/>Zero ambiguity. Total transparency.</p>
          </motion.div>
        </div>
      </section>

      {/* Philosophy */}
      <section id="philosophy" className="py-40 px-8 md:px-16 max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-20 items-start">
        <FadeIn className="lg:w-1/3 sticky top-32">
          <span className="text-xs tracking-widest uppercase text-[#888] mb-8 block">01 — Philosophy</span>
          <h2 className="font-serif text-4xl md:text-5xl leading-tight">We believe in the dignity of a job done perfectly, once.</h2>
        </FadeIn>
        
        <div className="lg:w-2/3 flex flex-col gap-12 text-[#444] font-light leading-relaxed text-xl md:text-2xl">
          <FadeIn delay={0.2}>
            <p>
              You are tired of contractors who flake, quotes that change at the door, and the endless "we'll see when we get there." So are we.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <p>
              TMG Install operates on a simple, uncompromising premise: you pick what you have from our 250+ item catalog, you see the exact price, and we deliver immaculate execution. No hourly rates. No hidden charges.
            </p>
          </FadeIn>
          <FadeIn delay={0.4}>
            <p>
              Whether it's an intricate custom wardrobe in River Valley or a 50-workstation fit-out in Raffles Place, our crews arrive with the right tools, the right attitude, and a commitment to leaving your space pristine.
            </p>
          </FadeIn>
          
          <FadeIn delay={0.5} className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12 pt-12 border-t border-[#D1CCC0]">
            <div>
              <div className="font-serif text-4xl mb-2">250+</div>
              <div className="text-xs tracking-widest uppercase text-[#888]">Fixed-Price Items</div>
            </div>
            <div>
              <div className="font-serif text-4xl mb-2">28</div>
              <div className="text-xs tracking-widest uppercase text-[#888]">Districts Served</div>
            </div>
            <div>
              <div className="font-serif text-4xl mb-2">7</div>
              <div className="text-xs tracking-widest uppercase text-[#888]">Days a Week</div>
            </div>
            <div>
              <div className="font-serif text-4xl mb-2">100%</div>
              <div className="text-xs tracking-widest uppercase text-[#888]">Transparency</div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Expertise */}
      <section id="expertise" className="py-40 bg-[#1A1A1A] text-[#F9F8F6]">
        <div className="px-8 md:px-16 max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-20">
          <FadeIn className="lg:w-1/3">
            <span className="text-xs tracking-widest uppercase text-[#888] mb-8 block">02 — Expertise</span>
            <h2 className="font-serif text-4xl md:text-5xl mb-8">The capabilities of a complete atelier.</h2>
            <p className="text-white/60 text-lg font-light leading-relaxed max-w-sm mb-12">
              From flatpacks to bespoke joinery, we approach every piece with the respect it deserves.
            </p>
            <a href="/estimate" data-testid="cta-expertise-estimate" className="inline-flex items-center gap-4 text-xs tracking-widest uppercase border border-white/30 px-8 py-4 hover:bg-white hover:text-black transition-colors duration-500">
              Book an Appointment
            </a>
          </FadeIn>
          
          <div className="lg:w-2/3">
            <ul className="flex flex-col">
              {[
                { title: "Wardrobe installation & assembly", desc: "IKEA PAX, Hemnes, and custom wardrobes." },
                { title: "Bed frame assembly", desc: "Queen, king, storage beds, and IKEA systems." },
                { title: "Office fit-outs", desc: "Workstations, partitions, boardroom tables, and phone booths." },
                { title: "Furniture dismantling & disposal", desc: "Careful deconstruction and responsible removal." },
                { title: "Furniture & Sofa relocation", desc: "Carry-only or full dismantle + reinstall service." },
                { title: "Gym equipment assembly", desc: "Treadmills, multi-stations, and lifting racks." },
                { title: "Kitchen cabinetry installation", desc: "Precise alignment and secure mounting." },
                { title: "Blinds & curtain fitting", desc: "Perfectly level window treatments." }
              ].map((service, idx) => (
                <FadeIn key={idx} delay={idx * 0.05}>
                  <li className="py-6 border-b border-white/10 group">
                    <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                      <span className="font-serif text-2xl md:text-3xl text-white/90 group-hover:text-white transition-colors">{service.title}</span>
                      <span className="text-sm font-light text-white/40 md:text-right">{service.desc}</span>
                    </div>
                  </li>
                </FadeIn>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Selected Work */}
      <section id="work" className="py-40 bg-[#EBE8E1]">
        <div className="px-8 md:px-16 max-w-[1400px] mx-auto">
          <FadeIn>
            <div className="flex justify-between items-end mb-24 border-b border-[#D1CCC0] pb-8">
              <h2 className="font-serif text-4xl md:text-5xl">Selected Work</h2>
              <span className="text-xs tracking-widest uppercase text-[#888]">03 / Portfolio</span>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-x-24 md:gap-y-32">
            <FadeIn>
              <figure className="group cursor-pointer">
                <ParallaxImage src="/__mockup/images/work/wardrobe-oak-800.webp" alt="Finished oak wardrobe" className="aspect-[3/4] mb-8 bg-[#D1CCC0]" />
                <figcaption className="flex justify-between items-baseline">
                  <span className="font-serif text-3xl">Custom Oak Wardrobe</span>
                  <span className="text-xs tracking-widest uppercase text-[#888]">Installation</span>
                </figcaption>
              </figure>
            </FadeIn>

            <FadeIn delay={0.2}>
              <figure className="group cursor-pointer md:mt-40">
                <ParallaxImage src="/__mockup/images/work/conference-table-800.webp" alt="Installed conference table" className="aspect-[4/3] mb-8 bg-[#D1CCC0]" />
                <figcaption className="flex justify-between items-baseline">
                  <span className="font-serif text-3xl">Glass-Walled Boardroom</span>
                  <span className="text-xs tracking-widest uppercase text-[#888]">Office Fit-Out</span>
                </figcaption>
              </figure>
            </FadeIn>

            <FadeIn>
              <figure className="group cursor-pointer">
                <ParallaxImage src="/__mockup/images/work/bed-completed-1600.webp" alt="Finished bedroom" className="aspect-[16/9] mb-8 bg-[#D1CCC0]" />
                <figcaption className="flex justify-between items-baseline">
                  <span className="font-serif text-3xl">Master Bedroom Suite</span>
                  <span className="text-xs tracking-widest uppercase text-[#888]">Assembly</span>
                </figcaption>
              </figure>
            </FadeIn>
            
            <FadeIn delay={0.2}>
              <figure className="group cursor-pointer md:mt-24">
                <ParallaxImage src="/__mockup/images/work/phone-booth-completed-800.webp" alt="Finished phone booth" className="aspect-square mb-8 bg-[#D1CCC0]" />
                <figcaption className="flex justify-between items-baseline">
                  <span className="font-serif text-3xl">Privacy Pods</span>
                  <span className="text-xs tracking-widest uppercase text-[#888]">Commercial</span>
                </figcaption>
              </figure>
            </FadeIn>
            
            <FadeIn>
              <figure className="group cursor-pointer">
                <ParallaxImage src="/__mockup/images/work/shelving-assembly-800.webp" alt="Shelving assembly" className="aspect-[3/4] mb-8 bg-[#D1CCC0]" />
                <figcaption className="flex justify-between items-baseline">
                  <span className="font-serif text-3xl">Display Shelving</span>
                  <span className="text-xs tracking-widest uppercase text-[#888]">Assembly</span>
                </figcaption>
              </figure>
            </FadeIn>

            <FadeIn delay={0.2}>
              <figure className="group cursor-pointer md:mt-32">
                <ParallaxImage src="/__mockup/images/work/delivery-truck-800.webp" alt="TMG delivery truck" className="aspect-[4/3] mb-8 bg-[#D1CCC0]" />
                <figcaption className="flex justify-between items-baseline">
                  <span className="font-serif text-3xl">Logistics Fleet</span>
                  <span className="text-xs tracking-widest uppercase text-[#888]">Relocation</span>
                </figcaption>
              </figure>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Catalog & Pricing */}
      <section id="pricing" className="py-40 px-8 md:px-16 max-w-5xl mx-auto">
        <FadeIn>
          <div className="mb-24">
            <span className="text-xs tracking-widest uppercase text-[#888] mb-8 block text-center">04 — The Catalog</span>
            <h2 className="font-serif text-5xl md:text-6xl mb-8 text-center">Transparent Economics</h2>
            <p className="text-[#555] max-w-2xl mx-auto font-light text-center text-lg md:text-xl">
              Transparency is our ultimate status signal. We don't quote based on your postal code or the car in your driveway. We quote based on the work.
            </p>
          </div>
        </FadeIn>

        <div className="flex flex-col gap-4 mb-20">
          {[
            { name: "IKEA Hemnes 3-door wardrobe", install: 120, dismantle: 90 },
            { name: "Queen bed frame", install: 80, dismantle: 60 },
            { name: "2-seater sofa", install: 60, dismantle: 45 },
            { name: "Treadmill", install: 80, dismantle: 60 },
            { name: "Roller blind (per window)", install: 50, dismantle: null },
          ].map((item, idx) => (
            <FadeIn key={idx} delay={idx * 0.1}>
              <div className="flex flex-col sm:flex-row justify-between sm:items-end py-6 border-b border-[#D1CCC0] group hover:bg-[#EBE8E1] transition-colors px-6">
                <span className="font-serif text-2xl mb-4 sm:mb-0 text-[#1A1A1A]">{item.name}</span>
                <div className="flex gap-12 text-sm tracking-widest uppercase text-[#888]">
                  <div className="flex flex-col items-start sm:items-end">
                    <span className="text-[10px] mb-2">Install</span>
                    <span className="text-black font-medium text-lg">${item.install}</span>
                  </div>
                  {item.dismantle && (
                    <div className="flex flex-col items-start sm:items-end">
                      <span className="text-[10px] mb-2">Dismantle</span>
                      <span className="text-black font-medium text-lg">${item.dismantle}</span>
                    </div>
                  )}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
        
        <FadeIn delay={0.4} className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="bg-[#EBE8E1] p-8 text-center">
            <div className="font-serif text-3xl mb-4">$60</div>
            <div className="text-xs tracking-widest uppercase font-medium mb-2">Mobilisation Fee</div>
            <div className="text-sm font-light text-[#555]">Per appointment (covers crew + transport)</div>
          </div>
          <div className="bg-[#EBE8E1] p-8 text-center">
            <div className="font-serif text-3xl mb-4">From $58</div>
            <div className="text-xs tracking-widest uppercase font-medium mb-2">Relocation Transport</div>
            <div className="text-sm font-light text-[#555]">First 3 km, 1 helper included. No mobilisation fee.</div>
          </div>
          <div className="bg-[#EBE8E1] p-8 text-center">
            <div className="font-serif text-3xl mb-4">40% Off</div>
            <div className="text-xs tracking-widest uppercase font-medium mb-2">Bundle Discount</div>
            <div className="text-sm font-light text-[#555]">When you book dismantle + reinstall together.</div>
          </div>
        </FadeIn>

        <FadeIn delay={0.5} className="text-center">
          <a href="/estimate" data-testid="catalog-link" className="inline-flex items-center gap-4 text-xs tracking-widest uppercase border border-[#1A1A1A] px-10 py-5 hover:bg-[#1A1A1A] hover:text-white transition-colors duration-500">
            Search 250+ Items <ArrowRight size={16} strokeWidth={1} />
          </a>
        </FadeIn>
      </section>

      {/* Testimonials */}
      <section className="py-40 bg-[#1A1A1A] text-[#F9F8F6] px-8 md:px-16">
        <div className="max-w-[1400px] mx-auto">
          <FadeIn>
            <div className="flex justify-between items-end mb-24 border-b border-white/20 pb-8">
              <h2 className="font-serif text-4xl md:text-5xl">Clientele</h2>
              <span className="text-xs tracking-widest uppercase text-[#888]">05 / Endorsements</span>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-24">
            {[
              {
                text: "Used TMG for a full office fit-out — 20 workstations, overhead cabinets, boardroom table. Efficient team, competitive pricing, and they cleaned up thoroughly afterwards.",
                name: "Ravi K.",
                loc: "Raffles Place"
              },
              {
                text: "Booked for wardrobe installation and they were done in under two hours. Very professional, no mess left behind. Price was exactly as quoted.",
                name: "Darren L.",
                loc: "Tampines"
              },
              {
                text: "Got a quote via WhatsApp in minutes. Team arrived on time and assembled our IKEA PAX wardrobe perfectly. No hidden charges — completely transparent.",
                name: "Mei Ling T.",
                loc: "Bishan"
              }
            ].map((testimonial, idx) => (
              <FadeIn key={idx} delay={idx * 0.2}>
                <div className="flex flex-col h-full justify-between">
                  <p className="font-serif text-2xl md:text-3xl leading-relaxed font-light text-white/90 mb-12">
                    "{testimonial.text}"
                  </p>
                  <div>
                    <div className="flex gap-2 mb-6 text-[#C19A6B]">
                      {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" strokeWidth={0} />)}
                    </div>
                    <div className="text-xs tracking-widest uppercase">
                      <span className="font-medium text-white">{testimonial.name}</span>
                      <span className="text-[#666] mx-3">|</span>
                      <span className="text-[#888]">{testimonial.loc}</span>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-40 px-8 md:px-16 max-w-4xl mx-auto">
        <FadeIn>
          <div className="mb-20 text-center">
            <span className="text-xs tracking-widest uppercase text-[#888] mb-8 block">06 — Inquiry</span>
            <h2 className="font-serif text-5xl md:text-6xl">Frequently Asked</h2>
          </div>
        </FadeIn>
        <FadeIn delay={0.2}>
          <Accordion items={faqs} />
        </FadeIn>
      </section>

      {/* CTA Footer */}
      <footer className="py-40 px-8 md:px-16 bg-[#EBE8E1] text-center">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <span className="text-xs tracking-widest uppercase text-[#C19A6B] font-medium mb-8 block">Exclusive Offer</span>
            <h2 className="font-serif text-5xl md:text-7xl lg:text-8xl mb-10 leading-none">Ready for mastery?</h2>
            <p className="text-xl md:text-2xl text-[#555] font-light mb-16">
              Enter code <span className="font-serif italic text-black font-normal">TMG50</span> to receive $50 off your first installation or relocation with us.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <a href="/estimate" data-testid="cta-estimate" className="inline-flex justify-center items-center gap-4 text-xs tracking-widest uppercase bg-[#1A1A1A] text-white px-12 py-5 hover:bg-[#333] transition-colors duration-500">
                Get an Estimate
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" data-testid="cta-whatsapp" className="inline-flex justify-center items-center gap-4 text-xs tracking-widest uppercase border border-[#1A1A1A] px-12 py-5 hover:bg-[#1A1A1A] hover:text-white transition-colors duration-500">
                Book via WhatsApp
              </a>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.4}>
            <div className="mt-40 pt-10 border-t border-[#D1CCC0] flex flex-col md:flex-row justify-between items-center gap-6 text-xs tracking-widest uppercase text-[#888]">
              <span>© {new Date().getFullYear()} The Moving Guy Pte Ltd.</span>
              <div className="flex gap-8">
                <a href="#" className="hover:text-[#1A1A1A] transition-colors">Terms</a>
                <a href="#" className="hover:text-[#1A1A1A] transition-colors">Privacy</a>
                <a href="#" className="hover:text-[#1A1A1A] transition-colors">Instagram</a>
              </div>
            </div>
          </FadeIn>
        </div>
      </footer>
    </div>
  );
}
