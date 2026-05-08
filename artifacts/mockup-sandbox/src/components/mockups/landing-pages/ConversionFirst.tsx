import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  CheckCircle2, 
  MapPin, 
  Package, 
  Clock, 
  Shield, 
  Star, 
  Plus, 
  MessageCircle,
  Sofa,
  Monitor,
  Dumbbell,
  BedDouble,
  Wind,
  ChefHat,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SERVICES = [
  { icon: Package, label: "Wardrobe Installation" },
  { icon: BedDouble, label: "Bed Frame Assembly" },
  { icon: Package, label: "IKEA Flatpack Assembly" },
  { icon: Monitor, label: "Office Fit-Outs" },
  { icon: Plus, label: "Furniture Dismantling" },
  { icon: Sofa, label: "Furniture Relocation" },
  { icon: Dumbbell, label: "Gym Equipment" },
  { icon: ChefHat, label: "Kitchen Cabinetry" },
  { icon: Wind, label: "Blinds & Curtains" },
];

const PRICING = [
  { item: "IKEA Hemnes 3-door wardrobe", install: "$120", dismantle: "$90" },
  { item: "Queen bed frame", install: "$80", dismantle: "$60" },
  { item: "2-seater sofa", install: "$60", dismantle: "$45" },
  { item: "Treadmill", install: "$80", dismantle: "$60" },
  { item: "Roller blind (per window)", install: "$50", dismantle: "-" },
];

const FAQS = [
  {
    q: "How is the price calculated?",
    a: "We use a fixed-price catalog of 250+ furniture items. You pay a $60 one-time mobilisation fee per appointment, plus the per-item labor cost. No hidden charges."
  },
  {
    q: "How quickly can you schedule a job?",
    a: "We offer same-week scheduling and operate 7 days a week, including public holidays."
  },
  {
    q: "Do you offer bundle discounts?",
    a: "Yes! If you need dismantling and reinstallation for a relocation, you get a 40% bundle discount (pay 60% of the combined price)."
  },
  {
    q: "Do I need to provide tools?",
    a: "No, our professional team arrives fully equipped with all necessary tools and hardware."
  }
];

const TESTIMONIALS = [
  { name: "Darren L.", loc: "Tampines", text: "Booked for wardrobe installation and they were done in under two hours. Price was exactly as quoted." },
  { name: "Mei Ling T.", loc: "Bishan", text: "Got a quote via WhatsApp in minutes. Team arrived on time and assembled our IKEA PAX perfectly." },
  { name: "Ravi K.", loc: "Raffles Place", text: "Used TMG for a full office fit-out — 20 workstations. Efficient team, competitive pricing." }
];

