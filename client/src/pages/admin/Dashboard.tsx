import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { Search, Filter, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: quotes, isLoading } = useQuotes(statusFilter);

  const tabs = [
    { id: 'all', label: 'All Jobs' },
    { id: 'submitted', label: 'New Requests' },
    { id: 'deposit_requested', label: 'Awaiting Deposit' },
    { id: 'booked', label: 'Upcoming' },
    { id: 'in_progress', label: 'Active' },
  ];

  return (
    <div className="min-h-screen pt-28 pb-20 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-display font-black tracking-tight text-foreground">Command Center</h1>
            <p className="text-muted-foreground mt-2 text-lg">Manage quotes, bookings, and dispatch.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-card p-1.5 rounded-xl border shadow-sm">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  statusFilter === tab.id 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid gap-4">
            {quotes?.map((quote: any, i: number) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={quote.id} 
              >
                <Link href={`/admin/quotes/${quote.id}`} className="block group">
                  <div className="bg-card border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                    <div className="flex items-start sm:items-center gap-6">
                      <div className="w-14 h-14 rounded-xl bg-secondary flex flex-col items-center justify-center border group-hover:bg-primary/5 transition-colors">
                        <span className="text-xs text-muted-foreground font-medium">REF</span>
                        <span className="font-bold font-display">{quote.referenceNo.split('-')[1]}</span>
                      </div>
                      
                      <div>
                        <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors">{quote.customer?.name}</h3>
                        <p className="text-sm text-muted-foreground truncate max-w-[300px]">{quote.serviceAddress}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                      {quote.scheduledAt && (
                        <div className="text-sm">
                          <p className="text-muted-foreground mb-0.5">Scheduled</p>
                          <p className="font-semibold">{format(new Date(quote.scheduledAt), 'MMM dd')}</p>
                        </div>
                      )}
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-0.5">Total</p>
                        <p className="font-semibold">${quote.total}</p>
                      </div>
                      <div className="min-w-[140px] flex justify-end">
                        <StatusBadge status={quote.status} />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all transform group-hover:translate-x-1">
                        <ArrowUpRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            
            {quotes?.length === 0 && (
              <div className="text-center py-20 bg-card rounded-3xl border border-dashed">
                <p className="text-muted-foreground">No quotes found for this filter.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
