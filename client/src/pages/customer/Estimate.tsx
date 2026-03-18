import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wrench, Scissors, Truck, MapPin, Search, Plus, Minus, Trash2, 
  ChevronRight, ChevronLeft, Check, ClipboardList, Camera, X, 
  Loader2, AlertCircle, Star, Package, ArrowRight, Navigation, Tag,
  CalendarDays, Clock, Sun, Sunset, Ban
} from "lucide-react";
import type { CatalogItem } from "@shared/schema";
import { computePricing, type PricingCatalogEntry } from "@shared/pricing";

type ServiceType = "install" | "dismantle" | "relocate";

interface LineItem {
  id: string;
  catalogItemId?: number;
  sku: string;
  name: string;
  category: string;
  serviceType: ServiceType;
  quantity: number;
  unitPrice: number;
  isCustom: boolean;
}

interface Floor {
  level: string;
  hasLift: boolean;
}

interface CatalogGroup {
  name: string;
  category: string;
  entries: { id: number; sku: string; serviceType: ServiceType; basePrice: string }[];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Singapore Address Autocomplete ──────────────────────────────────────────

interface AddressSuggestion {
  address: string;
  lat: number;
  lng: number;
}

function useAddressSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!query || query.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
        );
        const data = await res.json();
        function toTitle(s: string): string {
          return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        }
        const results = (data.results || []).slice(0, 6).map((r: any) => {
          const parts: string[] = [];
          if (r.BLK_NO && r.BLK_NO !== "NIL") parts.push(r.BLK_NO);
          if (r.ROAD_NAME && r.ROAD_NAME !== "NIL") parts.push(toTitle(r.ROAD_NAME));
          if (r.BUILDING && r.BUILDING !== "NIL") parts.push(toTitle(r.BUILDING));
          parts.push(`Singapore ${r.POSTAL}`);
          return {
            address: parts.join(", "),
            lat: parseFloat(r.LATITUDE),
            lng: parseFloat(r.LONGITUDE),
          };
        });
        setSuggestions(results);
      } catch { setSuggestions([]); }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);
  return { suggestions, loading };
}

