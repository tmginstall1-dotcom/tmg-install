import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusConfig: Record<string, { label: string, classes: string }> = {
  submitted:                { label: "New Request",       classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200" },
  under_review:             { label: "Under Review",      classes: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200" },
  approved:                 { label: "Approved",          classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200" },
  deposit_requested:        { label: "Awaiting Deposit",  classes: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200" },
  deposit_paid:             { label: "Deposit Paid",      classes: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200" },
  booking_pending:          { label: "Needs Booking",     classes: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 border-fuchsia-200" },
  booking_requested:        { label: "Booking Requested", classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300" },
  booked:                   { label: "Booked",            classes: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200" },
  assigned:                 { label: "Staff Assigned",    classes: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200" },
  in_progress:              { label: "In Progress",       classes: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border-pink-200" },
  completed:                { label: "Completed",         classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200" },
  final_payment_requested:  { label: "Awaiting Final",   classes: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200" },
  final_paid:               { label: "Fully Paid",        classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300" },
  closed:                   { label: "Closed",            classes: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200" },
  cancelled:                { label: "Cancelled",         classes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200" },
};

export function StatusBadge({ status, className }: { status: string, className?: string }) {
  const config = statusConfig[status] || { label: status, classes: "bg-gray-100 text-gray-700 border-gray-200" };
  
  return (
    <span className={cn("px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-sm tracking-wide shadow-sm", config.classes, className)}>
      {config.label}
    </span>
  );
}
