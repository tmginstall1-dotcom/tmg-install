import React, { useState } from "react";
// wouter Link replaced with anchor for sandbox preview
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Clock,
  Star,
  Plus,
  Minus,
  Info,
  Shield,
  Truck,
  Package,
  Wrench,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP = "https://wa.me/6580880757?text=Hi%2C+I%27d+like+a+furniture+installation+quote";

const PRICING_SAMPLES = [
  { item: "IKEA Hemnes Wardrobe (3-door)", install: 120, dismantle: 90 },
  { item: "Queen Bed Frame", install: 80, dismantle: 60 },
  { item: "2-Seater Sofa", install: 60, dismantle: 45 },
  { item: "Corner / L-Shaped Study Desk", install: 80, dismantle: 60 },
  { item: "Treadmill", install: 80, dismantle: 60 },
  { item: "Kitchen Hutch / Pantry Cabinet", install: 80, dismantle: 60 },
  { item: "Roller Blind (per window)", install: 50, dismantle: 30 },
  { item: "L-Shaped Executive Desk", install: 100, dismantle: 80 },
];

const FAQS = [
  {
    q: "How is the price calculated?",
    a: "We use a fixed-price catalog of 250+ furniture items. Installation and dismantling jobs include a one-time $60 mobilisation & coordination fee per appointment (covers crew dispatch, transport & logistics), plus per-item labor from the catalog. Relocation jobs use transport pricing from $58 (first 3 km, 1 helper included) with no mobilisation fee. Relocating furniture with dismantle & reinstall gets a 40% bundle discount — you pay 60% of the combined install + dismantle price. Everything is itemised in your quote — no guesswork, no surprise charges.",
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
  {
    q: "Do you install IKEA furniture?",
    a: "Yes — IKEA assembly is one of our most common requests. Wardrobes, beds, PAX systems, KALLAX shelving, kitchen units, and more. Our team works from the instruction manual or from experience, whichever is faster.",
  },
  {
    q: "Do you work on weekends and public holidays?",
    a: "Yes. We operate 7 days a week including weekends and most public holidays. Availability depends on current bookings — just let us know your preferred date and we'll confirm.",
  },
  {
    q: "Can you dismantle and dispose of my old furniture?",
    a: "Yes. We offer dismantling combined with disposal — bulky furniture is brought down and removed from your premises. Just select 'Dismantle + Dispose' when building your estimate, or mention it when you WhatsApp us.",
  },
];

const TESTIMONIALS = [
  {
    name: "Darren L.",
    loc: "Tampines",
    stars: 5,
    date: "Feb 2026",
    text: "Booked for wardrobe installation and they were done in under two hours. Very professional, no mess left behind. Price was exactly as quoted — will use again for my second unit.",
  },
  {
    name: "Mei Ling T.",
    loc: "Bishan",
    stars: 5,
    date: "Jan 2026",
    text: "Got a quote via WhatsApp in minutes. Team arrived on time and assembled our IKEA PAX wardrobe perfectly. No hidden charges — completely transparent from start to finish.",
  },
  {
    name: "Ravi K.",
    loc: "Raffles Place",
    stars: 5,
    date: "Mar 2026",
    text: "Used TMG for a full office fit-out — 20 workstations, overhead cabinets, boardroom table. Efficient team, competitive pricing, and they cleaned up thoroughly afterwards.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between py-5 text-left focus:outline-none group"
        data-testid={`faq-${q.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <span className="text-[17px] font-medium text-slate-900 leading-snug pr-8 group-hover:text-blue-700 transition-colors">{q}</span>
        <span className="mt-1 flex-shrink-0 text-slate-400 group-hover:text-blue-700 transition-colors">
          {open ? <Minus size={20} /> : <Plus size={20} />}
        </span>
      </button>
      {open && (
        <div className="pb-6 pr-8 text-slate-600 text-base leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

export function ContentRich() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6pt..72pt,200..800;1,6pt..72pt,200..800&family=Inter:wght@400;500;600;700&display=swap');
        
        .font-serif {
          font-family: 'Newsreader', serif;
        }
        .font-sans {
          font-family: 'Inter', sans-serif;
        }
      `}} />

      {/* Top Notification Bar */}
      <div className="bg-blue-600 text-white px-6 py-2.5 text-center text-sm font-medium tracking-wide">
        Use code <strong className="bg-white/20 px-2 py-0.5 rounded ml-1 mr-1">TMG50</strong> for $50 off your first installation job.
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#F8F9FA]/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-serif text-2xl tracking-tight text-slate-900">
            <span className="font-bold">TMG</span> Install
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#services" className="hover:text-slate-900 transition-colors">Services</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#process" className="hover:text-slate-900 transition-colors">Process</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" className="hidden sm:inline-flex text-sm font-medium h-9 px-4 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 px-5 rounded font-medium shadow-sm" data-testid="nav-cta">
              <a href="/estimate">Get a Quote</a>
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20">
        
        {/* Hero Section */}
        <header className="grid lg:grid-cols-2 gap-16 items-center mb-24">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide uppercase mb-8 border border-blue-100">
              <Star size={12} className="fill-blue-700" /> 4.9/5 Average Rating
            </div>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[1.1] text-slate-900 mb-6 tracking-tight">
              Furniture installation, <br />
              <span className="italic text-slate-500">without the guesswork.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed">
              We are a Singapore-based crew specializing in furniture assembly, dismantling, and relocation. Fixed prices from a 250+ item catalog. No hidden fees.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button asChild size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded h-12 px-8 text-base font-medium shadow-sm" data-testid="hero-primary-cta">
                <a href="/estimate">Check Pricing & Get Quote</a>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base rounded font-medium border-slate-300 text-slate-700 hover:bg-slate-50" data-testid="hero-whatsapp-cta">
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={18} className="mr-2" />
                  Ask on WhatsApp
                </a>
              </Button>
            </div>
            
            <div className="mt-10 grid grid-cols-2 gap-4 border-t border-slate-200 pt-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><CheckCircle2 size={18} /></div>
                <div className="text-sm font-medium text-slate-900">Fixed Catalog Prices<br/><span className="text-slate-500 font-normal">No hourly rates</span></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><MapPin size={18} /></div>
                <div className="text-sm font-medium text-slate-900">Island-wide Coverage<br/><span className="text-slate-500 font-normal">All 28 districts</span></div>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="aspect-[4/3] rounded bg-slate-200 overflow-hidden shadow-sm">
              <img 
                src="/__mockup/images/work/wardrobe-install-team-800.webp" 
                alt="TMG Install team assembling a wardrobe"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 aspect-square w-48 rounded bg-slate-200 overflow-hidden shadow-lg border-4 border-[#F8F9FA] hidden md:block">
              <img 
                src="/__mockup/images/work/delivery-truck-800.webp" 
                alt="TMG Install truck"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </header>

        {/* The Problem / Solution (Wirecutter style) */}
        <section className="mb-32 max-w-4xl">
          <h2 className="font-serif text-3xl text-slate-900 mb-6">The problem with moving and installation in Singapore</h2>
          <div className="prose prose-slate prose-lg max-w-none text-slate-600">
            <p>If you've ever hired a contractor to assemble furniture or help you move, you know the drill. You send a photo, they reply with "depends on the job," and when they arrive, the price suddenly doubles. Or worse, they quote you an hourly rate and take their time.</p>
            <p><strong>We built TMG Install to fix this.</strong></p>
            <p>Instead of arbitrary quoting, we spent months calibrating the exact labor required for hundreds of common furniture pieces. We published a catalog. You pick what you need, and we give you a fixed price. That price doesn't change.</p>
          </div>
        </section>

        {/* Core Services */}
        <section id="services" className="mb-32">
          <div className="flex items-baseline justify-between mb-12 border-b border-slate-200 pb-4">
            <h2 className="font-serif text-4xl text-slate-900">Our Services</h2>
            <a href="/estimate" className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center">
              View all 250+ items <ArrowRight size={16} className="ml-1" />
            </a>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded border border-slate-200 shadow-sm">
              <Package className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-serif font-medium text-slate-900 mb-3">IKEA Flatpack Assembly</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">From PAX systems to Hemnes dressers. We clear the cardboard, build the units perfectly, and make sure every door aligns.</p>
              <a href="/services/ikea-assembly-singapore" className="text-sm font-medium text-blue-600 hover:underline">Learn more</a>
            </div>
            
            <div className="bg-white p-8 rounded border border-slate-200 shadow-sm">
              <Wrench className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-serif font-medium text-slate-900 mb-3">Wardrobe Installation</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">Heavy sliding doors, integrated lighting, and custom shelving. Whether it's bespoke or retail, we ensure structural integrity.</p>
              <a href="/services/wardrobe-installation-singapore" className="text-sm font-medium text-blue-600 hover:underline">Learn more</a>
            </div>

            <div className="bg-white p-8 rounded border border-slate-200 shadow-sm">
              <Shield className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-serif font-medium text-slate-900 mb-3">Office Fit-Outs</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">Workstations, boardroom tables, partitions, and privacy phone booths. We handle commercial setups with minimal downtime.</p>
              <a href="/services/office-fit-out-singapore" className="text-sm font-medium text-blue-600 hover:underline">Learn more</a>
            </div>

            <div className="bg-white p-8 rounded border border-slate-200 shadow-sm">
              <Truck className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-serif font-medium text-slate-900 mb-3">Furniture Relocation</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">Moving bulky items? We offer carry-only transport, or a full dismantle + reinstall service with a 40% bundle discount.</p>
              <a href="/services/furniture-relocation-singapore" className="text-sm font-medium text-blue-600 hover:underline">Learn more</a>
            </div>

            <div className="bg-white p-8 rounded border border-slate-200 shadow-sm">
              <Clock className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-serif font-medium text-slate-900 mb-3">Gym Equipment Assembly</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">Treadmills, multi-stations, and racks. Complex equipment assembled safely according to manufacturer specifications.</p>
              <a href="/services/gym-equipment-assembly-singapore" className="text-sm font-medium text-blue-600 hover:underline">Learn more</a>
            </div>

            <div className="bg-white p-8 rounded border border-slate-200 shadow-sm">
              <Star className="text-blue-600 mb-4" size={32} />
              <h3 className="text-xl font-serif font-medium text-slate-900 mb-3">Bed Frame Assembly</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">Queen, king, storage beds, and bunk beds. Sturdy assembly ensuring no squeaks or wobbly frames.</p>
              <a href="/services/bed-frame-installation-singapore" className="text-sm font-medium text-blue-600 hover:underline">Learn more</a>
            </div>
          </div>
        </section>

        {/* Pricing Transparency */}
        <section id="pricing" className="mb-32">
          <div className="bg-slate-900 text-white rounded-xl overflow-hidden shadow-xl">
            <div className="grid lg:grid-cols-[1fr_1.5fr]">
              <div className="p-10 lg:p-12 border-b lg:border-b-0 lg:border-r border-slate-800">
                <h2 className="font-serif text-3xl mb-4">Transparent Pricing</h2>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  We charge a flat $60 mobilisation fee per appointment (covers our crew and transport), plus a fixed labor rate per item. 
                </p>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-slate-200 mb-1">Mobilisation Fee</h4>
                    <p className="text-2xl font-serif">$60 <span className="text-sm font-sans text-slate-500 font-normal">flat rate</span></p>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200 mb-1">Bundle Discount</h4>
                    <p className="text-2xl font-serif">40% Off <span className="text-sm font-sans text-slate-500 font-normal">dismantle + reinstall</span></p>
                  </div>
                </div>
                <Button asChild className="w-full mt-10 bg-white text-slate-900 hover:bg-slate-100">
                  <a href="/estimate">Search Full Catalog</a>
                </Button>
              </div>
              
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800">
                      <th className="py-5 px-8 font-medium text-slate-400 w-1/2">Common Items</th>
                      <th className="py-5 px-8 font-medium text-slate-400">Install</th>
                      <th className="py-5 px-8 font-medium text-slate-400">Dismantle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {PRICING_SAMPLES.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-8 font-medium text-slate-300">{row.item}</td>
                        <td className="py-4 px-8 text-slate-400">${row.install}</td>
                        <td className="py-4 px-8 text-slate-400">${row.dismantle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Process Steps */}
        <section id="process" className="mb-32 max-w-4xl mx-auto">
          <h2 className="font-serif text-4xl text-slate-900 mb-12 text-center">How it works</h2>
          <div className="space-y-12 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200">
            
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-[#F8F9FA] bg-blue-600 text-white font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">1</div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-white p-6 rounded border border-slate-200 shadow-sm">
                <h3 className="font-medium text-lg text-slate-900 mb-2">Build your estimate</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Use our catalog to select exactly what you need installed, dismantled, or relocated. You'll see the exact price immediately.</p>
              </div>
            </div>
            
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-[#F8F9FA] bg-slate-200 text-slate-600 font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">2</div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-white p-6 rounded border border-slate-200 shadow-sm">
                <h3 className="font-medium text-lg text-slate-900 mb-2">Book via WhatsApp</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Submit your estimate to our WhatsApp. We'll confirm the details, finalize a date, and lock it in. Same-week scheduling is standard.</p>
              </div>
            </div>

            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-[#F8F9FA] bg-slate-200 text-slate-600 font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">3</div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-white p-6 rounded border border-slate-200 shadow-sm">
                <h3 className="font-medium text-lg text-slate-900 mb-2">We get it done</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Our crew arrives with all necessary tools. We build, install, and clean up the site. You pay the exact quoted price, securely via PayNow.</p>
              </div>
            </div>

          </div>
        </section>

        {/* Gallery / Recent Work */}
        <section className="mb-32">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="font-serif text-3xl text-slate-900">Recent Work</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <img src="/__mockup/images/work/office-fitout-800.webp" alt="Work" className="rounded aspect-square object-cover w-full shadow-sm" />
            <img src="/__mockup/images/work/bed-assembly-800.webp" alt="Work" className="rounded aspect-square object-cover w-full shadow-sm" />
            <img src="/__mockup/images/work/conference-table-800.webp" alt="Work" className="rounded aspect-square object-cover w-full shadow-sm" />
            <img src="/__mockup/images/work/phone-booth-completed-800.webp" alt="Work" className="rounded aspect-square object-cover w-full shadow-sm" />
          </div>
        </section>

        {/* Testimonials */}
        <section className="mb-32">
          <h2 className="font-serif text-3xl text-slate-900 mb-10 text-center">Don't just take our word for it</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, idx) => (
              <div key={idx} className="bg-white p-8 rounded border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 mb-4">
                    {[...Array(t.stars)].map((_, i) => <Star key={i} size={14} className="fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed italic mb-6">"{t.text}"</p>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.loc} • {t.date}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-32 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl text-slate-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-600">If you have a question that isn't answered here, reach out on WhatsApp.</p>
          </div>
          <div className="border-t border-slate-200 bg-white px-8 rounded shadow-sm">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-blue-600 text-white rounded-xl p-12 text-center shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-serif text-4xl mb-6">Ready to sort out your space?</h2>
            <p className="text-blue-100 mb-10 max-w-xl mx-auto text-lg">
              Get an instant itemised quote right now, or message us on WhatsApp for a quick chat.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="w-full sm:w-auto bg-white text-blue-900 hover:bg-slate-100 rounded h-12 px-8 text-base font-semibold shadow">
                <a href="/estimate">Build Your Estimate</a>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base rounded font-medium border-blue-400 text-white hover:bg-blue-700 hover:text-white transition-colors">
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={18} className="mr-2" />
                  WhatsApp Us
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white text-slate-500 py-12 mt-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-4 gap-8 text-sm">
          <div className="md:col-span-2">
            <div className="font-serif text-xl tracking-tight text-slate-900 mb-4 font-bold">TMG Install</div>
            <p className="max-w-sm mb-4 leading-relaxed">
              Singapore's transparent furniture installation, dismantling, and relocation service. 
            </p>
            <p className="text-xs">© {new Date().getFullYear()} The Moving Guy Pte Ltd. All rights reserved.</p>
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-4 uppercase tracking-wider text-xs">Services</h4>
            <ul className="space-y-3">
              <li><a href="/services/wardrobe-installation-singapore" className="hover:text-blue-600 transition-colors">Wardrobe Installation</a></li>
              <li><a href="/services/ikea-assembly-singapore" className="hover:text-blue-600 transition-colors">IKEA Assembly</a></li>
              <li><a href="/services/office-fit-out-singapore" className="hover:text-blue-600 transition-colors">Office Fit-Outs</a></li>
              <li><a href="/services/furniture-relocation-singapore" className="hover:text-blue-600 transition-colors">Furniture Relocation</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-slate-900 mb-4 uppercase tracking-wider text-xs">Company</h4>
            <ul className="space-y-3">
              <li><a href="/estimate" className="hover:text-blue-600 transition-colors">Get an Estimate</a></li>
              <li><a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Contact WhatsApp</a></li>
              <li><a href="#faq" className="hover:text-blue-600 transition-colors">FAQ</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
