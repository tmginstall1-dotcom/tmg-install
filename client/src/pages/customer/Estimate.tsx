import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
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
        const results = (data.results || []).slice(0, 6).map((r: any) => ({
          address: `${r.ADDRESS}${r.BUILDING && r.BUILDING !== "NIL" ? ", " + r.BUILDING : ""} Singapore ${r.POSTAL}`,
          lat: parseFloat(r.LATITUDE),
          lng: parseFloat(r.LONGITUDE),
        }));
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
      <label className="text-sm font-semibold text-foreground block mb-2">{label}{required && <span className="text-destructive ml-1">*</span>}</label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          required={required}
          value={value}
          onChange={e => { onSelect(e.target.value); setShow(true); }}
          onFocus={() => setShow(true)}
          placeholder={placeholder || "Start typing an address…"}
          data-testid={`input-address-${label.toLowerCase().replace(/\s+/g, "-")}`}
          className="w-full pl-9 pr-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      {show && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border rounded-xl shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => { onSelect(s.address, s.lat, s.lng); setShow(false); }}
              className="w-full text-left px-4 py-3 hover:bg-secondary text-sm border-b last:border-0 transition-colors"
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
  const map = { install: "bg-emerald-100 text-emerald-700", dismantle: "bg-amber-100 text-amber-700", relocate: "bg-blue-100 text-blue-700" };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${map[s]}`}>{s}</span>;
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
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

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
    <div className="min-h-screen pt-16 pb-20 bg-secondary/30">
      {/* Step indicator */}
      <div className="sticky top-16 z-40 bg-background/90 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                  step > s.num ? "bg-primary text-primary-foreground" :
                  step === s.num ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-sm font-medium hidden sm:block transition-colors ${step === s.num ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded-full transition-colors ${step > s.num ? "bg-primary" : "bg-border"}`} />}
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
                  <h2 className="text-3xl font-display font-bold mb-1">What do you need?</h2>
                  <p className="text-muted-foreground">Select one or more services — you can mix and match.</p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {([
                    { type: "install" as ServiceType, icon: <Wrench className="w-7 h-7" />, label: "Installation", desc: "Assemble and install furniture at your location", color: "emerald" },
                    { type: "dismantle" as ServiceType, icon: <Scissors className="w-7 h-7" />, label: "Dismantling", desc: "Carefully take apart and pack existing furniture", color: "amber" },
                    { type: "relocate" as ServiceType, icon: <Truck className="w-7 h-7" />, label: "Relocation / Move", desc: "Move furniture between locations — pickup & delivery", color: "blue" },
                  ]).map(({ type, icon, label, desc, color }) => {
                    const active = services.includes(type);
                    return (
                      <button
                        key={type}
                        data-testid={`service-${type}`}
                        onClick={() => setServices(prev => active ? prev.filter(s => s !== type) : [...prev, type])}
                        className={`group relative rounded-2xl border-2 p-5 text-left transition-all duration-200 ${
                          active ? `border-${color}-400 bg-${color}-50 dark:bg-${color}-950/30 shadow-lg` : "border-border bg-card hover:border-border/80 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-${color}-600 ${
                            active ? `bg-${color}-100 dark:bg-${color}-900/50` : "bg-secondary"
                          } transition-colors`}>
                            {icon}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-lg">{label}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${
                            active ? `border-${color}-500 bg-${color}-500` : "border-border"
                          }`}>
                            {active && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {services.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {services.map(s => (
                      <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                        <Check className="w-3.5 h-3.5" /> {s}
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
                  <h2 className="text-3xl font-display font-bold mb-1">
                    {isRelocation ? "Pickup & Dropoff" : "Service Location"}
                  </h2>
                  <p className="text-muted-foreground">
                    {isRelocation ? "Where should we pick up and deliver?" : "Where will the work take place?"}
                  </p>
                </div>
                <div className="bg-card rounded-2xl border p-6 space-y-5">
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
                        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                          distanceLoading ? "bg-secondary text-muted-foreground" :
                          distanceKm > 0 ? "bg-blue-50 text-blue-700 border border-blue-200" :
                          distanceError ? "bg-red-50 text-red-700 border border-red-200" : "bg-secondary text-muted-foreground"
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
                        <p className="text-sm font-semibold mb-3">Floor details <span className="text-muted-foreground font-normal">(affects pricing)</span></p>
                        {floors.map((floor, i) => (
                          <div key={i} className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-sm text-muted-foreground w-12 shrink-0">Floor {i + 1}</span>
                              <input
                                type="number" min="1" max="50"
                                value={floor.level}
                                onChange={e => setFloors(prev => prev.map((f, fi) => fi === i ? { ...f, level: e.target.value } : f))}
                                className="w-20 px-3 py-2 rounded-lg bg-background border text-center outline-none focus:border-primary"
                                data-testid={`input-floor-level-${i}`}
                              />
                            </div>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="checkbox" checked={floor.hasLift}
                                onChange={e => setFloors(prev => prev.map((f, fi) => fi === i ? { ...f, hasLift: e.target.checked } : f))}
                                className="w-4 h-4 accent-primary"
                              />
                              Has lift
                            </label>
                            {floors.length > 1 && (
                              <button onClick={() => setFloors(prev => prev.filter((_, fi) => fi !== i))} className="text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setFloors(prev => [...prev, { level: "1", hasLift: true }])}
                          className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                          <Plus className="w-4 h-4" /> Add floor
                        </button>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-3">Access difficulty</p>
                        <div className="flex gap-2">
                          {(["easy", "medium", "hard"] as const).map(d => (
                            <button key={d} data-testid={`difficulty-${d}`}
                              onClick={() => setAccessDifficulty(d)}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all border-2 ${
                                accessDifficulty === d ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
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
                  <h2 className="text-3xl font-display font-bold mb-1">Add Your Items</h2>
                  <p className="text-muted-foreground">Search our catalog, paste a list, or upload a photo.</p>
                </div>

                {/* Catalog Search */}
                <div className="bg-card rounded-2xl border p-5">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-primary" /> Search Catalog</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      value={catalogSearch}
                      onChange={e => setCatalogSearch(e.target.value)}
                      onFocus={() => setCatalogFocused(true)}
                      onBlur={() => { setTimeout(() => setCatalogFocused(false), 150); }}
                      placeholder="Search items e.g. wardrobe, bed, sofa…"
                      data-testid="input-catalog-search"
                      autoComplete="off"
                      className="w-full pl-9 pr-10 py-3 rounded-xl bg-secondary border-2 border-border focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
                    />
                    {catalogSearch && (
                      <button onClick={() => setCatalogSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {showCatalogResults && (
                    <div className="mt-3 border rounded-xl overflow-hidden">
                      {filteredGroups.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No items found for <strong>"{catalogSearch}"</strong>
                        </div>
                      ) : (
                        <>
                          {!catalogSearch.trim() && (
                            <div className="px-4 py-2 bg-secondary/50 border-b">
                              <p className="text-xs text-muted-foreground font-medium">Popular items — tap to add</p>
                            </div>
                          )}
                          {filteredGroups.map(group => (
                            <button
                              key={group.name}
                              onClick={() => { addCatalogGroup(group, 1); setCatalogSearch(""); setCatalogFocused(false); }}
                              data-testid={`catalog-item-${group.name.toLowerCase().replace(/\s+/g, "-")}`}
                              className="w-full text-left px-4 py-3 hover:bg-secondary active:bg-secondary border-b last:border-0 transition-colors flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{group.name}</p>
                                <p className="text-xs text-muted-foreground">{group.category}</p>
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
                <div className="bg-card rounded-2xl border p-5">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-accent" /> AI Photo Detection
                    <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </p>
                  <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />

                  {/* Success state — thumbnail + re-scan option */}
                  {detectedPhotoUrl && !photoDetecting ? (
                    <div className="flex items-start gap-4">
                      <img src={detectedPhotoUrl} alt="detected" className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-300 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-emerald-700 flex items-center gap-1.5 mb-1">
                          <Check className="w-4 h-4" /> {detectedCount} item{detectedCount !== 1 ? 's' : ''} detected
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">Items added below. Review and adjust quantities.</p>
                        <button onClick={() => { setDetectedPhotoUrl(""); setDetectedCount(0); fileInputRef.current?.click(); }}
                          className="text-xs font-semibold text-primary underline hover:no-underline">
                          Scan another photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                      disabled={photoDetecting}
                      data-testid="button-upload-photo"
                      className="w-full border-2 border-dashed border-border rounded-xl py-5 flex flex-col items-center gap-2 hover:border-accent hover:bg-accent/5 transition-all text-muted-foreground hover:text-accent disabled:opacity-60"
                    >
                      {photoDetecting
                        ? <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-semibold">Scanning photo with AI…</span><span className="text-xs">This may take a few seconds</span></>
                        : <><Camera className="w-7 h-7" /><span className="text-sm font-semibold">Take or upload a photo</span><span className="text-xs">AI will identify your furniture automatically</span></>
                      }
                    </button>
                  )}

                  {photoError && (
                    <p className="text-sm text-destructive mt-3 flex items-center gap-1.5 bg-red-50 rounded-xl px-3 py-2 border border-red-200">
                      <AlertCircle className="w-4 h-4 shrink-0" />{photoError}
                    </p>
                  )}
                </div>

                {/* Paste List */}
                <div className="bg-card rounded-2xl border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-500" /> Paste Item List <span className="text-muted-foreground font-normal text-xs">(optional)</span></p>
                    <button onClick={() => setShowPaste(s => !s)} className="text-xs text-primary font-medium hover:underline">{showPaste ? "Close" : "Open"}</button>
                  </div>
                  {showPaste && (
                    <div className="space-y-3">
                      <textarea
                        value={pasteText}
                        onChange={e => setPasteText(e.target.value)}
                        rows={5}
                        placeholder={"2 queen bed\n6 office chair\n1 dining table"}
                        data-testid="input-paste-list"
                        className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary outline-none resize-none text-sm font-mono"
                      />
                      <p className="text-xs text-muted-foreground">One item per line. Format: "2 queen bed" or "dining table x4"</p>
                      <button onClick={applyPaste} disabled={!pasteText.trim()}
                        data-testid="button-apply-paste"
                        className="btn-primary-gradient px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">
                        Add Items
                      </button>
                    </div>
                  )}
                </div>

                {/* Items list */}
                {items.length > 0 && (
                  <div className="bg-card rounded-2xl border overflow-hidden">
                    <div className="px-5 py-4 border-b flex items-center justify-between">
                      <p className="font-bold flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Selected Items ({items.length})</p>
                      <p className="font-bold text-primary">${subtotal.toFixed(2)}</p>
                    </div>
                    <div className="divide-y">
                      {items.map(item => (
                        <div key={item.id} data-testid={`item-${item.id}`} className="px-5 py-4 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-semibold text-sm truncate">{item.name}</p>
                              {item.sku && <span className="text-xs bg-secondary px-2 py-0.5 rounded font-mono text-muted-foreground">{item.sku}</span>}
                              {item.isCustom && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">Custom</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {serviceBadge(item.serviceType)}
                              {item.category && <span className="text-xs text-muted-foreground">{item.category}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setItems(prev => prev.map(i => i.id === item.id && i.quantity > 1 ? { ...i, quantity: i.quantity - 1 } : i))}
                              data-testid={`button-decrease-${item.id}`}
                              className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                            <button onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))}
                              data-testid={`button-increase-${item.id}`}
                              className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-right w-20">
                            <p className="font-bold text-sm">${(item.unitPrice * item.quantity).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">${item.unitPrice.toFixed(2)} ea</p>
                          </div>
                          <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                            data-testid={`button-remove-${item.id}`}
                            className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-4 bg-secondary/50 space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Labor subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {pricingResult.discountLine && (
                        <div className="flex justify-between text-emerald-700 font-medium">
                          <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" />{pricingResult.discountLine.label}</span>
                          <span>-${pricingResult.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {pricingResult.feeLines.map((fee, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground">
                          <span>{fee.label}</span><span>+${fee.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border mt-2">
                        <span>Estimated Total</span><span className="text-primary">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {items.length === 0 && (
                  <div className="bg-card rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No items yet — search above or paste a list</p>
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
                    <h2 className="text-3xl font-display font-bold mb-1">Pick a Slot</h2>
                    <p className="text-muted-foreground">Tap a date, then choose morning or afternoon.</p>
                  </div>

                  {/* Calendar card */}
                  <div className="bg-card rounded-2xl border p-4 space-y-3">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between px-1">
                      <button onClick={prevMonth} data-testid="button-cal-prev"
                        className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <p className="font-bold text-sm">{monthLabel}</p>
                      <button onClick={nextMonth} data-testid="button-cal-next"
                        className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 text-center">
                      {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => (
                        <div key={d} className="text-[11px] font-bold text-muted-foreground py-1">{d}</div>
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
                              "relative flex flex-col items-center justify-center h-10 rounded-xl text-sm font-medium transition-all select-none",
                              isSelected
                                ? "bg-primary text-primary-foreground font-bold shadow-md"
                                : status === "full"
                                  ? "bg-muted/20 text-muted-foreground/40 cursor-not-allowed line-through text-xs"
                                  : past
                                    ? "text-muted-foreground/25 cursor-not-allowed"
                                    : "hover:bg-primary/10 hover:text-primary cursor-pointer",
                              isToday && !isSelected ? "ring-2 ring-primary/40 ring-offset-1" : "",
                            ].join(" ")}
                          >
                            {day}
                            {/* Availability dot */}
                            {!past && !isSelected && status === "partial" && (
                              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-400" />
                            )}
                            {!past && !isSelected && status === "available" && (
                              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" /> Available</span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" /> Partial</span>
                      <span className="flex items-center gap-1.5 opacity-40 line-through">31</span>
                      <span className="opacity-40">Full</span>
                    </div>
                  </div>

                  {/* Time slot picker — shown once a date is selected */}
                  {slotDateStr ? (
                    <div className="bg-card rounded-2xl border p-5 space-y-4">
                      <p className="font-bold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
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
                                "relative flex flex-col items-center gap-1.5 py-5 rounded-2xl border-2 transition-all font-medium",
                                taken ? "border-border bg-muted/40 text-muted-foreground cursor-not-allowed opacity-50"
                                  : sel ? "border-primary bg-primary/10 text-primary shadow-md"
                                  : "border-border bg-card hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
                              ].join(" ")}
                            >
                              {slot.value === "09:00-12:00" ? <Sun className="w-6 h-6" /> : <Sunset className="w-6 h-6" />}
                              <span className="font-bold">{slot.label}</span>
                              <span className="text-xs text-muted-foreground">{slot.time}</span>
                              {taken && <span className="absolute top-2 right-2 text-[10px] text-muted-foreground flex items-center gap-0.5"><Ban className="w-2.5 h-2.5" />Full</span>}
                              {sel && !taken && <span className="absolute top-2 right-2 text-[10px] text-primary flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />Chosen</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">
                      <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Select a date on the calendar above
                    </div>
                  )}

                  {/* Confirmation banner */}
                  {slotDateStr && slotTime && !isSlotTaken(slotDateStr, slotTime) && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-emerald-800">Slot Available!</p>
                        <p className="text-sm text-emerald-700">
                          {new Date(slotDateStr + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short", year: "numeric" })},&nbsp;{TIME_SLOTS.find(t => t.value === slotTime)?.time}
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">Held for 48 hours once your quote is submitted.</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <p className="text-xs text-amber-700">
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
                  <h2 className="text-3xl font-display font-bold mb-1">Your Details</h2>
                  <p className="text-muted-foreground">Review your estimate and enter your contact info.</p>
                </div>

                {/* Customer details form */}
                <div className="bg-card rounded-2xl border p-6 space-y-4">
                  <p className="font-bold">Contact Information</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold mb-1.5 block">Full Name <span className="text-destructive">*</span></label>
                      <input required value={name} onChange={e => setName(e.target.value)} data-testid="input-name"
                        placeholder="Ahmad Bin Ismail" className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-1.5 block">Phone <span className="text-destructive">*</span></label>
                      <input required value={phone} onChange={e => setPhone(e.target.value)} data-testid="input-phone"
                        placeholder="+65 8123 4567" className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">Email <span className="text-destructive">*</span></label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email"
                      placeholder="ahmadismail@gmail.com" className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                  </div>
                </div>

                {/* Slot summary */}
                {slotDateStr && slotTime && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                    <p className="text-xs font-semibold text-emerald-700 uppercase mb-3 tracking-wide">Preferred Appointment Slot</p>
                    <div className="flex items-center gap-2 font-bold text-emerald-800">
                      <CalendarDays className="w-4 h-4 text-emerald-600" />
                      {new Date(slotDateStr + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-emerald-700 mt-1.5">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      {TIME_SLOTS.find(t => t.value === slotTime)?.label} — {TIME_SLOTS.find(t => t.value === slotTime)?.time}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="bg-card rounded-2xl border overflow-hidden">
                  <div className="px-5 py-4 border-b">
                    <p className="font-bold flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Estimate Summary</p>
                  </div>
                  <div className="px-5 py-4 space-y-4 divide-y">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Services</p>
                      <div className="flex flex-wrap gap-2">
                        {services.map(s => (
                          <span key={s} className="capitalize px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Location</p>
                      {isRelocation ? (
                        <div className="space-y-1 text-sm">
                          <p className="flex gap-2"><span className="font-medium w-16 shrink-0">Pickup:</span><span>{pickupAddress}</span></p>
                          <p className="flex gap-2"><span className="font-medium w-16 shrink-0">Dropoff:</span><span>{dropoffAddress}</span></p>
                        </div>
                      ) : (
                        <p className="text-sm">{serviceAddress}</p>
                      )}
                    </div>
                    <div className="pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Items ({items.length})</p>
                      <div className="space-y-2">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {serviceBadge(item.serviceType)}
                              <span>{item.name} ×{item.quantity}</span>
                              {item.isCustom && <span className="text-xs text-muted-foreground">(TBD)</span>}
                            </div>
                            <span className="font-medium">{item.isCustom ? "TBD" : `$${(item.unitPrice * item.quantity).toFixed(2)}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Labor subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {pricingResult.discountLine && (
                        <div className="flex justify-between text-emerald-700 font-medium">
                          <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" />{pricingResult.discountLine.label}</span>
                          <span>−${pricingResult.discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {pricingResult.feeLines.map((fee, i) => (
                        <div key={i} className="flex justify-between text-muted-foreground">
                          <span>{fee.label}</span><span>+${fee.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      {isRelocation && distanceKm > 0 && (
                        <div className="flex justify-between text-blue-600 text-xs mt-1">
                          <span className="flex items-center gap-1"><Navigation className="w-3 h-3" /> Route distance</span>
                          <span>{distanceKm} km</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Grand Total (estimated)</span><span className="text-primary">${total.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Deposit due now (50%)</span><span className="font-semibold">${deposit.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Balance on completion (50%)</span><span>${finalAmt.toFixed(2)}</span></div>
                      {pricingResult.requiresAdminReview && (
                        <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">This quote includes items requiring admin review — final pricing may be adjusted.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {submitError && (
                  <div className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {submitError}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* T&C checkbox — step 5 only */}
        {step === 5 && (
          <div className="mt-6 p-4 rounded-xl border-2 border-border bg-secondary/30">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                data-testid="checkbox-terms"
                className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I have read and agree to the{" "}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-primary font-semibold underline underline-offset-2 hover:text-primary/80 transition-colors"
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
              className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-border bg-card font-semibold hover:bg-secondary transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < 5 ? (
            <button onClick={next} disabled={!canNext()} data-testid="button-next"
              className="btn-primary-gradient flex items-center gap-2 px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !email.trim() || !phone.trim() || !termsAccepted}
              data-testid="button-submit"
              className="btn-primary-gradient flex items-center gap-2 px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
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
          className="bg-background rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <div>
              <h2 className="text-lg font-bold">Terms & Conditions</h2>
              <p className="text-xs text-muted-foreground">The Moving Guy Pte Ltd · UEN 202424156H</p>
            </div>
            <button onClick={() => setShowTermsModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground" data-testid="button-close-terms">✕</button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto px-6 py-5 space-y-5 text-sm text-foreground/80 leading-relaxed">

            <section>
              <h3 className="font-bold text-foreground mb-1">1. Incomplete or Missing Parts</h3>
              <p>If our team arrives on-site and discovers that the furniture to be installed, dismantled, or relocated is incomplete, missing parts, damaged beyond assembly, or otherwise in a condition that prevents safe or proper installation, The Moving Guy Pte Ltd reserves the right to halt work without completion. In such cases:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>The deposit paid will be <strong>non-refundable</strong>.</li>
                <li>The customer is entitled to <strong>one (1) complimentary reschedule</strong> to complete the work once the full set of parts is obtained and ready for installation.</li>
                <li>Subsequent visits after the free reschedule will be treated as a new booking and charged accordingly.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">2. Deposit & Payment Policy</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>A <strong>50% non-refundable deposit</strong> is required to confirm your booking.</li>
                <li>The remaining <strong>50% balance is due upon completion</strong> of the work, before our team leaves the premises.</li>
                <li>Accepted payment methods: <strong>PayNow, bank transfer, or cash</strong>.</li>
                <li>Failure to pay the balance upon completion may result in legal action and recovery of costs.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">3. Cancellation Policy</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Cancellations made <strong>more than 48 hours</strong> before the scheduled appointment: deposit refunded less a <strong>$30 administrative fee</strong>.</li>
                <li>Cancellations made <strong>within 48 hours</strong> of the scheduled appointment: <strong>deposit is forfeited</strong> in full.</li>
                <li>No-shows on the day of appointment are treated as a same-day cancellation — deposit is forfeited.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">4. Rescheduling Policy</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Each customer is entitled to <strong>one (1) free reschedule</strong>, with a minimum of <strong>24 hours' notice</strong> before the appointment.</li>
                <li>Rescheduling requests made with less than 24 hours' notice will be treated as a cancellation.</li>
                <li>Subsequent rescheduling requests (beyond the first free one) will incur a <strong>$30 administrative fee</strong>.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">5. Scope of Work & Additional Charges</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>The estimate provided is based on the items and services described at the time of booking. Any additional items or services discovered on-site will be quoted separately and must be agreed upon before work commences.</li>
                <li>Additional charges may apply for <strong>stairs access</strong> (if no lift is available), <strong>difficult access</strong>, or <strong>disposal of old furniture</strong> (if requested).</li>
                <li>Waiting time exceeding <strong>30 minutes</strong> beyond the scheduled window due to customer delays may incur a waiting fee of $20 per 30 minutes.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">6. Damage & Liability</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Our team will exercise reasonable care during all work. However, The Moving Guy Pte Ltd is <strong>not liable</strong> for: pre-existing damage or wear; damage resulting from furniture with manufacturing defects or poor structural integrity; superficial marks to walls from standard drilling or fixing.</li>
                <li>Any damage claims must be reported <strong>immediately on the day of service</strong>, before our team departs.</li>
                <li>Maximum liability is capped at the total value of services paid for that job.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">7. Site Access & Customer Responsibilities</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>The customer is responsible for securing all necessary <strong>permits, lift access bookings, and HDB/condo approvals</strong> prior to the appointment.</li>
                <li>The customer must ensure the site is safe, accessible, and free of obstructions before our team arrives.</li>
                <li>If access is denied by building management, the deposit will be forfeited and a new booking will be required.</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">8. Warranty</h3>
              <p>TMG Install provides a <strong>7-day workmanship warranty</strong> on all installations. This covers defects directly resulting from our installation work. It does not cover damage from misuse, unauthorised modification, or manufacturer defects.</p>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">9. Privacy</h3>
              <p>Your personal information (name, phone, email, address) is collected solely for the purpose of delivering our services and communicating with you regarding your booking. We do not sell or share your data with third parties, in accordance with Singapore's <strong>Personal Data Protection Act (PDPA)</strong>.</p>
            </section>

            <section>
              <h3 className="font-bold text-foreground mb-1">10. Governing Law</h3>
              <p>These Terms & Conditions are governed by the laws of the <strong>Republic of Singapore</strong>. Any disputes shall be subject to the exclusive jurisdiction of the Singapore courts. The Moving Guy Pte Ltd (UEN: 202424156H) reserves the right to update these terms at any time.</p>
            </section>

            <p className="text-xs text-muted-foreground border-t pt-4">Last updated: March 2026 · The Moving Guy Pte Ltd · UEN 202424156H · tmginstall.com</p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-3">
            <button onClick={() => setShowTermsModal(false)} className="px-5 py-2.5 rounded-xl border font-semibold text-sm hover:bg-secondary transition-colors" data-testid="button-decline-terms">Close</button>
            <button onClick={() => { setTermsAccepted(true); setShowTermsModal(false); }} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors" data-testid="button-accept-terms">I Agree</button>
          </div>
        </div>
      </div>
    )}
  );
}
