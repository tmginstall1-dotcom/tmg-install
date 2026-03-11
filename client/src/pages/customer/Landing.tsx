import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateQuoteRequest } from "@/hooks/use-auth"; // wait, it's in use-quotes
import { useCreateQuoteRequest as useCreateQuote } from "@/hooks/use-quotes";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, CheckCircle2, Box, Truck, Wrench, ClipboardList, ChevronRight } from "lucide-react";

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
    <div className="min-h-screen pt-20 flex flex-col">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* landing page hero modern living room minimal furniture */}
          <img 
            src="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1920&q=80&fit=crop" 
            alt="Modern interior" 
            className="w-full h-full object-cover opacity-[0.03] dark:opacity-[0.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background to-background"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Copy */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm mb-6 border border-primary/20">
                <Sparkles className="w-4 h-4" />
                <span>AI-Powered Instant Quotes</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-display font-black leading-[1.1] mb-6">
                Furniture installation, <span className="color-gradient-text">made effortless.</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed text-balance">
                Just tell us what you need built, moved, or dismantled. Our AI instantly understands your items and generates a precise quote in seconds.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link href="/estimate" data-testid="hero-cta-guided"
                  className="btn-primary-gradient inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-lg">
                  <ClipboardList className="w-5 h-5" /> Get a Guided Estimate <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <div className="flex items-center gap-3 bg-card px-5 py-4 rounded-2xl shadow-sm border">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold">Expert Installers</div>
                    <div className="text-xs text-muted-foreground">Vetted professionals</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-card px-5 py-4 rounded-2xl shadow-sm border">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold">Fully Insured</div>
                    <div className="text-xs text-muted-foreground">Safe transportation</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Form */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="glass-card rounded-[2rem] p-8 sm:p-10 relative overflow-hidden">
                {/* Decorative blobs */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 blur-3xl rounded-full"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent/20 blur-3xl rounded-full"></div>
                
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold mb-2">Get an Instant Quote</h3>
                  <p className="text-muted-foreground mb-8 text-sm">Describe your items and we'll handle the rest.</p>
                  
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Full Name</label>
                        <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder="John Doe" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Phone</label>
                        <input required value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder="+1 (555) 000-0000" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Email</label>
                      <input required type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder="john@example.com" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Service Address</label>
                      <input required value={formData.serviceAddress} onChange={e=>setFormData({...formData, serviceAddress: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder="123 Main St, Apt 4B, City" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Describe the job</label>
                      <textarea required value={formData.itemsDescription} onChange={e=>setFormData({...formData, itemsDescription: e.target.value})} rows={4} className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none" placeholder="E.g., I need 2 IKEA Pax wardrobes assembled, and 1 large sofa dismantled and moved to the new address." />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isPending}
                      className="w-full btn-primary-gradient py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 mt-4"
                    >
                      {isPending ? "Generating Quote..." : (
                        <>Get Quote Now <ArrowRight className="w-5 h-5" /></>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
