import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { ArrowUpRight, ClipboardList, DollarSign, CalendarCheck, Zap, CheckCircle2, Clock, Calendar } from "lucide-react";
import { motion } from "framer-motion";

function SectionCard({ title, icon: Icon, color, quotes, emptyMsg }: {
  title: string;
  icon: React.ElementType;
  color: string;
  quotes: any[];
  emptyMsg: string;
}) {
  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className={`px-5 py-4 border-b flex items-center gap-3 ${color}`}>
        <Icon className="w-5 h-5" />
        <h2 className="font-bold text-base">{title}</h2>
        <span className="ml-auto text-sm font-bold bg-white/20 rounded-full px-2.5 py-0.5">{quotes.length}</span>
      </div>
      <div className="divide-y">
        {quotes.map((quote: any, i: number) => (
          <Link key={quote.id} href={`/admin/quotes/${quote.id}`} data-testid={`quote-row-${quote.id}`}>
            <div className="px-5 py-3.5 flex items-center gap-4 hover:bg-secondary/50 transition-colors group cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-secondary flex flex-col items-center justify-center border shrink-0 group-hover:border-primary/40 transition-colors">
                <span className="text-[10px] text-muted-foreground font-medium leading-none">TMG</span>
                <span className="text-xs font-bold leading-none">{quote.referenceNo.split('-')[1]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors truncate">{quote.customer?.name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground truncate">{quote.serviceAddress}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">${Number(quote.total || 0).toFixed(0)}</p>
                {quote.scheduledAt && <p className="text-xs text-muted-foreground">{format(new Date(quote.scheduledAt), 'MMM d')}</p>}
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        ))}
        {quotes.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground">{emptyMsg}</div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: allQuotes, isLoading } = useQuotes();

  if (isLoading) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const quotes = allQuotes || [];

  const newQuotes = quotes.filter((q: any) => ['submitted', 'under_review'].includes(q.status));
  const awaitingDeposit = quotes.filter((q: any) => q.status === 'deposit_requested');
  const pendingBooking = quotes.filter((q: any) => q.status === 'booking_requested');
  const upcomingBooked = quotes.filter((q: any) => ['booked', 'assigned'].includes(q.status));
  const activeJobs = quotes.filter((q: any) => ['in_progress'].includes(q.status));
  const awaitingPayment = quotes.filter((q: any) => ['completed', 'final_payment_requested'].includes(q.status));
  const recentlyClosed = quotes.filter((q: any) => ['closed', 'cancelled', 'final_paid'].includes(q.status)).slice(0, 5);

  const statCards = [
    { label: 'New Requests', value: newQuotes.length, color: 'bg-violet-500' },
    { label: 'Awaiting Deposit', value: awaitingDeposit.length, color: 'bg-amber-500' },
    { label: 'Pending Booking Confirm', value: pendingBooking.length, color: 'bg-blue-500' },
    { label: 'Upcoming Jobs', value: upcomingBooked.length, color: 'bg-indigo-500' },
    { label: 'Active / In Progress', value: activeJobs.length, color: 'bg-orange-500' },
    { label: 'Awaiting Final Payment', value: awaitingPayment.length, color: 'bg-emerald-500' },
  ];

  return (
    <div className="min-h-screen pt-28 pb-20 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-display font-black tracking-tight text-foreground">Command Center</h1>
            <p className="text-muted-foreground mt-1">Manage all jobs, bookings and payments.</p>
          </div>
          <Link href="/admin/schedule" data-testid="link-schedule">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-primary/90 transition-colors">
              <Calendar className="w-4 h-4" /> Schedule Management
            </div>
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {statCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl border p-4 shadow-sm">
              <p className="text-3xl font-black mb-1">{card.value}</p>
              <p className="text-xs text-muted-foreground font-medium leading-tight">{card.label}</p>
              <div className={`mt-2 h-1 rounded-full ${card.value > 0 ? card.color : 'bg-border'}`} />
            </motion.div>
          ))}
        </div>

        {/* Section Grid */}
        <div className="grid md:grid-cols-2 gap-5">
          <SectionCard
            title="New Quote Requests"
            icon={ClipboardList}
            color="bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
            quotes={newQuotes}
            emptyMsg="No new requests"
          />
          <SectionCard
            title="Awaiting Deposit"
            icon={DollarSign}
            color="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
            quotes={awaitingDeposit}
            emptyMsg="No outstanding deposits"
          />
          <SectionCard
            title="Pending Booking Confirmation"
            icon={Clock}
            color="bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
            quotes={pendingBooking}
            emptyMsg="No pending confirmations"
          />
          <SectionCard
            title="Upcoming Confirmed Bookings"
            icon={CalendarCheck}
            color="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
            quotes={upcomingBooked}
            emptyMsg="No upcoming bookings"
          />
          <SectionCard
            title="Active / In Progress"
            icon={Zap}
            color="bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
            quotes={activeJobs}
            emptyMsg="No active jobs"
          />
          <SectionCard
            title="Awaiting Final Payment / Closed"
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            quotes={awaitingPayment.concat(recentlyClosed)}
            emptyMsg="No completed jobs"
          />
        </div>

      </div>
    </div>
  );
}
