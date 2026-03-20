import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusConfig: Record<string, { label: string; dot: string; classes: string }> = {
  submitted:               { label: "New Request",      dot: "bg-blue-500",    classes: "bg-blue-50 text-blue-700 border-blue-200" },
  under_review:            { label: "Under Review",     dot: "bg-amber-500",   classes: "bg-amber-50 text-amber-700 border-amber-200" },
  approved:                { label: "Approved",         dot: "bg-emerald-500", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  deposit_requested:       { label: "Awaiting Deposit", dot: "bg-orange-500",  classes: "bg-orange-50 text-orange-700 border-orange-200" },
  deposit_paid:            { label: "Deposit Paid",     dot: "bg-indigo-500",  classes: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  booking_pending:         { label: "Needs Booking",    dot: "bg-fuchsia-500", classes: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  booking_requested:       { label: "Booking Requested",dot: "bg-blue-500",   classes: "bg-blue-50 text-blue-800 border-blue-200" },
  booked:                  { label: "Booked",           dot: "bg-violet-500",  classes: "bg-violet-50 text-violet-700 border-violet-200" },
  assigned:                { label: "Staff Assigned",   dot: "bg-cyan-500",    classes: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  in_progress:             { label: "In Progress",      dot: "bg-pink-500",    classes: "bg-pink-50 text-pink-700 border-pink-200" },
  completed:               { label: "Completed",        dot: "bg-emerald-500", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  final_payment_requested: { label: "Awaiting Final",   dot: "bg-orange-500",  classes: "bg-orange-50 text-orange-700 border-orange-200" },
  final_paid:              { label: "Fully Paid",       dot: "bg-emerald-600", classes: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  closed:                  { label: "Closed",           dot: "bg-slate-400",   classes: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelled:               { label: "Cancelled",        dot: "bg-red-500",     classes: "bg-red-50 text-red-700 border-red-200" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusConfig[status] || { label: status, dot: "bg-gray-400", classes: "bg-gray-100 text-gray-700 border-gray-200" };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-0.5 border text-[10px] font-black uppercase tracking-[0.1em] leading-none whitespace-nowrap",
      config.classes,
      className
    )}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}
