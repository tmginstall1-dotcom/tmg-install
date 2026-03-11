import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ClipboardList, ChevronRight, Zap } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white text-black pt-16">
      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-black/20 mb-8">
              <Zap className="w-4 h-4 text-black" />
              <span className="text-sm font-medium text-black">AI-Powered Instant Quotes</span>
            </div>

            {/* H1 */}
            <h1 className="text-[56px] sm:text-[72px] lg:text-[88px] leading-none tracking-tight mb-6 text-black uppercase">
              Furniture installation,<br className="hidden sm:block" /> made effortless.
            </h1>

            {/* Subtext */}
            <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-2xl font-body">
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
          <h2 className="text-[52px] lg:text-[68px] leading-none tracking-tight text-black mb-16 text-center uppercase">How it works</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="border border-gray-200 rounded-lg p-8 bg-white"
            >
              <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-lg mb-4 font-body">1</div>
              <h3 className="text-[28px] leading-none tracking-tight text-black mb-3 uppercase">Select Service</h3>
              <p className="text-gray-600 font-body">Choose whether you need furniture installed, dismantled, or relocated.</p>
            </motion.div>

            {/* Step 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="border border-gray-200 rounded-lg p-8 bg-white"
            >
              <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-lg mb-4 font-body">2</div>
              <h3 className="text-[28px] leading-none tracking-tight text-black mb-3 uppercase">Add Address</h3>
              <p className="text-gray-600 font-body">Tell us where the work needs to be done and confirm your location.</p>
            </motion.div>

            {/* Step 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="border border-gray-200 rounded-lg p-8 bg-white"
            >
              <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-lg mb-4 font-body">3</div>
              <h3 className="text-[28px] leading-none tracking-tight text-black mb-3 uppercase">Item List & Quote</h3>
              <p className="text-gray-600 font-body">Describe your items and our AI generates an instant, transparent quote.</p>
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
