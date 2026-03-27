import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  User, Phone, MapPin, Calendar, Clock, Package, DollarSign,
  Plus, Trash2, CheckCircle2, ExternalLink,
} from "lucide-react";

const SERVICE_OPTIONS = [
  "Assembly", "Dismantling", "Relocation", "Wall Mounting",
  "Curtain / Blinds", "Electrical", "Other",
];

const TIME_WINDOWS = [
  { value: "09:00-12:00", label: "Morning  (09:00 – 12:00)" },
  { value: "13:00-17:00", label: "Afternoon  (13:00 – 17:00)" },
  { value: "09:00-17:00", label: "Full Day  (09:00 – 17:00)" },
];

const SOURCE_OPTIONS = [
  { value: "phone",      label: "📞  Phone Call" },
  { value: "ikea",       label: "🛋  IKEA Direct" },
  { value: "referral",   label: "🤝  Referral" },
  { value: "walk_in",    label: "🚶  Walk-in" },
  { value: "whatsapp",   label: "💬  WhatsApp" },
  { value: "other",      label: "⚡  Other" },
];

const PAYMENT_OPTIONS = [
  { value: "unpaid",       label: "Unpaid" },
  { value: "deposit_paid", label: "Deposit Paid" },
  { value: "paid_in_full", label: "Paid in Full" },
];

type LineItem = { id: number; description: string; quantity: number; unitPrice: string };
let _id = 1;
const genId = () => _id++;

type StaffMember = { id: number; name: string; role: string };

