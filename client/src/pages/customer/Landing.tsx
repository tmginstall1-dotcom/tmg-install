import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateQuoteRequest as useCreateQuote } from "@/hooks/use-quotes";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ClipboardList, ChevronRight, MapPin, Zap, Shield } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();
  const createQuote = useCreateQuote();
  const [isPending, setIsPending] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    serviceAddress: "",
    itemsDescription: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const res = await createQuote.mutateAsync({
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          companyName: formData.companyName || undefined,
        },
        serviceAddress: formData.serviceAddress,
        itemsDescription: formData.itemsDescription,
      });
      setLocation(`/quotes/${res.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to submit request");
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black pt-20">
      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Column */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/20 mb-8">
                <Zap className="w-4 h-4 text-black" />
                <span className="text-sm font-medium text-black">AI-Powered Instant Quotes</span>
              </div>

              {/* H1 */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-black leading-tight mb-6 text-black">
                Furniture installation, made effortless.
              </h1>

              {/* Subtext */}
              <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-md">
                Just tell us what you need built, moved, or dismantled. Our AI instantly understands your items and generates a precise quote in seconds.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link 
                  href="/estimate" 
                  data-testid="hero-cta-guided"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-lg font-semibold hover:bg-gray-900 transition-colors"
                >
                  Get a Guided Estimate <ChevronRight className="w-5 h-5" />
                </Link>
                <a 
                  href="https://wa.me/6580880757" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border border-black text-black rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  WhatsApp Us
                </a>
              </div>

              {/* Trust Chips */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-black flex-shrink-0" />
                  <span className="text-gray-700">Expert Installers</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-black flex-shrink-0" />
                  <span className="text-gray-700">Transparent Pricing</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-black flex-shrink-0" />
                  <span className="text-gray-700">Fast Scheduling</span>
                </div>
              </div>
            </motion.div>

            {/* Right Column - Form */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="bg-white border border-gray-200 rounded-xl p-8 sm:p-10">
                <h2 className="text-2xl font-bold text-black mb-2">Get an Instant Quote</h2>
                <p className="text-gray-600 mb-8 text-sm">Describe your items and we'll handle the rest.</p>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-black">Full Name</label>
                      <input 
                        required 
                        value={formData.name} 
                        onChange={e=>setFormData({...formData, name: e.target.value})} 
                        className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-black placeholder-gray-500 focus:border-black focus:ring-2 focus:ring-black/20 transition-all outline-none" 
                        placeholder="John Doe" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-black">Phone</label>
                      <input 
                        required 
                        value={formData.phone} 
                        onChange={e=>setFormData({...formData, phone: e.target.value})} 
                        className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-black placeholder-gray-500 focus:border-black focus:ring-2 focus:ring-black/20 transition-all outline-none" 
                        placeholder="+65 8080 0757" 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-black">Email</label>
                    <input 
                      required 
                      type="email" 
                      value={formData.email} 
                      onChange={e=>setFormData({...formData, email: e.target.value})} 
                      className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-black placeholder-gray-500 focus:border-black focus:ring-2 focus:ring-black/20 transition-all outline-none" 
                      placeholder="john@example.com" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-black">Service Address</label>
                    <input 
                      required 
                      value={formData.serviceAddress} 
                      onChange={e=>setFormData({...formData, serviceAddress: e.target.value})} 
                      className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-black placeholder-gray-500 focus:border-black focus:ring-2 focus:ring-black/20 transition-all outline-none" 
                      placeholder="123 Main St, Apt 4B, Singapore" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-black">Describe the job</label>
                    <textarea 
                      required 
                      value={formData.itemsDescription} 
                      onChange={e=>setFormData({...formData, itemsDescription: e.target.value})} 
                      rows={4} 
                      className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-black placeholder-gray-500 focus:border-black focus:ring-2 focus:ring-black/20 transition-all outline-none resize-none" 
                      placeholder="E.g., I need 2 IKEA Pax wardrobes assembled, and 1 large sofa dismantled and moved to the new address." 
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={isPending}
                    className="w-full bg-black text-white py-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Generating Quote..." : (
                      <>Get Quote Now <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Proof Strip */}
      <section className="bg-gray-50 border-t border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-8 justify-center text-center sm:text-left">
            <div className="text-sm font-medium text-gray-700">
              <div className="text-gray-900 font-semibold">Office / Home / Commercial</div>
            </div>
            <div className="text-sm font-medium text-gray-700">
              <div className="text-gray-900 font-semibold">Singapore-wide Coverage</div>
            </div>
            <div className="text-sm font-medium text-gray-700">
              <div className="text-gray-900 font-semibold">Same-day slots available</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 lg:px-8 py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl lg:text-5xl font-bold text-black mb-16 text-center">How it works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="border border-gray-200 rounded-lg p-8 bg-white"
            >
              <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-lg mb-4">1</div>
              <h3 className="text-lg font-bold text-black mb-3">Select Service</h3>
              <p className="text-gray-600">Choose whether you need furniture installed, dismantled, or relocated.</p>
            </motion.div>

            {/* Step 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="border border-gray-200 rounded-lg p-8 bg-white"
            >
              <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-lg mb-4">2</div>
              <h3 className="text-lg font-bold text-black mb-3">Add Address</h3>
              <p className="text-gray-600">Tell us where the work needs to be done and confirm your location.</p>
            </motion.div>

            {/* Step 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="border border-gray-200 rounded-lg p-8 bg-white"
            >
              <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-lg mb-4">3</div>
              <h3 className="text-lg font-bold text-black mb-3">Item List & Quote</h3>
              <p className="text-gray-600">Describe your items and our AI generates an instant, transparent quote.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white border-t border-gray-700 px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <h3 className="font-bold text-white mb-4">TMG Install</h3>
              <p className="text-gray-400 text-sm">Furniture installation, relocation, and dismantling made simple.</p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Contact</h3>
              <p className="text-gray-400 text-sm mb-2">WhatsApp: <a href="https://wa.me/6580880757" className="text-white hover:text-gray-300">+65 8088 0757</a></p>
              <p className="text-gray-400 text-sm">Email: <a href="mailto:sales@tmginstall.com" className="text-white hover:text-gray-300">sales@tmginstall.com</a></p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4">Legal</h3>
              <p className="text-gray-400 text-sm mb-2"><a href="#" className="hover:text-white">Privacy Policy</a></p>
              <p className="text-gray-400 text-sm"><a href="#" className="hover:text-white">Terms of Service</a></p>
            </div>
          </div>
          
          <div className="border-t border-gray-700 pt-8">
            <p className="text-gray-500 text-sm text-center">© 2026 The Moving Guy Pte Ltd. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
