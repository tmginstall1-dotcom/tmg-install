import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusConfig: Record<string, { label: string; classes: string }> = {
  submitted:               { label: "New Request",      classes: "bg-blue-50 text-blue-700" },
  under_review:            { label: "Under Review",     classes: "bg-amber-50 text-amber-700" },
  approved:                { label: "Approved",         classes: "bg-emerald-50 text-emerald-700" },
  deposit_requested:       { label: "Awaiting Deposit", classes: "bg-orange-50 text-orange-700" },
  deposit_paid:            { label: "Deposit Paid",     classes: "bg-indigo-50 text-indigo-700" },
  booking_pending:         { label: "Needs Booking",    classes: "bg-fuchsia-50 text-fuchsia-700" },
  booking_requested:       { label: "Booking Requested",classes: "bg-blue-50 text-blue-700" },
  booked:                  { label: "Booked",           classes: "bg-violet-50 text-violet-700" },
  assigned:                { label: "Staff Assigned",   classes: "bg-cyan-50 text-cyan-700" },
  in_progress:             { label: "In Progress",      classes: "bg-pink-50 text-pink-700" },
  completed:               { label: "Completed",        classes: "bg-emerald-50 text-emerald-700" },
  final_payment_requested: { label: "Awaiting Final",   classes: "bg-orange-50 text-orange-700" },
  final_paid:              { label: "Fully Paid",       classes: "bg-emerald-100 text-emerald-800" },
  closed:                  { label: "Closed",           classes: "bg-zinc-100 text-zinc-600" },
  cancelled:               { label: "Cancelled",        classes: "bg-red-50 text-red-700" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = statusConfig[status] || { label: status, classes: "bg-zinc-100 text-zinc-600" };

  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
      config.classes,
      className
    )}>
      {config.label}
    </span>
  );
}