type CreatedJob = {
  id: number;
  referenceNo: string;
  serviceAddress: string;
  scheduledAt: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateJobModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [customerName, setCustomerName]       = useState("");
  const [customerPhone, setCustomerPhone]     = useState("");
  const [serviceAddress, setServiceAddress]   = useState("");
  const [services, setServices]               = useState<string[]>([]);
  const [scheduledDate, setScheduledDate]     = useState("");
  const [timeWindow, setTimeWindow]           = useState("09:00-12:00");
  const [items, setItems]                     = useState<LineItem[]>([{ id: genId(), description: "", quantity: 1, unitPrice: "" }]);
  const [manualTotal, setManualTotal]         = useState("");
  const [paymentStatus, setPaymentStatus]     = useState("unpaid");
  const [assignedStaffId, setAssignedStaffId] = useState<string>("");
  const [sourceChannel, setSourceChannel]     = useState("phone");
  const [notes, setNotes]                     = useState("");
  const [createdJob, setCreatedJob]           = useState<CreatedJob | null>(null);

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
    enabled: open,
  });

  const calculatedTotal = items.reduce((sum, item) => {
    return sum + (item.quantity * parseFloat(item.unitPrice || "0"));
  }, 0);

  const createJob = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/admin/jobs/create", data);
      return res.json() as Promise<CreatedJob>;
    },
    onSuccess: (data: CreatedJob) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setCreatedJob(data);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create job", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!customerName.trim()) return toast({ title: "Customer name required", variant: "destructive" });
    if (!customerPhone.trim()) return toast({ title: "Customer phone required", variant: "destructive" });
    if (!serviceAddress.trim()) return toast({ title: "Service address required", variant: "destructive" });

    const validItems = items.filter(i => i.description.trim());

    createJob.mutate({
      customerName:     customerName.trim(),
      customerPhone:    customerPhone.trim(),
      serviceAddress:   serviceAddress.trim(),
      scheduledDate:    scheduledDate || null,
      timeWindow:       scheduledDate ? timeWindow : null,
      selectedServices: services,
      notes:            notes.trim() || null,
      assignedStaffId:  assignedStaffId ? parseInt(assignedStaffId) : null,
      total:            manualTotal || calculatedTotal.toFixed(2),
      depositAmount:    "0",
      paymentStatus,
      sourceChannel,
      items:            validItems.map(i => ({
        description: i.description,
        quantity:    i.quantity,
        unitPrice:   i.unitPrice || "0",
      })),
    });
  };

  const handleClose = () => {
    if (createdJob) {
      setCreatedJob(null);
      resetForm();
    }
    onClose();
  };

  const resetForm = () => {
    setCustomerName(""); setCustomerPhone(""); setServiceAddress("");
    setServices([]); setScheduledDate(""); setTimeWindow("09:00-12:00");
    setItems([{ id: genId(), description: "", quantity: 1, unitPrice: "" }]);
    setManualTotal(""); setPaymentStatus("unpaid"); setAssignedStaffId("");
    setSourceChannel("phone"); setNotes("");
  };

  const toggleService = (s: string) => {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const addItem = () => setItems(prev => [...prev, { id: genId(), description: "", quantity: 1, unitPrice: "" }]);
  const removeItem = (id: number) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: number, field: keyof LineItem, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  return (
    <Dialog open={open} onOpenChange={open ? handleClose : undefined}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-100">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            New Job
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 mt-1">
            Log a job from any source — phone call, IKEA direct, referral, walk-in.
          </DialogDescription>
        </DialogHeader>

        {createdJob ? (
          /* ── Success state ─────────────────────────────────────── */
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Job Created!</p>
              <p className="text-sm text-zinc-500 mt-1">
                Reference <span className="font-mono font-bold text-zinc-800">{createdJob.referenceNo}</span> is now live.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
              <Button
                data-testid="button-view-created-job"
                className="flex-1 bg-black hover:bg-zinc-800 text-white text-sm gap-2"
                onClick={() => { setLocation(`/admin/quotes/${createdJob.id}`); handleClose(); }}
              >
                <ExternalLink className="w-4 h-4" /> View Job
              </Button>
              <Button
                data-testid="button-create-another-job"
                variant="outline"
                className="flex-1 text-sm"
                onClick={() => { setCreatedJob(null); resetForm(); }}
              >
                Add Another
              </Button>
            </div>
            <p className="text-xs text-zinc-400">
              Customer can track at:{" "}
              <a
                href={`/track/${createdJob.referenceNo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline font-mono"
              >
                /track/{createdJob.referenceNo}
              </a>
            </p>
          </div>
        ) : (
          /* ── Form ────────────────────────────────────────────────── */
          <div className="divide-y divide-zinc-100">

            {/* Customer */}
            <Section icon={<User className="w-4 h-4 text-zinc-500" />} title="Customer">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Name *</Label>
                  <Input
                    data-testid="input-customer-name"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="e.g. John Tan"
                    className="h-9 text-sm border-zinc-300"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Phone * (SG)</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 h-9 border border-r-0 border-zinc-300 rounded-l-md bg-zinc-50 text-sm text-zinc-500">+65</span>
                    <Input
                      data-testid="input-customer-phone"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="9123 4567"
                      className="h-9 text-sm border-zinc-300 rounded-l-none"
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* Job details */}
            <Section icon={<MapPin className="w-4 h-4 text-zinc-500" />} title="Job Details">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Service Address *</Label>
                  <Input
                    data-testid="input-service-address"
                    value={serviceAddress}
                    onChange={e => setServiceAddress(e.target.value)}
                    placeholder="Blk 123 Tampines St 86, #04-56, Singapore 520123"
                    className="h-9 text-sm border-zinc-300"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Services</Label>
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_OPTIONS.map(s => (
                      <button
                        key={s}
                        type="button"
                        data-testid={`chip-service-${s.toLowerCase().replace(/\W/g, "-")}`}
                        onClick={() => toggleService(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          services.includes(s)
                            ? "bg-black text-white border-black"
                            : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Schedule */}
            <Section icon={<Calendar className="w-4 h-4 text-zinc-500" />} title="Schedule">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Date (optional)</Label>
                  <Input
                    data-testid="input-scheduled-date"
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="h-9 text-sm border-zinc-300"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Time Window</Label>
                  <select
                    data-testid="select-time-window"
                    value={timeWindow}
                    onChange={e => setTimeWindow(e.target.value)}
                    disabled={!scheduledDate}
                    className="h-9 w-full px-3 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                  >
                    {TIME_WINDOWS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            {/* Line items */}
            <Section icon={<Package className="w-4 h-4 text-zinc-500" />} title="Items & Pricing">
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2" data-testid={`item-row-${idx}`}>
                    <Input
                      data-testid={`input-item-description-${idx}`}
                      value={item.description}
                      onChange={e => updateItem(item.id, "description", e.target.value)}
                      placeholder="e.g. IKEA Kallax shelf assembly"
                      className="h-9 flex-1 text-sm border-zinc-300"
                    />
                    <Input
                      data-testid={`input-item-qty-${idx}`}
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={e => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                      className="h-9 w-16 text-sm border-zinc-300 text-center"
                    />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                      <Input
                        data-testid={`input-item-price-${idx}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice}
                        onChange={e => updateItem(item.id, "unitPrice", e.target.value)}
                        placeholder="0"
                        className="h-9 w-24 pl-6 text-sm border-zinc-300"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  data-testid="button-add-item"
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 px-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add item
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">
                    Total (S$)
                    {calculatedTotal > 0 && (
                      <span className="ml-1 text-zinc-400">— auto: ${calculatedTotal.toFixed(2)}</span>
                    )}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                    <Input
                      data-testid="input-total"
                      type="number"
                      min={0}
                      step={0.01}
                      value={manualTotal}
                      onChange={e => setManualTotal(e.target.value)}
                      placeholder={calculatedTotal > 0 ? calculatedTotal.toFixed(2) : "0.00"}
                      className="h-9 pl-6 text-sm border-zinc-300"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Payment Status</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PAYMENT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`chip-payment-${opt.value}`}
                        onClick={() => setPaymentStatus(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          paymentStatus === opt.value
                            ? "bg-black text-white border-black"
                            : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Assignment */}
            <Section icon={<User className="w-4 h-4 text-zinc-500" />} title="Staff Assignment">
              <div>
                <Label className="text-xs text-zinc-500 mb-1.5 block">Assign to (optional)</Label>
                <select
                  data-testid="select-staff"
                  value={assignedStaffId}
                  onChange={e => setAssignedStaffId(e.target.value)}
                  className="h-9 w-full sm:max-w-xs px-3 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Unassigned —</option>
                  {staff.filter(s => s.role === "staff" || s.role === "admin").map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </Section>

            {/* Source & Notes */}
            <Section icon={<Clock className="w-4 h-4 text-zinc-500" />} title="Source & Notes">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">How did this job come in?</Label>
                  <div className="flex flex-wrap gap-2">
                    {SOURCE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`chip-source-${opt.value}`}
                        onClick={() => setSourceChannel(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          sourceChannel === opt.value
                            ? "bg-black text-white border-black"
                            : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Internal notes (optional)</Label>
                  <Textarea
                    data-testid="input-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Customer prefers morning, has lift access, 3rd floor..."
                    rows={2}
                    className="text-sm border-zinc-300 resize-none"
                  />
                </div>
              </div>
            </Section>

            {/* Footer actions */}
            <div className="px-6 py-4 flex items-center justify-end gap-3 bg-zinc-50/50">
              <Button
                variant="outline"
                data-testid="button-cancel-create-job"
                onClick={handleClose}
                className="h-9 px-4 text-sm"
              >
                Cancel
              </Button>
              <Button
                data-testid="button-submit-create-job"
                onClick={handleSubmit}
                disabled={createJob.isPending}
                className="h-9 px-5 text-sm bg-black hover:bg-zinc-800 text-white"
              >
                {createJob.isPending ? "Creating…" : "Create Job"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon, title, children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}
