import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Calendar, User, Clock, CheckCircle2, Circle, AlertCircle, ChevronRight, MessageCircle, Image } from "lucide-react";
import { format, parseISO } from "date-fns";

type TrackerData = {
  referenceNo: string;
  status: string;
  scheduledAt: string | null;
  timeWindow: string | null;
  preferredDate: string | null;
  preferredTimeWindow: string | null;
  serviceAddress: string | null;
  selectedServices: string[];
  installerName: string | null;
  updates: {
    statusChange: string;
    note: string | null;
    photoUrls: string[];
    createdAt: string;
  }[];
};

const STEPS = [
  { key: "confirmed", label: "Confirmed", subLabel: "Deposit received" },
  { key: "scheduled", label: "Scheduled", subLabel: "Date & team assigned" },
  { key: "in_progress", label: "In Progress", subLabel: "Installers on site" },
  { key: "completed", label: "Completed", subLabel: "All done!" },
];

function getStepIndex(status: string): number {
  if (["completed", "final_payment_requested", "final_paid", "closed"].includes(status)) return 3;
  if (status === "in_progress") return 2;
  if (["booked", "booking_requested", "assigned"].includes(status)) return 1;
  if (["deposit_paid", "deposit_requested"].includes(status)) return 0;
  return -1;
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Quote Submitted",
  deposit_requested: "Deposit Requested",
  deposit_paid: "Deposit Received",
  booking_requested: "Booking Requested",
  booked: "Job Booked",
  assigned: "Installer Assigned",
  in_progress: "Job Started",
  completed: "Job Completed",
  final_payment_requested: "Final Payment Requested",
  final_paid: "Payment Received",
  closed: "Case Closed",
  cancelled: "Cancelled",
  review_requested: "Review Requested",
};

function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "d MMM yyyy, h:mm a");
  } catch {
    return dateStr;
  }
}

function formatScheduled(scheduledAt: string | null, timeWindow: string | null, preferredDate: string | null, preferredTimeWindow: string | null) {
  if (scheduledAt) {
    try {
      const d = format(parseISO(scheduledAt), "EEE, d MMM yyyy");
      return timeWindow ? `${d} · ${timeWindow}` : d;
    } catch {}
  }
  if (preferredDate) {
    const tw = preferredTimeWindow || timeWindow || "";
    return `${preferredDate}${tw ? ` · ${tw}` : ""} (preferred)`;
  }
  return null;
}