export function ConversionFirst() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const WHATSAPP_LINK = "https://wa.me/6580880757?text=Hi%2C+I%27d+like+a+furniture+installation+quote";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-200">
      {/* Promo Bar */}
      <div className="bg-blue-600 text-white py-2 px-4 text-center text-sm font-medium tracking-wide">
        Use code <span className="font-bold bg-white/20 px-2 py-0.5 rounded ml-1">TMG50</span> for $50 off your first job.
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-2xl tracking-tight text-blue-950">TMG Install</div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
            <a href="#services" className="hover:text-blue-600 transition-colors">Services</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#reviews" className="hover:text-blue-600 transition-colors">Reviews</a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">FAQ</a>
          </nav>
          <div className="flex gap-3">
            <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              <MessageCircle className="w-4 h-4 text-green-500" />
              WhatsApp Us
            </a>
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold rounded-full px-5">
              <a href="/estimate" data-testid="nav-cta">Get a Quote</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section - Above the fold optimization */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold mb-6 border border-blue-100">
              <CheckCircle2 className="w-4 h-4" />
              Fixed prices. No hidden fees.
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-6 tracking-tight">
              Furniture installation with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">zero guesswork.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 mb-8 leading-relaxed">
              Singapore's transparent furniture assembly and relocation crew. Pick from 250+ items, see your price instantly, and book on WhatsApp.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full h-14 px-8 text-base font-bold shadow-lg shadow-blue-600/20 w-full sm:w-auto">
                <a href="/estimate" data-testid="hero-cta-primary">
                  Get a Quote Now
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full h-14 px-8 text-base font-bold border-slate-200 text-slate-700 hover:bg-slate-50 w-full sm:w-auto">
                <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" data-testid="hero-cta-whatsapp">
                  <MessageCircle className="mr-2 w-5 h-5 text-green-500" />
                  WhatsApp Us
                </a>
              </Button>
            </div>

            <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> All 28 Districts</div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> Same-Week Slots</div>
              <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-slate-400" /> Fully Insured</div>
            </div>
          </div>
          
          <div className="relative lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-slate-100">
            <img 
              src="/__mockup/images/work/wardrobe-install-team-800.webp" 
              alt="TMG Team installing wardrobe" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
            <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-white/20 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-6 h-6 text-blue-600 fill-current" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">"Exactly as quoted, done in 2 hours."</div>
                <div className="text-slate-500 text-xs mt-0.5">Darren L. • Wardrobe Installation</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Strip */}
      <section className="border-y border-slate-200 bg-slate-50 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-slate-200">
            <div>
              <div className="text-3xl font-extrabold text-blue-600 mb-1">250+</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fixed-Price Items</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-blue-600 mb-1">28</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Districts Served</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-blue-600 mb-1">7</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Days a Week</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <div className="text-3xl font-extrabold text-blue-600">5.0</div>
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Google Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works / Services Grid */}
      <section id="services" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">Everything we do.</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">From a single IKEA bed to a full office strip-out, we have a fixed price for it.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((service, i) => (
              <div key={i} className="flex items-start gap-4 p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <service.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">{service.label}</h3>
                  <a href="/estimate" className="text-sm text-blue-600 font-semibold hover:underline">Get price →</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section id="pricing" className="py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid lg:grid-cols-5 gap-12 items-start">
            <div className="lg:col-span-2">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6 tracking-tight">Real prices. <br/><span className="text-blue-400">No "depends".</span></h2>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                Contractors love to say "we'll see when we get there" so they can upcharge you. We don't do that. You pick the item, you see the price.
              </p>
              
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
                <div className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wide">Base Fees</div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="font-medium text-white">Mobilisation Fee</span>
                  <span className="font-bold text-blue-400">$60 / trip</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="font-medium text-white">Relocation Transport</span>
                  <span className="font-bold text-blue-400">from $58</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium text-white">Dismantle + Reinstall Combo</span>
                  <span className="font-bold text-green-400">40% OFF</span>
                </div>
              </div>

              <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-100 rounded-full h-14 px-8 text-base font-bold w-full sm:w-auto">
                <a href="/estimate" data-testid="pricing-cta">Search our 250+ item catalog</a>
              </Button>
            </div>
            
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden text-slate-900">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-3 text-right">Install</div>
                  <div className="col-span-3 text-right">Dismantle</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {PRICING.map((p, i) => (
                    <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                      <div className="col-span-6 font-medium text-sm sm:text-base">{p.item}</div>
                      <div className="col-span-3 text-right font-bold text-blue-600">{p.install}</div>
                      <div className="col-span-3 text-right font-bold text-slate-600">{p.dismantle}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                  <span className="text-sm text-slate-500 font-medium">Plus 245 more items in our catalog.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Testimonials */}
      <section id="reviews" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">Don't just take our word for it.</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-5 h-5 text-yellow-400 fill-current" />)}
                </div>
                <p className="text-slate-700 italic mb-6 leading-relaxed">"{t.text}"</p>
                <div>
                  <div className="font-bold text-slate-900">{t.name}</div>
                  <div className="text-sm text-slate-500">{t.loc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            <img src="/__mockup/images/work/bed-completed-800.webp" alt="Completed bed" className="rounded-xl aspect-square object-cover" />
            <img src="/__mockup/images/work/office-fitout-800.webp" alt="Office fitout" className="rounded-xl aspect-square object-cover" />
            <img src="/__mockup/images/work/wardrobe-oak-800.webp" alt="Oak wardrobe" className="rounded-xl aspect-square object-cover hidden md:block" />
            <img src="/__mockup/images/work/phone-booth-completed-800.webp" alt="Phone booth" className="rounded-xl aspect-square object-cover hidden md:block" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-10 text-center tracking-tight">Questions?</h2>
          <div className="divide-y divide-slate-200">
            {FAQS.map((faq, i) => (
              <div key={i} className="py-5">
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between text-left font-bold text-lg text-slate-900 hover:text-blue-600 transition-colors"
                >
                  {faq.q}
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="pt-4 text-slate-600 leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-blue-600 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-extrabold text-white mb-6 tracking-tight">Ready to get your furniture sorted?</h2>
          <p className="text-xl text-blue-100 mb-10">Get an instant quote online or chat with us on WhatsApp to book your slot.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-slate-50 rounded-full h-14 px-10 text-lg font-bold shadow-lg w-full sm:w-auto">
              <a href="/estimate" data-testid="footer-cta-primary">Get a Quote</a>
            </Button>
            <Button asChild size="lg" className="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full h-14 px-10 text-lg font-bold shadow-lg w-full sm:w-auto">
              <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" data-testid="footer-cta-whatsapp">
                <MessageCircle className="mr-2 w-6 h-6" /> WhatsApp Us
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 text-center text-sm border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="font-bold text-white mb-2">The Moving Guy Pte Ltd</div>
          <div>ACRA Reg · UEN 202424156H</div>
          <div className="mt-6 text-slate-500">© {new Date().getFullYear()} TMG Install. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