function AddressInput({ value, onSelect, placeholder, label, required }: {
  value: string;
  onSelect: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string; label: string; required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { suggestions, loading } = useAddressSuggestions(value);
  useEffect(() => {
    function handler(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setShow(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <label className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 block mb-2">{label}{required && <span className="text-black ml-1">*</span>}</label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
        <input
          required={required}
          value={value}
          onChange={e => { onSelect(e.target.value); setShow(true); }}
          onFocus={() => setShow(true)}
          placeholder={placeholder || "Start typing an address…"}
          data-testid={`input-address-${label.toLowerCase().replace(/\s+/g, "-")}`}
          className="w-full pl-9 pr-4 py-3 bg-white border border-black/10 focus:border-black outline-none transition-all text-sm"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-black/30" />}
      </div>
      {show && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-0.5 left-0 right-0 bg-white border border-black/10 overflow-hidden">
          {suggestions.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => { onSelect(s.address, s.lat, s.lng); setShow(false); }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm border-b border-black/6 last:border-0 transition-colors"
            >{s.address}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Catalog grouping ────────────────────────────────────────────────────────

function groupCatalog(items: CatalogItem[]): CatalogGroup[] {
  const map: Record<string, CatalogGroup> = {};
  items.forEach(item => {
    const key = item.name.toLowerCase().trim();
    if (!map[key]) map[key] = { name: item.name, category: item.category || "", entries: [] };
    // Deduplicate by serviceType — keep only first entry per service type
    const alreadyHasType = map[key].entries.some(e => e.serviceType === item.serviceType);
    if (!alreadyHasType) {
      map[key].entries.push({ id: item.id, sku: item.sku || "", serviceType: item.serviceType as ServiceType, basePrice: item.basePrice });
    }
  });
  return Object.values(map);
}

function serviceBadge(s: ServiceType) {
  const map = { install: "border-black/20 text-black/60", dismantle: "border-black/20 text-black/60", relocate: "border-black/20 text-black/60" };
  return <span className={`text-[10px] font-black uppercase tracking-[0.08em] px-2 py-0.5 border ${map[s]}`}>{s}</span>;
}

// ── Main Wizard ─────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Services" },
  { num: 2, label: "Address" },
  { num: 3, label: "Items" },
  { num: 4, label: "Schedule" },
  { num: 5, label: "Review" },
];

const TIME_SLOTS = [
  { value: "09:00-12:00", label: "Morning", time: "9am – 12pm" },
  { value: "13:00-17:00", label: "Afternoon", time: "1pm – 5pm" },
];

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function EstimateWizard() {
  const [, setLocation] = useLocation();
  usePageTracker("/estimate");
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const wizardStartFired = useRef(false);
  useEffect(() => {
    if (wizardStartFired.current) return;
    wizardStartFired.current = true;
    trackEvent("wizard_start", "/estimate");
  }, []);

  // Step 1
  const [services, setServices] = useState<ServiceType[]>([]);
  // Step 2
  const [serviceAddress, setServiceAddress] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLatLng, setPickupLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLatLng, setDropoffLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState("");
  const [floors, setFloors] = useState<Floor[]>([{ level: "1", hasLift: true }]);
  const [accessDifficulty, setAccessDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  // Step 3
  const [items, setItems] = useState<LineItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogFocused, setCatalogFocused] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [photoDetecting, setPhotoDetecting] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [detectedPhotoUrl, setDetectedPhotoUrl] = useState<string>("");
  const [detectedCount, setDetectedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Step 4: Schedule — calendar
  const todayDate = new Date();
  const [calMonth, setCalMonth] = useState(todayDate.getMonth());   // 0-indexed
  const [calYear, setCalYear]   = useState(todayDate.getFullYear());
  const [slotDateStr, setSlotDateStr] = useState("");               // "yyyy-MM-dd"
  const [slotTime, setSlotTime] = useState("");
  // Step 5: Review / Contact
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const isRelocation = services.includes("relocate");

  // Fetch catalog
  const { data: catalogRaw } = useQuery<CatalogItem[]>({
    queryKey: ["/api/catalog"],
    queryFn: () => fetch("/api/catalog").then(r => r.json()),
  });

  // Fetch slot availability (blocked + held)
  const { data: slotAvailability } = useQuery<{
    blocked: { date: string; timeSlot: string | null }[];
    held: { date: string; timeSlot: string; quoteId: number }[];
  }>({
    queryKey: ["/api/slots/availability"],
    queryFn: () => fetch("/api/slots/availability").then(r => r.json()),
  });

  const isSlotTaken = (dateStr: string, timeSlot: string) => {
    if (!slotAvailability || !dateStr) return false;
    const blockedDay = slotAvailability.blocked.some(b => b.date === dateStr && (b.timeSlot === null || b.timeSlot === timeSlot));
    const heldSlot = slotAvailability.held.some(h => h.date === dateStr && h.timeSlot === timeSlot);
    return blockedDay || heldSlot;
  };

  const catalogGroups = useMemo(() => groupCatalog(catalogRaw || []), [catalogRaw]);

  const filteredGroups = useMemo(() => {
    if (!catalogSearch.trim()) return catalogGroups.slice(0, 10);
    const q = catalogSearch.toLowerCase();
    return catalogGroups.filter(g =>
      g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) ||
      g.entries.some(e => e.sku.toLowerCase().includes(q))
    );
  }, [catalogSearch, catalogGroups]);

  const showCatalogResults = catalogFocused || catalogSearch.trim().length > 0;


  // ── Auto-calculate route distance when both relocation addresses are set ──

  useEffect(() => {
    if (!isRelocation || !pickupAddress || !dropoffAddress) return;
    setDistanceLoading(true);
    setDistanceError("");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupAddress,
            dropoffAddress,
            pickupLat: pickupLatLng?.lat,
            pickupLng: pickupLatLng?.lng,
            dropoffLat: dropoffLatLng?.lat,
            dropoffLng: dropoffLatLng?.lng,
          }),
        });
        const data = await res.json();
        setDistanceKm(data.distanceKm ?? 0);
        if (!data.routeFound) setDistanceError(data.error || "Could not calculate distance");
      } catch {
        setDistanceKm(0);
        setDistanceError("Distance service unavailable");
      } finally {
        setDistanceLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [pickupAddress, dropoffAddress, pickupLatLng, dropoffLatLng, isRelocation]);

  // ── Pricing computation (central engine) ──────────────────────────────────

  const catalogEntries = useMemo<PricingCatalogEntry[]>(() =>
    (catalogRaw || []).map(c => ({
      name: c.name,
      serviceType: c.serviceType as "install" | "dismantle" | "relocate",
      basePrice: parseFloat(c.basePrice),
    })),
    [catalogRaw]
  );

  const pricingResult = useMemo(() => computePricing({
    items: items.map(i => ({
      name: i.name,
      serviceType: i.serviceType,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    needsRelocation: isRelocation,
    floors: floors.map(f => ({ level: parseInt(f.level) || 0, hasLift: f.hasLift })),
    accessDifficulty,
    distanceKm,
    catalogEntries,
  }), [items, isRelocation, floors, accessDifficulty, distanceKm, catalogEntries]);

  const subtotal = pricingResult.laborSubtotal;
  const total = pricingResult.grandTotal;
  const deposit = pricingResult.depositAmount;
  const finalAmt = pricingResult.finalAmount;

  // ── Catalog add ───────────────────────────────────────────────────────────

  const addCatalogGroup = (group: CatalogGroup, qty: number = 1) => {
    const relevant = group.entries.filter(e => services.includes(e.serviceType));
    setItems(prev => {
      let updated = [...prev];
      if (relevant.length === 0) {
        // No matching service variants — add as custom for each selected service
        services.forEach(st => {
          updated.push({ id: uid(), sku: "", name: group.name, category: group.category, serviceType: st, quantity: qty, unitPrice: 0, isCustom: true });
        });
      } else {
        // Add ALL matching service variants (one line per selected service type)
        relevant.forEach(entry => {
          const existing = updated.find(i => i.catalogItemId === entry.id);
          if (existing) {
            updated = updated.map(i => i.catalogItemId === entry.id ? { ...i, quantity: i.quantity + qty } : i);
          } else {
            updated.push({ id: uid(), catalogItemId: entry.id, sku: entry.sku, name: group.name, category: group.category, serviceType: entry.serviceType, quantity: qty, unitPrice: parseFloat(entry.basePrice), isCustom: false });
          }
        });
      }
      return updated;
    });
    setCatalogSearch("");
    setCatalogFocused(false);
  };

  // ── Paste parsing ─────────────────────────────────────────────────────────

  const applyPaste = () => {
    const lines = pasteText.trim().split("\n").filter(l => l.trim());
    const newItems: LineItem[] = [];
    lines.forEach(line => {
      const t = line.trim();
      let qty = 1, itemName = t;
      const frontM = t.match(/^(\d+)\s+(.+)$/);
      const backM = t.match(/^(.+?)\s+[x×]\s*(\d+)$/i);
      if (frontM) { qty = parseInt(frontM[1]); itemName = frontM[2].trim(); }
      else if (backM) { itemName = backM[1].trim(); qty = parseInt(backM[2]); }

      const lc = itemName.toLowerCase();
      const matched = catalogGroups.find(g => {
        const gn = g.name.toLowerCase();
        return gn.includes(lc) || lc.includes(gn) || gn.split(" ").slice(0, 2).join(" ") === lc.split(" ").slice(0, 2).join(" ");
      });
      if (matched) {
        const relevant = matched.entries.filter(e => services.includes(e.serviceType));
        relevant.forEach(entry => {
          newItems.push({ id: uid(), catalogItemId: entry.id, sku: entry.sku, name: matched.name, category: matched.category, serviceType: entry.serviceType, quantity: qty, unitPrice: parseFloat(entry.basePrice), isCustom: false });
        });
      } else {
        services.forEach(st => {
          newItems.push({ id: uid(), sku: "", name: itemName, category: "Custom", serviceType: st, quantity: qty, unitPrice: 0, isCustom: true });
        });
      }
    });
    setItems(prev => [...prev, ...newItems]);
    setPasteText("");
    setShowPaste(false);
  };

  // ── Photo AI detection ────────────────────────────────────────────────────

  // Compress image via canvas and return { base64, thumbnail, mimeType }
  async function compressImage(file: File, maxPx = 1024, thumbPx = 320): Promise<{ base64: string; thumbnail: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        // Full size for detection (max 1024px)
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const full = canvas.toDataURL("image/jpeg", 0.8);

        // Thumbnail for storing in DB (max 320px)
        const tScale = Math.min(1, thumbPx / Math.max(img.width, img.height));
        const tCanvas = document.createElement("canvas");
        tCanvas.width = Math.round(img.width * tScale);
        tCanvas.height = Math.round(img.height * tScale);
        tCanvas.getContext("2d")!.drawImage(img, 0, 0, tCanvas.width, tCanvas.height);
        const thumb = tCanvas.toDataURL("image/jpeg", 0.7);

        resolve({ base64: full.split(",")[1], thumbnail: thumb, mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setPhotoDetecting(true);
    setPhotoError("");

    try {
      const { base64, thumbnail, mimeType } = await compressImage(file, 1536);

      const res = await fetch("/api/catalog/detect-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Detection failed");

      const detected: { name: string; quantity: number }[] = data.detected || [];

      if (detected.length === 0) {
        setPhotoError("No furniture detected — try a clearer photo or add items manually.");
      } else {
        // Stem a word: "desks" → "desk", "cabinets" → "cabinet"
        const stem = (w: string) => w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w;

        const fuzzyMatch = (detected: string, catalog: string): boolean => {
          const d = detected.toLowerCase();
          const c = catalog.toLowerCase();
          // 1. Direct substring match
          if (c.includes(d) || d.includes(c)) return true;
          // 2. Word-level match: any significant word from detected appears in catalog name (with stemming)
          const words = d.split(/\s+/).filter(w => w.length > 3).map(stem);
          return words.some(w => c.includes(w) || c.includes(stem(w)));
        };

        let matchCount = 0;
        detected.forEach(({ name, quantity }) => {
          const matched = catalogGroups.find(g => fuzzyMatch(name, g.name));
          if (matched) {
            addCatalogGroup(matched, quantity || 1);
            matchCount++;
          } else {
            services.forEach(st => {
              setItems(prev => [...prev, {
                id: uid(), sku: "", name, category: "Custom",
                serviceType: st, quantity: quantity || 1, unitPrice: 0, isCustom: true,
              }]);
            });
            matchCount++;
          }
        });
        setDetectedPhotoUrl(thumbnail);
        setDetectedCount(matchCount);
      }
    } catch (err: any) {
      console.error("Photo detection error:", err);
      setPhotoError(err.message || "Detection failed — please add items manually.");
    } finally {
      setPhotoDetecting(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");
    try {
      // Use effective unit prices from pricing engine (includes fallbacks for unpriced items)
      const effectivePriceMap = new Map<string, number>();
      pricingResult.itemLines.forEach(line => {
        effectivePriceMap.set(`${line.name}|${line.serviceType}`, line.unitPrice);
      });

      const body = {
        customer: { name, email, phone },
        selectedServices: services,
        serviceAddress: isRelocation ? pickupAddress : serviceAddress,
        pickupAddress: isRelocation ? pickupAddress : undefined,
        dropoffAddress: isRelocation ? dropoffAddress : undefined,
        accessDifficulty: isRelocation ? accessDifficulty : undefined,
        floorsInfo: isRelocation ? JSON.stringify(floors) : undefined,
        items: items.map(i => ({
          catalogItemId: i.catalogItemId,
          quantity: i.quantity,
          serviceType: i.serviceType,
          unitPrice: effectivePriceMap.get(`${i.name}|${i.serviceType}`) ?? i.unitPrice,
          itemName: i.name,
          sku: i.sku,
        })),
        customItems: [],
        logisticsFee: pricingResult.logisticsSubtotal,
        discount: pricingResult.discountAmount,
        distanceKm: distanceKm > 0 ? distanceKm : undefined,
        detectedPhotoUrl: detectedPhotoUrl || undefined,
        preferredDate: slotDateStr || undefined,
        preferredTimeWindow: slotTime || undefined,
      };
      const res = await fetch("/api/quotes/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Submission failed"); }
      const quote = await res.json();

      // Google Ads conversion tracking — fires on successful estimate submission only
      try {
        (window as any).gtag?.("event", "conversion", {
          send_to: "AW-18012639714/zTxuCNC63IccEOKjjI1D",
          value: 1.0,
          currency: "SGD",
        });
      } catch (_) {}
      trackEvent("wizard_submit", "/estimate");

      setLocation(`/quotes/${quote.id}`);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit. Please try again.");
      setIsSubmitting(false);
    }
  };

  // ── Navigation guards ─────────────────────────────────────────────────────

  const canNext = () => {
    if (step === 1) return services.length > 0;
    if (step === 2) return isRelocation ? (pickupAddress.length > 2 && dropoffAddress.length > 2) : serviceAddress.length > 2;
    if (step === 3) return items.length > 0;
    if (step === 4) return slotDateStr.length > 0 && slotTime.length > 0 && !isSlotTaken(slotDateStr, slotTime);
    return false;
  };

  const next = () => setStep(s => Math.min(s + 1, 5) as 1 | 2 | 3 | 4 | 5);
  const back = () => setStep(s => Math.max(s - 1, 1) as 1 | 2 | 3 | 4 | 5);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="min-h-screen pt-16 pb-20 bg-white">
      {/* Step indicator */}
      <div className="sticky top-16 z-40 bg-white border-b border-black/10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                  step > s.num ? "bg-black text-white" :
                  step === s.num ? "bg-black text-white" :
                  "bg-black/[0.05] text-black/25"
                }`}>
                  {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.12em] hidden sm:block transition-colors ${step === s.num ? "text-black" : "text-black/30"}`}>{s.label}</span>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px transition-colors ${step > s.num ? "bg-black/30" : "bg-black/[0.08]"}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>

            {/* ── STEP 1: Select Services ── */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35 mb-3">Step 1 of 5</p>
                  <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">What do you need?</h2>
                  <p className="text-sm text-black/45">Select one or more services — you can mix and match.</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {([
                    {
                      type: "install" as ServiceType,
                      icon: <Wrench className="w-6 h-6" />,
                      label: "Installation",
                      desc: "Assemble and install furniture at your location",
                    },
                    {
                      type: "dismantle" as ServiceType,
                      icon: <Scissors className="w-6 h-6" />,
                      label: "Dismantling",
                      desc: "Carefully take apart and pack existing furniture",
                    },
                    {
                      type: "relocate" as ServiceType,
                      icon: <Truck className="w-6 h-6" />,
                      label: "Relocation / Move",
                      desc: "Move furniture between locations — pickup & delivery",
                    },
                  ]).map(({ type, icon, label, desc }) => {
                    const active = services.includes(type);
                    return (
                      <button
                        key={type}
                        data-testid={`service-${type}`}
                        onClick={() => setServices(prev => active ? prev.filter(s => s !== type) : [...prev, type])}
                        className={`group relative border p-5 text-left transition-all duration-150 ${
                          active ? "border-black bg-black/[0.025]" : "border-black/10 bg-white hover:border-black/30 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 flex items-center justify-center flex-shrink-0 transition-colors ${
                            active ? "bg-black text-white" : "bg-black/[0.05] text-black/50"
                          }`}>
                            {icon}
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-base uppercase tracking-[0.04em]">{label}</p>
                            <p className="text-sm text-black/45 mt-0.5">{desc}</p>
                          </div>
                          <div className={`w-5 h-5 border flex items-center justify-center shrink-0 mt-1 transition-all ${
                            active ? "bg-black border-black" : "border-black/20"
                          }`}>
                            {active && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {services.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {services.map(s => (
                      <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1 border border-black/15 text-black bg-black/[0.03] text-xs font-black uppercase tracking-[0.08em]">
                        <Check className="w-3 h-3" /> {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Address ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35 mb-3">Step 2 of 5</p>
                  <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">
                    {isRelocation ? "Pickup & Dropoff" : "Service Location"}
                  </h2>
                  <p className="text-sm text-black/45">
                    {isRelocation ? "Where should we pick up and deliver?" : "Where will the work take place?"}
                  </p>
                </div>
                <div className="bg-white border border-black/10 p-6 space-y-5">
                  {isRelocation ? (
                    <>
                      <AddressInput required label="Pickup Address" value={pickupAddress}
                        onSelect={(addr, lat, lng) => {
                          setPickupAddress(addr);
                          if (lat && lng) setPickupLatLng({ lat, lng });
                          else setPickupLatLng(null);
                        }}
                        placeholder="e.g. 100 Beach Road Singapore 189702" />
                      <AddressInput required label="Dropoff Address" value={dropoffAddress}
                        onSelect={(addr, lat, lng) => {
                          setDropoffAddress(addr);
                          if (lat && lng) setDropoffLatLng({ lat, lng });
                          else setDropoffLatLng(null);
                        }}
                        placeholder="e.g. 10 Bayfront Ave Singapore 018956" />

                      {/* Route distance badge */}
                      {pickupAddress && dropoffAddress && (
                        <div className={`flex items-center gap-2 px-4 py-2.5 text-sm border ${
                          distanceLoading ? "border-black/10 bg-black/[0.025] text-black/40" :
                          distanceKm > 0 ? "border-black/15 bg-black/[0.025] text-black/70" :
                          distanceError ? "border-black/15 bg-black/[0.025] text-black/60" : "border-black/10 bg-black/[0.025] text-black/40"
                        }`}>
                          {distanceLoading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Calculating route distance…</>
                            : distanceKm > 0
                              ? <><Navigation className="w-4 h-4" /> Route distance: <strong>{distanceKm} km</strong> — transport fee will be calculated</>
                              : distanceError
                                ? <><AlertCircle className="w-4 h-4" /> {distanceError} — transport fee will be reviewed</>
                                : null
                          }
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-3">Floor details <span className="text-black/25 font-normal normal-case tracking-normal">(affects pricing)</span></p>
                        {floors.map((floor, i) => (
                          <div key={i} className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-xs text-black/40 w-12 shrink-0 font-black uppercase">Floor {i + 1}</span>
                              <input
                                type="number" min="1" max="50"
                                value={floor.level}
                                onChange={e => setFloors(prev => prev.map((f, fi) => fi === i ? { ...f, level: e.target.value } : f))}
                                className="w-20 px-3 py-2 bg-white border border-black/10 text-center outline-none focus:border-black text-sm"
                                data-testid={`input-floor-level-${i}`}
                              />
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer text-black/60">
                              <input type="checkbox" checked={floor.hasLift}
                                onChange={e => setFloors(prev => prev.map((f, fi) => fi === i ? { ...f, hasLift: e.target.checked } : f))}
                                className="w-4 h-4 accent-black"
                              />
                              Has lift
                            </label>
                            {floors.length > 1 && (
                              <button onClick={() => setFloors(prev => prev.filter((_, fi) => fi !== i))} className="text-black/30 hover:text-black hover:bg-slate-100 p-1.5 transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setFloors(prev => [...prev, { level: "1", hasLift: true }])}
                          className="text-[10px] font-black uppercase tracking-[0.1em] text-black/40 hover:text-black flex items-center gap-1 transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Add floor
                        </button>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-3">Access difficulty</p>
                        <div className="flex gap-2">
                          {(["easy", "medium", "hard"] as const).map(d => (
                            <button key={d} data-testid={`difficulty-${d}`}
                              onClick={() => setAccessDifficulty(d)}
                              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-[0.08em] capitalize transition-all border ${
                                accessDifficulty === d ? "border-black bg-black/[0.03] text-black" : "border-black/10 bg-white text-black/40 hover:border-black/30 hover:bg-slate-50"
                              }`}
                            >{d}</button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <AddressInput required label="Service Address" value={serviceAddress} onSelect={(addr) => setServiceAddress(addr)} placeholder="e.g. 100 Beach Road Singapore 189702" />
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 3: Items ── */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35 mb-3">Step 3 of 5</p>
                  <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">Add Your Items</h2>
                  <p className="text-sm text-black/45">Search our catalog, paste a list, or upload a photo.</p>
                </div>

                {/* Catalog Search */}
                <div className="bg-white border border-black/10 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-3 flex items-center gap-2"><Search className="w-3.5 h-3.5" /> Search Catalog</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/25 pointer-events-none" />
                    <input
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      onFocus={() => setCatalogFocused(true)}
                      onBlur={() => { setTimeout(() => setCatalogFocused(false), 150); }}
                      placeholder="Search items e.g. wardrobe, bed, sofa…"
                      data-testid="input-catalog-search"
                      autoComplete="off"
                      className="w-full pl-9 pr-10 py-3 bg-white border border-black/10 focus:border-black transition-all outline-none text-sm"
                    />
                    {catalogSearch && (
                      <button onClick={() => setCatalogSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {showCatalogResults && (
                    <div className="mt-2 border border-black/10 overflow-hidden">
                      {filteredGroups.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-black/40">
                          No items found for <strong>"{catalogSearch}"</strong>
                        </div>
                      ) : (
                        <>
                          {!catalogSearch.trim() && (
                            <div className="px-4 py-2 bg-black/[0.02] border-b border-black/8">
                              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-black/35">Popular items — tap to add</p>
                            </div>
                          )}
                          {filteredGroups.map(group => (
                            <button
                              key={group.name}
                              onClick={() => { addCatalogGroup(group, 1); setCatalogSearch(""); setCatalogFocused(false); }}
                              data-testid={`catalog-item-${group.name.toLowerCase().replace(/\s+/g, "-")}`}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 border-b border-black/6 last:border-0 transition-colors flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{group.name}</p>
                                <p className="text-xs text-black/35">{group.category}</p>
                              </div>
                              <div className="text-right shrink-0 space-y-0.5">
                                {group.entries.filter(e => services.includes(e.serviceType)).map(e => (
                                  <div key={e.id} className="flex items-center gap-2 justify-end">
                                    {serviceBadge(e.serviceType)}
                                    <span className="text-xs font-bold">${e.basePrice}</span>
                                  </div>
                                ))}
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Photo Upload */}
                <div className="bg-white border border-black/10 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-3 flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5" /> AI Photo Detection
                    <span className="text-black/25 font-normal normal-case tracking-normal">(optional)</span>
                  </p>
                  <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />

                  {/* Success state — thumbnail + re-scan option */}
                  {detectedPhotoUrl && !photoDetecting ? (
                    <div className="flex items-start gap-4">
                      <img src={detectedPhotoUrl} alt="detected" className="w-20 h-20 object-cover border border-black/15 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-black text-black flex items-center gap-1.5 mb-1">
                          <Check className="w-4 h-4" /> {detectedCount} item{detectedCount !== 1 ? 's' : ''} detected
                        </p>
                        <p className="text-xs text-black/40 mb-2">Items added below. Review and adjust quantities.</p>
                        <button onClick={() => { setDetectedPhotoUrl(""); setDetectedCount(0); fileInputRef.current?.click(); }}
                          className="text-[10px] font-black uppercase tracking-[0.1em] text-black/50 hover:text-black transition-colors">
                          Scan another photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                      disabled={photoDetecting}
                      data-testid="button-upload-photo"
                      className="w-full border border-dashed border-black/20 py-5 flex flex-col items-center gap-2 hover:border-black/40 hover:bg-slate-50 transition-all text-black/35 hover:text-black/60 disabled:opacity-60"
                    >
                      {photoDetecting
                        ? <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-black">Scanning photo with AI…</span><span className="text-xs">This may take a few seconds</span></>
                        : <><Camera className="w-7 h-7" /><span className="text-sm font-black">Take or upload a photo</span><span className="text-xs">AI will identify your furniture automatically</span></>
                      }
                    </button>
                  )}

                  {photoError && (
                    <p className="text-sm text-black/60 mt-3 flex items-center gap-1.5 border border-black/15 px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />{photoError}
                    </p>
                  )}
                </div>

                {/* Paste List */}
                <div className="bg-white border border-black/10 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 flex items-center gap-2"><ClipboardList className="w-3.5 h-3.5" /> Paste Item List <span className="text-black/25 font-normal normal-case tracking-normal">(optional)</span></p>
                    <button onClick={() => setShowPaste(s => !s)} className="text-[10px] font-black uppercase tracking-[0.1em] text-black/40 hover:text-black transition-colors">{showPaste ? "Close" : "Open"}</button>
                  </div>
                  {showPaste && (
                    <div className="space-y-3">
                      <textarea
                        value={pasteText}
                        onChange={e => setPasteText(e.target.value)}
                        rows={5}
                        placeholder={"2 queen bed\n6 office chair\n1 dining table"}
                        data-testid="input-paste-list"
                        className="w-full px-4 py-3 bg-white border border-black/10 focus:border-black outline-none resize-none text-sm font-mono"
                      />
                      <p className="text-xs text-black/35">One item per line. Format: "2 queen bed" or "dining table x4"</p>
                      <button onClick={applyPaste} disabled={!pasteText.trim()}
                        data-testid="button-apply-paste"
                        className="bg-black text-white px-5 py-2.5 text-xs font-black uppercase tracking-[0.1em] disabled:opacity-50 hover:bg-neutral-800 transition-colors">
                        Add Items
                      </button>
                    </div>
                  )}
                </div>

                {/* Items list */}
                {items.length > 0 && (
                  <div className="bg-white border border-black/10 overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
                      <p className="font-black text-sm flex items-center gap-2 uppercase tracking-[0.06em]"><Package className="w-4 h-4 text-black/40" /> Items ({items.length})</p>
                      <p className="font-black text-sm">${subtotal.toFixed(2)}</p>
                    </div>
                    <div className="divide-y divide-black/6">
                      {items.map(item => (
                        <div key={item.id} data-testid={`item-${item.id}`} className="px-5 py-4 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-semibold text-sm truncate">{item.name}</p>
                              {item.sku && <span className="text-[10px] border border-black/10 px-2 py-0.5 font-mono text-black/40">{item.sku}</span>}
                              {item.isCustom && <span className="text-[10px] border border-black/15 px-2 py-0.5 font-black uppercase tracking-[0.06em] text-black/50">Custom</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {serviceBadge(item.serviceType)}
                              {item.category && <span className="text-xs text-black/35">{item.category}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setItems(prev => prev.map(i => i.id === item.id && i.quantity > 1 ? { ...i, quantity: i.quantity - 1 } : i))}
                              data-testid={`button-decrease-${item.id}`}
                              className="w-7 h-7 border border-black/10 flex items-center justify-center hover:bg-slate-50 transition-colors">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm font-black">{item.quantity}</span>
                            <button onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}
                              data-testid={`button-increase-${item.id}`}
                              className="w-7 h-7 border border-black/10 flex items-center justify-center hover:bg-slate-50 transition-colors">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-right w-20">
                            <p className="font-black text-sm">${(item.unitPrice * item.quantity).toFixed(2)}</p>
                            <p className="text-xs text-black/35">${item.unitPrice.toFixed(2)} ea</p>
                          </div>
                          <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                            data-testid={`button-remove-${item.id}`}
                            className="text-black/25 hover:text-black p-1.5 hover:bg-slate-100 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-4 bg-black/[0.025] space-y-1.5 text-sm border-t border-black/8">
                      <div className="flex justify-between text-black/45"><span>Labor subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {pricingResult.discountLine && (
                        <div className="flex justify-between text-black/60 font-medium">
                          <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" />{pricingResult.discountLine.label}</span>
                          <span>-${pricingResult.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {pricingResult.feeLines.map((fee, i) => (
                        <div key={i} className="flex justify-between text-black/45">
                          <span>{fee.label}</span><span>+${fee.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-black text-base pt-1.5 border-t border-black/10 mt-2">
                        <span className="uppercase tracking-[0.06em] text-sm">Estimated Total</span><span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {items.length === 0 && (
                  <div className="border border-dashed border-black/20 p-10 text-center text-black/35">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-black text-sm uppercase tracking-[0.06em]">No items yet — search above or paste a list</p>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 4: Schedule ── */}
            {step === 4 && (() => {
              // Calendar grid helpers
              const todayStr = toDateStr(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
              const firstWeekday = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
              const leadingBlanks = (firstWeekday + 6) % 7;                // shift to Mon=0
              const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
              const cells: (number | null)[] = [
                ...Array(leadingBlanks).fill(null),
                ...Array.from({ length: totalDays }, (_, i) => i + 1),
              ];
              while (cells.length % 7 !== 0) cells.push(null);
              const monthLabel = new Date(calYear, calMonth, 1).toLocaleString("en-SG", { month: "long", year: "numeric" });

              const prevMonth = () => {
                const d = new Date(calYear, calMonth - 1, 1);
                if (d >= new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)) {
                  setCalMonth(d.getMonth()); setCalYear(d.getFullYear());
                }
              };
              const nextMonth = () => {
                const d = new Date(calYear, calMonth + 1, 1);
                const cap = new Date(todayDate.getFullYear(), todayDate.getMonth() + 4, 1);
                if (d < cap) { setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }
              };

              const getSlotStatus = (ds: string) => {
                const m = isSlotTaken(ds, "09:00-12:00");
                const a = isSlotTaken(ds, "13:00-17:00");
                if (m && a) return "full";
                if (m || a) return "partial";
                return "available";
              };

              return (
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35 mb-3">Step 4 of 5</p>
                    <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">Pick a Slot</h2>
                    <p className="text-sm text-black/45">Tap a date, then choose morning or afternoon.</p>
                  </div>

                  {/* Calendar card */}
                  <div className="bg-white border border-black/10 p-4 space-y-3">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between px-1">
                      <button onClick={prevMonth} data-testid="button-cal-prev"
                        className="p-2 hover:bg-slate-100 transition-colors text-black/40 hover:text-black">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <p className="font-black text-sm uppercase tracking-[0.08em]">{monthLabel}</p>
                      <button onClick={nextMonth} data-testid="button-cal-next"
                        className="p-2 hover:bg-slate-100 transition-colors text-black/40 hover:text-black">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 text-center">
                      {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => (
                        <div key={d} className="text-[10px] font-black text-black/30 py-1 uppercase">{d}</div>
                      ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-0.5">
                      {cells.map((day, i) => {
                        if (!day) return <div key={`e-${i}`} />;
                        const ds = toDateStr(calYear, calMonth, day);
                        const past = ds < todayStr;
                        const status = past ? "past" : getSlotStatus(ds);
                        const isSelected = ds === slotDateStr;
                        const isToday = ds === todayStr;

                        return (
                          <button
                            key={ds}
                            data-testid={`button-cal-${ds}`}
                            disabled={past || status === "full"}
                            onClick={() => { setSlotDateStr(ds); setSlotTime(""); }}
                            className={[
                              "relative flex flex-col items-center justify-center h-10 text-sm font-medium transition-all select-none",
                              isSelected
                                ? "bg-black text-white font-black"
                                : status === "full"
                                  ? "bg-black/[0.03] text-black/20 cursor-not-allowed line-through text-xs"
                                  : past
                                    ? "text-black/15 cursor-not-allowed"
                                    : "hover:bg-slate-100 hover:text-black cursor-pointer text-black/70",
                              isToday && !isSelected ? "ring-1 ring-black/25" : "",
                            ].join(" ")}
                          >
                            {day}
                            {/* Availability dot */}
                            {!past && !isSelected && status === "partial" && (
                              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-black/30" />
                            )}
                            {!past && !isSelected && status === "available" && (
                              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-black/20" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 pt-2 border-t border-black/8 text-[10px] text-black/35 font-black uppercase tracking-[0.08em]">
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-black/20 shrink-0" /> Available</span>
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-black/30 shrink-0" /> Partial</span>
                      <span className="flex items-center gap-1.5 opacity-40 line-through">31</span>
                      <span className="opacity-40">Full</span>
                    </div>
                  </div>

                  {/* Time slot picker — shown once a date is selected */}
                  {slotDateStr ? (
                    <div className="bg-white border border-black/10 p-5 space-y-4">
                      <p className="font-black text-sm flex items-center gap-2 uppercase tracking-[0.06em]">
                        <Clock className="w-4 h-4 text-black/40" />
                        {new Date(slotDateStr + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {TIME_SLOTS.map(slot => {
                          const taken = isSlotTaken(slotDateStr, slot.value);
                          const sel = slotTime === slot.value;
                          return (
                            <button key={slot.value} disabled={taken}
                              onClick={() => !taken && setSlotTime(slot.value)}
                              data-testid={`button-slot-${slot.value}`}
                              className={[
                                "relative flex flex-col items-center gap-1.5 py-5 border transition-all",
                                taken ? "border-black/5 bg-black/[0.02] text-black/20 cursor-not-allowed opacity-50"
                                  : sel ? "border-black bg-black text-white"
                                  : "border-black/10 bg-white hover:border-black/30 hover:bg-slate-50 cursor-pointer",
                              ].join(" ")}
                            >
                              {slot.value === "09:00-12:00" ? <Sun className={`w-6 h-6 ${sel ? "text-white" : "text-black/40"}`} /> : <Sunset className={`w-6 h-6 ${sel ? "text-white" : "text-black/40"}`} />}
                              <span className={`font-black text-sm uppercase tracking-[0.06em] ${sel ? "text-white" : "text-black"}`}>{slot.label}</span>
                              <span className={`text-xs ${sel ? "text-white/70" : "text-black/35"}`}>{slot.time}</span>
                              {taken && <span className="absolute top-2 right-2 text-[10px] text-black/25 flex items-center gap-0.5 font-black uppercase"><Ban className="w-2.5 h-2.5" />Full</span>}
                              {sel && !taken && <span className="absolute top-2 right-2 text-[10px] text-white/70 flex items-center gap-0.5 font-black uppercase"><Check className="w-2.5 h-2.5" />OK</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-black/20 p-6 text-center text-black/35 text-sm">
                      <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="font-black uppercase tracking-[0.06em] text-xs">Select a date above</p>
                    </div>
                  )}

                  {/* Confirmation banner */}
                  {slotDateStr && slotTime && !isSlotTaken(slotDateStr, slotTime) && (
                    <div className="border border-black/12 bg-black/[0.02] p-4 flex items-start gap-3">
                      <Check className="w-4 h-4 text-black shrink-0 mt-0.5" />
                      <div>
                        <p className="font-black text-sm uppercase tracking-[0.06em]">Slot Available</p>
                        <p className="text-sm text-black/60 mt-0.5">
                          {new Date(slotDateStr + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short", year: "numeric" })},&nbsp;{TIME_SLOTS.find(t => t.value === slotTime)?.time}
                        </p>
                        <p className="text-xs text-black/35 mt-1">Held for 48 hours once your quote is submitted.</p>
                      </div>
                    </div>
                  )}

                  <div className="border border-black/10 bg-black/[0.015] px-4 py-3">
                    <p className="text-xs text-black/50">
                      <strong>Note:</strong> This is your <em>preferred</em> slot — our team confirms it after deposit is paid.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* ── STEP 5: Review ── */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35 mb-3">Step 5 of 5</p>
                  <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">Your Details</h2>
                  <p className="text-sm text-black/45">Review your estimate and enter your contact info.</p>
                </div>

                {/* Customer details form */}
                <div className="bg-white border border-black/10 p-6 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40">Contact Information</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.12em] text-black/40 mb-1.5 block">Full Name <span className="text-black">*</span></label>
                      <input required value={name} onChange={e => setName(e.target.value)} data-testid="input-name"
                        placeholder="Ahmad Bin Ismail" className="w-full px-4 py-3 bg-white border border-black/10 focus:border-black outline-none transition-all text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.12em] text-black/40 mb-1.5 block">Phone <span className="text-black">*</span></label>
                      <input required value={phone} onChange={e => setPhone(e.target.value)} data-testid="input-phone"
                        placeholder="+65 8123 4567" className="w-full px-4 py-3 bg-white border border-black/10 focus:border-black outline-none transition-all text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.12em] text-black/40 mb-1.5 block">Email <span className="text-black">*</span></label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email"
                      placeholder="ahmadismail@gmail.com" className="w-full px-4 py-3 bg-white border border-black/10 focus:border-black outline-none transition-all text-sm" />
                  </div>
                </div>

                {/* Slot summary */}
                {slotDateStr && slotTime && (
                  <div className="border border-black/10 bg-black/[0.02] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/40 mb-3">Preferred Appointment Slot</p>
                    <div className="flex items-center gap-2 font-black text-sm text-black">
                      <CalendarDays className="w-4 h-4 text-black/40" />
                      {new Date(slotDateStr + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-black/50 mt-1.5">
                      <Clock className="w-4 h-4 text-black/30" />
                      {TIME_SLOTS.find(t => t.value === slotTime)?.label} — {TIME_SLOTS.find(t => t.value === slotTime)?.time}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-white border border-black/10 overflow-hidden">
                  <div className="px-5 py-4 border-b border-black/8 flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-black/40" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/50">Estimate Summary</p>
                  </div>
                  <div className="px-5 py-4 space-y-4 divide-y divide-black/6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35 mb-2">Services</p>
                      <div className="flex flex-wrap gap-2">
                        {services.map(s => (
                          <span key={s} className="capitalize border border-black/15 px-3 py-1 text-xs font-black uppercase tracking-[0.06em] text-black">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35 mb-2">Location</p>
                      {isRelocation ? (
                        <div className="space-y-1 text-sm text-black/70">
                          <p className="flex gap-2"><span className="font-black text-black/40 w-16 shrink-0 uppercase text-[10px] tracking-[0.08em]">Pickup</span><span>{pickupAddress}</span></p>
                          <p className="flex gap-2"><span className="font-black text-black/40 w-16 shrink-0 uppercase text-[10px] tracking-[0.08em]">Dropoff</span><span>{dropoffAddress}</span></p>
                        </div>
                      ) : (
                        <p className="text-sm text-black/70">{serviceAddress}</p>
                      )}
                    </div>
                    <div className="pt-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35 mb-3">Items ({items.length})</p>
                      <div className="space-y-2">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {serviceBadge(item.serviceType)}
                              <span className="text-black/70">{item.name} ×{item.quantity}</span>
                              {item.isCustom && <span className="text-xs text-black/30">(TBD)</span>}
                            </div>
                            <span className="font-black text-sm">{item.isCustom ? "TBD" : `$${(item.unitPrice * item.quantity).toFixed(2)}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 space-y-2 text-sm">
                      <div className="flex justify-between text-black/45"><span>Labor subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {pricingResult.discountLine && (
                        <div className="flex justify-between text-black/60 font-medium">
                          <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" />{pricingResult.discountLine.label}</span>
                          <span>−${pricingResult.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {pricingResult.feeLines.map((fee, i) => (
                        <div key={i} className="flex justify-between text-black/45">
                          <span>{fee.label}</span><span>+${fee.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      {isRelocation && distanceKm > 0 && (
                        <div className="flex justify-between text-black/50 text-xs mt-1">
                          <span className="flex items-center gap-1"><Navigation className="w-3 h-3" /> Route distance</span>
                          <span>{distanceKm} km</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-base pt-2 border-t border-black/10">
                        <span className="uppercase tracking-[0.06em] text-sm">Grand Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-black/45"><span>Deposit due now (50%)</span><span className="font-black">${deposit.toFixed(2)}</span></div>
                      <div className="flex justify-between text-black/45"><span>Balance on completion (50%)</span><span>${finalAmt.toFixed(2)}</span></div>
                      {pricingResult.requiresAdminReview && (
                        <div className="mt-2 flex items-start gap-2 border border-black/10 bg-black/[0.015] px-3 py-2">
                          <AlertCircle className="w-4 h-4 text-black/40 shrink-0 mt-0.5" />
                          <p className="text-xs text-black/55">This quote includes items requiring admin review — final pricing may be adjusted.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {submitError && (
                  <div className="border border-black/15 bg-black/[0.03] px-4 py-3 flex items-center gap-2 text-sm font-medium text-black">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {submitError}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* T&C checkbox — step 5 only */}
        {step === 5 && (
          <div className="mt-6 p-4 border border-black/10 bg-black/[0.015]">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                data-testid="checkbox-terms"
                className="mt-0.5 w-4 h-4 accent-black shrink-0"
              />
              <span className="text-sm text-black/55 leading-relaxed">
                I have read and agree to the{" "}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-black font-black underline underline-offset-2 hover:text-black/70 transition-colors"
                  data-testid="button-view-terms"
                >
                  Terms & Conditions
                </button>
                {" "}of The Moving Guy Pte Ltd, including the deposit, cancellation, and rescheduling policies.
              </span>
            </label>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 gap-4">
          {step > 1 ? (
            <button onClick={back} data-testid="button-back"
              className="flex items-center gap-2 px-6 py-3 border border-black/15 font-black text-xs uppercase tracking-[0.1em] hover:bg-slate-50 hover:border-black/30 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < 5 ? (
            <button onClick={next} disabled={!canNext()} data-testid="button-next"
              className="bg-black text-white flex items-center gap-2 px-8 py-3 font-black text-xs uppercase tracking-[0.1em] hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed transition-colors">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !email.trim() || !phone.trim() || !termsAccepted}
              data-testid="button-submit"
              className="bg-black text-white flex items-center gap-2 px-8 py-3 font-black text-xs uppercase tracking-[0.1em] hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <>Get Estimate <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Terms & Conditions Modal */}
    {showTermsModal && (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowTermsModal(false)}>
        <div
          className="bg-white border border-black/15 max-w-2xl w-full max-h-[85vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 shrink-0">
            <div>
              <h2 className="font-black text-base uppercase tracking-[0.04em]">Terms & Conditions</h2>
              <p className="text-[10px] text-black/40 mt-0.5 font-black uppercase tracking-[0.12em]">The Moving Guy Pte Ltd · UEN 202424156H</p>
            </div>
            <button onClick={() => setShowTermsModal(false)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 transition-colors text-black/40 hover:text-black" data-testid="button-close-terms">✕</button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto px-6 py-5 space-y-5 text-sm text-black/65 leading-relaxed">

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">1. Incomplete or Missing Parts</h3>
              <p>If our team arrives on-site and discovers that the furniture to be installed, dismantled, or relocated is incomplete, missing parts, damaged beyond assembly, or otherwise in a condition that prevents safe or proper installation, The Moving Guy Pte Ltd reserves the right to halt work without completion. In such cases:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>The deposit paid will be <strong>non-refundable</strong>.</li>
                <li>The customer is entitled to <strong>one (1) complimentary reschedule</strong> to complete the work once the full set of parts is obtained and ready for installation.</li>
                <li>Subsequent visits after the free reschedule will be treated as a new booking and charged accordingly.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">2. Deposit & Payment Policy</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>A <strong>50% non-refundable deposit</strong> is required to confirm your booking.</li>
                <li>The remaining <strong>50% balance is due upon completion</strong> of the work. Once our admin team has verified the completed work, a payment link will be sent to your email for the balance payment.</li>
                <li>Accepted payment methods: <strong>Stripe (credit/debit card), PayNow, bank transfer, or cash</strong>.</li>
                <li>Failure to pay the balance within the stipulated timeframe may result in legal action and recovery of costs.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">3. Cancellation Policy</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Cancellations made <strong>more than 48 hours</strong> before the scheduled appointment: deposit refunded less a <strong>$30 administrative fee</strong>.</li>
                <li>Cancellations made <strong>within 48 hours</strong> of the scheduled appointment: <strong>deposit is forfeited</strong> in full.</li>
                <li>No-shows on the day of appointment are treated as a same-day cancellation — deposit is forfeited.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">4. Rescheduling Policy</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Each customer is entitled to <strong>one (1) free reschedule</strong>, with a minimum of <strong>24 hours' notice</strong> before the appointment.</li>
                <li>Rescheduling requests made with less than 24 hours' notice will be treated as a cancellation.</li>
                <li>Subsequent rescheduling requests (beyond the first free one) will incur a <strong>$30 administrative fee</strong>.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">5. Scope of Work & Additional Charges</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>The estimate provided is based on the items and services described at the time of booking. Any additional items or services discovered on-site will be quoted separately and must be agreed upon before work commences.</li>
                <li>Additional charges may apply for <strong>stairs access</strong> (if no lift is available), <strong>difficult access</strong>, or <strong>disposal of old furniture</strong> (if requested).</li>
                <li>Waiting time exceeding <strong>30 minutes</strong> beyond the scheduled window due to customer delays may incur a waiting fee of $20 per 30 minutes.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">6. Damage & Liability</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Our team will exercise reasonable care during all work. However, The Moving Guy Pte Ltd is <strong>not liable</strong> for: pre-existing damage or wear; damage resulting from furniture with manufacturing defects or poor structural integrity; superficial marks to walls from standard drilling or fixing.</li>
                <li>Any damage claims must be reported <strong>immediately on the day of service</strong>, before our team departs.</li>
                <li>Maximum liability is capped at the total value of services paid for that job.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">7. Site Access & Customer Responsibilities</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>The customer is responsible for securing all necessary <strong>permits, lift access bookings, and HDB/condo approvals</strong> prior to the appointment.</li>
                <li>The customer must ensure the site is safe, accessible, and free of obstructions before our team arrives.</li>
                <li>If access is denied by building management, the deposit will be forfeited and a new booking will be required.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">8. Warranty</h3>
              <p>TMG Install provides a <strong>7-day workmanship warranty</strong> on all installations. This covers defects directly resulting from our installation work. It does not cover damage from misuse, unauthorised modification, or manufacturer defects.</p>
            </section>

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">9. Privacy</h3>
              <p>Your personal information (name, phone, email, address) is collected solely for the purpose of delivering our services and communicating with you regarding your booking. We do not sell or share your data with third parties, in accordance with Singapore's <strong>Personal Data Protection Act (PDPA)</strong>.</p>
            </section>

            <section>
              <h3 className="font-black text-sm uppercase tracking-[0.04em] text-black mb-1.5">10. Governing Law</h3>
              <p>These Terms & Conditions are governed by the laws of the <strong>Republic of Singapore</strong>. Any disputes shall be subject to the exclusive jurisdiction of the Singapore courts. The Moving Guy Pte Ltd (UEN: 202424156H) reserves the right to update these terms at any time.</p>
            </section>

            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-black/30 border-t border-black/8 pt-4">Last updated: March 2026 · The Moving Guy Pte Ltd · UEN 202424156H · tmginstall.com</p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-black/10 shrink-0 flex justify-end gap-3">
            <button onClick={() => setShowTermsModal(false)} className="px-5 py-2.5 border border-black/15 font-black text-xs uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors" data-testid="button-decline-terms">Close</button>
            <button onClick={() => { setTermsAccepted(true); setShowTermsModal(false); }} className="px-5 py-2.5 bg-black text-white font-black text-xs uppercase tracking-[0.1em] hover:bg-neutral-800 transition-colors" data-testid="button-accept-terms">I Agree</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