export default function JobTracker() {
  const { referenceNo } = useParams<{ referenceNo: string }>();

  const { data, isLoading, isError } = useQuery<TrackerData>({
    queryKey: [`/api/public/track/${referenceNo}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Loading your job details…</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <AlertCircle className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-zinc-800 mb-1">Job not found</h2>
            <p className="text-sm text-zinc-500">
              We couldn't find a job matching <span className="font-mono font-medium">{referenceNo}</span>.
              Please check your reference number and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stepIndex = getStepIndex(data.status);
  const isCancelled = data.status === "cancelled";
  const scheduledText = formatScheduled(data.scheduledAt, data.timeWindow, data.preferredDate, data.preferredTimeWindow);
  const photosAll = data.updates.flatMap(u => u.photoUrls ?? []).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Header />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Reference + Status badge */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider mb-1">Reference</p>
              <p data-testid="text-reference-no" className="text-xl font-bold text-zinc-900 font-mono">{data.referenceNo}</p>
            </div>
            <StatusBadge status={data.status} />
          </div>
        </div>

        {/* Progress stepper */}
        {!isCancelled && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-4">Progress</p>
            <div className="flex items-start">
              {STEPS.map((step, i) => {
                const done = stepIndex > i;
                const active = stepIndex === i;
                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center relative">
                    {/* Connector line */}
                    {i < STEPS.length - 1 && (
                      <div
                        className={`absolute top-4 left-1/2 w-full h-0.5 ${done ? "bg-green-500" : "bg-zinc-200"}`}
                        style={{ zIndex: 0 }}
                      />
                    )}
                    {/* Circle */}
                    <div
                      data-testid={`step-${step.key}`}
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                        done
                          ? "bg-green-500 border-green-500"
                          : active
                          ? "bg-black border-black"
                          : "bg-white border-zinc-300"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : active ? (
                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-zinc-300" />
                      )}
                    </div>
                    {/* Labels */}
                    <p className={`mt-2 text-[10px] font-semibold text-center leading-tight ${done || active ? "text-zinc-800" : "text-zinc-400"}`}>
                      {step.label}
                    </p>
                    <p className="text-[9px] text-zinc-400 text-center leading-tight mt-0.5 hidden sm:block">
                      {step.subLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Job Cancelled</p>
              <p className="text-xs text-red-600 mt-0.5">This job has been cancelled. Contact us if you'd like to rebook.</p>
            </div>
          </div>
        )}

        {/* Job details */}
        <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
          <div className="px-5 py-3.5">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-3">Job Details</p>
            <div className="space-y-3">
              {data.serviceAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-zinc-400 mb-0.5">Service Address</p>
                    <p data-testid="text-service-address" className="text-sm font-medium text-zinc-800">{data.serviceAddress}</p>
                  </div>
                </div>
              )}
              {scheduledText && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-zinc-400 mb-0.5">Schedule</p>
                    <p data-testid="text-schedule" className="text-sm font-medium text-zinc-800">{scheduledText}</p>
                  </div>
                </div>
              )}
              {data.installerName && (
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-zinc-400 mb-0.5">Assigned Installer</p>
                    <p data-testid="text-installer-name" className="text-sm font-medium text-zinc-800">{data.installerName}</p>
                  </div>
                </div>
              )}
              {data.selectedServices.length > 0 && (
                <div className="flex items-start gap-3">
                  <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {data.selectedServices.map((s, i) => (
                        <span key={i} className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full capitalize">
                          {typeof s === "string" ? s.replace(/_/g, " ") : s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Completion photos */}
        {photosAll.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5" /> Photos
            </p>
            <div className="grid grid-cols-3 gap-2">
              {photosAll.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" data-testid={`img-job-photo-${i}`}>
                  <img
                    src={url}
                    alt={`Job photo ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border border-zinc-200 hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Updates timeline */}
        {data.updates.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Activity
            </p>
            <div className="space-y-3">
              {data.updates.map((u, i) => (
                <div key={i} data-testid={`timeline-item-${i}`} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-zinc-400 shrink-0 mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-800">
                      {STATUS_LABELS[u.statusChange] ?? u.statusChange.replace(/_/g, " ")}
                    </p>
                    {u.note && (
                      <p className="text-xs text-zinc-500 mt-0.5">{u.note}</p>
                    )}
                    <p className="text-xs text-zinc-400 mt-0.5">{formatDate(u.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Help footer */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-800">Need help?</p>
            <p className="text-xs text-zinc-500">Chat with our team on WhatsApp</p>
          </div>
          <a
            href="https://wa.me/6580880757"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-whatsapp-help"
            className="flex items-center gap-2 bg-[#25D366] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#20bb5a] transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp Us
          </a>
        </div>

        <p className="text-center text-xs text-zinc-400 pb-4">
          TMG Install · The Moving Guy Pte Ltd · Singapore
        </p>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="bg-white border-b border-zinc-200 px-4 py-4">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-black">T</span>
        </div>
        <div>
          <p className="text-sm font-bold text-zinc-900 leading-none">TMG Install</p>
          <p className="text-xs text-zinc-400 mt-0.5">Job Tracker</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    submitted:         { label: "Under Review", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    deposit_requested: { label: "Awaiting Deposit", className: "bg-orange-50 text-orange-700 border-orange-200" },
    deposit_paid:      { label: "Confirmed", className: "bg-blue-50 text-blue-700 border-blue-200" },
    booking_requested: { label: "Scheduling", className: "bg-purple-50 text-purple-700 border-purple-200" },
    booked:            { label: "Booked", className: "bg-blue-50 text-blue-700 border-blue-200" },
    assigned:          { label: "Assigned", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    in_progress:       { label: "In Progress", className: "bg-blue-50 text-blue-800 border-blue-300 animate-pulse" },
    completed:         { label: "Completed ✓", className: "bg-green-50 text-green-700 border-green-200" },
    final_payment_requested: { label: "Final Payment Due", className: "bg-orange-50 text-orange-700 border-orange-200" },
    final_paid:        { label: "Paid ✓", className: "bg-green-50 text-green-700 border-green-200" },
    closed:            { label: "Closed ✓", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
    cancelled:         { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" },
  };
  const cfg = configs[status] ?? { label: status.replace(/_/g, " "), className: "bg-zinc-100 text-zinc-600 border-zinc-200" };
  return (
    <span
      data-testid="badge-job-status"
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize whitespace-nowrap ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
