import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRoute, useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, ShieldCheck, MessageCircle, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/hooks/use-tracker";
import { getPackage } from "@shared/packages";
import { requiresFullUpfront, PricingConfig } from "@shared/pricing";

const PAPER = "#fafaf7";
const INK = "#0a0a0a";
const ACCENT = "#2af56a";
const LINE = "rgba(10,10,10,0.12)";

const WHATSAPP =
  "https://wa.me/6580880757?text=Hi%20TMG%20Install%2C%20I%20would%20like%20to%20book%20the%20Essential%20Move%20%2B%20Setup%20package.";

const TIME_WINDOWS = [
  { value: "09:00-12:00", label: "Morning · 9am – 12pm" },
  { value: "13:00-17:00", label: "Afternoon · 1pm – 5pm" },
];

const bookingSchema = z.object({
  name: z.string().min(1, "Your name is required"),
  phone: z.string().min(6, "A contact number is required"),
  email: z.string().email("Enter a valid email"),
  pickupAddress: z.string().min(3, "Pickup address (Point A) is required"),
  dropoffAddress: z.string().min(3, "Delivery address (Point B) is required"),
  preferredDate: z.string().min(1, "Pick a preferred date"),
  preferredTimeWindow: z.string().min(1, "Pick a time window"),
  notes: z.string().max(2000).optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

const inputClass =
  "w-full bg-white border-2 px-4 py-3 text-[15px] outline-none transition-colors focus:border-black placeholder:text-black/30";

function tomorrowSG(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function Field({
  label,
  htmlFor,
  error,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="text-[10px] tracking-[0.2em] uppercase font-bold text-black/55"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-black/40">{hint}</p>}
      {error && (
        <p className="text-[11px] font-semibold text-red-600" data-testid={`error-${htmlFor}`}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function PackageBooking() {
  const [, params] = useRoute("/book/:packageId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const pkg = params?.packageId ? getPackage(params.packageId) : undefined;

  useEffect(() => {
    document.title = pkg
      ? `Book ${pkg.name} — TMG Install`
      : "Package not found — TMG Install";
  }, [pkg]);

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      pickupAddress: "",
      dropoffAddress: "",
      preferredDate: "",
      preferredTimeWindow: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: BookingForm) => {
      const res = await apiRequest("POST", "/api/quotes/package", {
        packageId: pkg!.id,
        ...values,
      });
      return (await res.json()) as { id: number; referenceNo: string };
    },
    onSuccess: (data) => {
      trackEvent("package_booking_submitted", "/book");
      setLocation(`/quotes/${data.id}?ref=${data.referenceNo}`);
    },
    onError: (err: Error) => {
      toast({
        title: "Booking couldn't be submitted",
        description: err.message || "Please try again or reach us on WhatsApp.",
        variant: "destructive",
      });
    },
  });

  if (!pkg) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: PAPER, color: INK }}
      >
        <p className="text-[11px] tracking-[0.25em] uppercase font-bold text-black/40">
          Package not found
        </p>
        <h1 className="font-serif italic font-black text-3xl">
          We couldn't find that package.
        </h1>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-7 py-3 font-bold text-[13px] tracking-[0.18em] uppercase"
          style={{ background: ACCENT, color: INK, border: `2px solid ${INK}` }}
          data-testid="link-home"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
      </div>
    );
  }

  const deposit = requiresFullUpfront(pkg.price)
    ? pkg.price
    : pkg.price * PricingConfig.deposit.pct;
  const balance = Math.max(0, pkg.price - deposit);
  const fullUpfront = requiresFullUpfront(pkg.price);

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-10 py-4 backdrop-blur"
        style={{ background: "rgba(250,250,247,0.86)", borderBottom: `1px solid ${LINE}` }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase font-bold text-black/60 hover:text-black transition-colors"
          data-testid="link-back-home"
        >
          <ArrowLeft className="w-4 h-4" /> TMG Install
        </Link>
        <span className="inline-flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase font-bold text-black/45">
          <Lock className="w-3.5 h-3.5" /> Secure booking
        </span>
      </div>

      <div className="mx-auto max-w-[1280px] px-5 md:px-10 py-10 md:py-16">
        {/* Header */}
        <div className="mb-10 md:mb-14">
          <div className="flex items-center gap-3 mb-5">
            <span
              className="px-3 py-1 text-[10px] tracking-[0.22em] uppercase font-bold"
              style={{ background: ACCENT, color: INK }}
              data-testid="badge-package"
            >
              ★ {pkg.badge ?? "Package"}
            </span>
            <span className="text-[10px] tracking-[0.22em] uppercase font-bold text-black/40">
              Fixed NET price
            </span>
          </div>
          <h1
            className="font-serif italic font-black tracking-[-0.02em] leading-[0.95]"
            style={{ fontSize: "clamp(34px, 6vw, 76px)" }}
            data-testid="text-booking-title"
          >
            {pkg.name}
          </h1>
          <p className="mt-5 text-black/60 text-base md:text-lg max-w-[560px]">
            {pkg.blurb}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-y-12 md:gap-x-14">
          {/* LEFT — form */}
          <form
            onSubmit={onSubmit}
            className="col-span-12 lg:col-span-7 flex flex-col gap-9"
            data-testid="form-package-booking"
            noValidate
          >
            <section className="flex flex-col gap-5">
              <h2 className="text-[11px] tracking-[0.22em] uppercase font-bold text-black/40 border-b pb-3" style={{ borderColor: LINE }}>
                01 — Your details
              </h2>
              <Field label="Full name" htmlFor="name" error={form.formState.errors.name?.message}>
                <input
                  id="name"
                  className={inputClass}
                  style={{ borderColor: LINE }}
                  placeholder="e.g. Jane Tan"
                  data-testid="input-name"
                  {...form.register("name")}
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Mobile number" htmlFor="phone" error={form.formState.errors.phone?.message}>
                  <input
                    id="phone"
                    inputMode="tel"
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    placeholder="e.g. 8123 4567"
                    data-testid="input-phone"
                    {...form.register("phone")}
                  />
                </Field>
                <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
                  <input
                    id="email"
                    type="email"
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    placeholder="you@email.com"
                    data-testid="input-email"
                    {...form.register("email")}
                  />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-5">
              <h2 className="text-[11px] tracking-[0.22em] uppercase font-bold text-black/40 border-b pb-3" style={{ borderColor: LINE }}>
                02 — Move details
              </h2>
              <Field
                label="Pickup address (Point A)"
                htmlFor="pickupAddress"
                error={form.formState.errors.pickupAddress?.message}
              >
                <input
                  id="pickupAddress"
                  className={inputClass}
                  style={{ borderColor: LINE }}
                  placeholder="Block, unit, street, postal code"
                  data-testid="input-pickup"
                  {...form.register("pickupAddress")}
                />
              </Field>
              <Field
                label="Delivery address (Point B)"
                htmlFor="dropoffAddress"
                hint="Singapore main island. Off-island trips are quoted separately."
                error={form.formState.errors.dropoffAddress?.message}
              >
                <input
                  id="dropoffAddress"
                  className={inputClass}
                  style={{ borderColor: LINE }}
                  placeholder="Block, unit, street, postal code"
                  data-testid="input-dropoff"
                  {...form.register("dropoffAddress")}
                />
              </Field>
            </section>

            <section className="flex flex-col gap-5">
              <h2 className="text-[11px] tracking-[0.22em] uppercase font-bold text-black/40 border-b pb-3" style={{ borderColor: LINE }}>
                03 — Preferred schedule
              </h2>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field
                  label="Preferred date"
                  htmlFor="preferredDate"
                  error={form.formState.errors.preferredDate?.message}
                >
                  <input
                    id="preferredDate"
                    type="date"
                    min={tomorrowSG()}
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    data-testid="input-date"
                    {...form.register("preferredDate")}
                  />
                </Field>
                <Field
                  label="Time window"
                  htmlFor="preferredTimeWindow"
                  error={form.formState.errors.preferredTimeWindow?.message}
                >
                  <select
                    id="preferredTimeWindow"
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    data-testid="select-time"
                    defaultValue=""
                    {...form.register("preferredTimeWindow")}
                  >
                    <option value="" disabled>
                      Select a window
                    </option>
                    {TIME_WINDOWS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field
                label="Anything we should know? (optional)"
                htmlFor="notes"
                hint="List your items, lift access, parking, or special requests."
                error={form.formState.errors.notes?.message}
              >
                <textarea
                  id="notes"
                  rows={4}
                  className={inputClass + " resize-y"}
                  style={{ borderColor: LINE }}
                  placeholder="e.g. 1 wardrobe + 1 bed frame, no lift on pickup level 3"
                  data-testid="input-notes"
                  {...form.register("notes")}
                />
              </Field>
            </section>

            <div className="hidden lg:block">
              <SubmitButton pending={mutation.isPending} />
              <p className="mt-3 text-[11px] text-black/45">
                You won't be charged now. We'll confirm your slot, then send a secure
                payment link for the {fullUpfront ? "full amount" : "50% deposit"}.
              </p>
            </div>
          </form>

          {/* RIGHT — sticky booking summary */}
          <aside className="col-span-12 lg:col-span-5">
            <div
              className="lg:sticky lg:top-24 border-2"
              style={{ borderColor: INK, background: "#fff" }}
              data-testid="panel-summary"
            >
              <div className="px-6 md:px-8 py-7 border-b" style={{ borderColor: LINE }}>
                <p className="text-[10px] tracking-[0.22em] uppercase font-bold text-black/40 mb-3">
                  Booking summary
                </p>
                <h3 className="font-serif italic font-black text-2xl md:text-3xl leading-tight">
                  {pkg.name}
                </h3>
                <div className="mt-5 flex items-baseline gap-3">
                  <span
                    className="font-serif italic font-black tracking-[-0.02em]"
                    style={{ fontSize: "clamp(40px, 7vw, 64px)" }}
                    data-testid="text-summary-price"
                  >
                    S${pkg.price}
                  </span>
                  <span className="text-[11px] tracking-[0.2em] uppercase font-bold text-black/50">
                    NET <span style={{ color: "#16a34a" }}>·</span> up to {pkg.durationHours} hrs
                  </span>
                </div>
              </div>

              {/* Payment breakdown */}
              <div className="px-6 md:px-8 py-6 border-b" style={{ borderColor: LINE }}>
                <Row label="Package price (all-in, no GST)" value={`S$${pkg.price.toFixed(2)}`} testid="row-price" />
                {!fullUpfront && (
                  <>
                    <Row label="Deposit to confirm (50%)" value={`S$${deposit.toFixed(2)}`} strong testid="row-deposit" />
                    <Row label="Balance after the job" value={`S$${balance.toFixed(2)}`} muted testid="row-balance" />
                  </>
                )}
                {fullUpfront && (
                  <Row label="Payable to confirm" value={`S$${deposit.toFixed(2)}`} strong testid="row-deposit" />
                )}
              </div>

              {/* Includes */}
              <div className="px-6 md:px-8 py-6 border-b" style={{ borderColor: LINE }}>
                <p className="text-[10px] tracking-[0.22em] uppercase font-bold text-black/40 mb-4">
                  What's included
                </p>
                <ul className="flex flex-col gap-3">
                  {pkg.includes.map((item, i) => (
                    <li key={i} className="flex items-start gap-3" data-testid={`summary-include-${i}`}>
                      <span
                        className="mt-[5px] inline-block w-[9px] h-[9px] shrink-0"
                        style={{ background: ACCENT }}
                        aria-hidden="true"
                      />
                      <span className="text-[14px] leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Trust */}
              <div className="px-6 md:px-8 py-6 border-b" style={{ borderColor: LINE }}>
                <div className="flex flex-col gap-3 text-[12px] font-semibold text-black/70">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" style={{ color: "#16a34a" }} /> Pay only after we confirm your slot
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" style={{ color: "#16a34a" }} /> 5,000+ jobs across Singapore since 2019
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" style={{ color: "#16a34a" }} /> Same-week slots, island-wide
                  </span>
                </div>
              </div>

              {/* Fine print */}
              <div className="px-6 md:px-8 py-6">
                <p className="text-[10px] tracking-[0.22em] uppercase font-bold text-black/40 mb-3">
                  Good to know
                </p>
                <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-black/55" data-testid="summary-fineprint">
                  {pkg.fineprint.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true">·</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("package_booking_whatsapp", "/book")}
                  className="mt-5 inline-flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase font-bold text-black/55 hover:text-black transition-colors"
                  data-testid="link-whatsapp"
                >
                  <MessageCircle className="w-4 h-4" /> Questions? Chat on WhatsApp
                </a>
              </div>
            </div>

            {/* Mobile submit */}
            <div className="lg:hidden mt-8">
              <SubmitButton pending={mutation.isPending} onClick={onSubmit} />
              <p className="mt-3 text-[11px] text-black/45">
                You won't be charged now. We'll confirm your slot, then send a secure
                payment link for the {fullUpfront ? "full amount" : "50% deposit"}.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  testid,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  testid?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5" data-testid={testid}>
      <span className={`text-[13px] ${muted ? "text-black/45" : "text-black/70"}`}>{label}</span>
      <span
        className={`tabular-nums ${strong ? "font-black text-[15px]" : muted ? "text-black/45 text-[13px]" : "font-semibold text-[14px]"}`}
      >
        {value}
      </span>
    </div>
  );
}

function SubmitButton({
  pending,
  onClick,
}: {
  pending: boolean;
  onClick?: (e: React.FormEvent) => void;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={pending}
      data-testid="button-submit-booking"
      className="group inline-flex items-center justify-center gap-2 w-full px-8 py-4 font-bold text-[14px] tracking-[0.18em] uppercase transition-transform duration-200 active:scale-[0.98] disabled:opacity-60 shadow-[0_6px_0_rgba(0,0,0,0.92)] hover:shadow-[0_4px_0_rgba(0,0,0,0.92)] hover:-translate-y-[2px] disabled:hover:translate-y-0"
      style={{ background: ACCENT, color: INK, border: `2px solid ${INK}` }}
    >
      {pending ? "Submitting…" : "Confirm booking request"}
      {!pending && (
        <ArrowRight className="w-[18px] h-[18px] transition-transform duration-200 group-hover:translate-x-1" />
      )}
    </button>
  );
}
