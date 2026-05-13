import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { useLocation } from "wouter";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";
import { trackPixelEvent } from "@/lib/metaPixel";
import { useSEO } from "@/hooks/use-seo";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wrench, Scissors, Truck, MapPin, Search, Plus, Minus, Trash2, 
  ChevronRight, ChevronLeft, Check, ClipboardList, Camera, X, 
  Loader2, AlertCircle, Star, Package, ArrowRight, Navigation, Tag,
  CalendarDays, Clock, MessageCircle
} from "lucide-react";
import { SlotPicker, type SlotAvailability } from "@/components/SlotPicker";
import type { CatalogItem } from "@shared/schema";
import { computePricing, PricingConfig, computeDRPrice, effectiveCarryPrice, requiresSpecialHandling, type PricingCatalogEntry } from "@shared/pricing";

/* ─────────────────── Editorial primitives (mirror homepage) ───────────────────
   Inlined here so the estimate wizard matches the editorial language of "/"
   without coupling files: signature install-green ACCENT, AccentSquare,
   DotGrid backdrop. Same tokens as LandingCinematic + QuoteStatus.
   ────────────────────────────────────────────────────────────────────────── */
const EST_ACCENT = "#2af56a";

function EstAccentSquare({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-[10px] h-[10px] shrink-0 ${className}`}
      style={{ background: EST_ACCENT }}
    />
  );
}

function EstDotGrid({ opacity = 0.4, size = 28 }: { opacity?: number; size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity,
        backgroundImage: "radial-gradient(circle, rgba(10,10,10,0.22) 1px, transparent 1px)",
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}

type ServiceType = "install" | "dismantle" | "relocate" | "dispose" | "dismantle_dispose";

interface LineItem {
  id: string;
  catalogItemId?: number;
  sku: string;
  name: string;
  category: string;
  serviceType: ServiceType;
  quantity: number;
  unitPrice: number;
  volumeM3?: number;
  isCustom: boolean;
  // Relocation sub-mode: full = dismantle + move + reinstall; carry = move as-is
  relocateMode?: 'full' | 'carry';
  carryPrice?: number;   // carry-only catalog price
  fullPrice?: number;    // dismantle + install combined price
}

interface Floor {
  level: string;
  hasLift: boolean;
}

interface CatalogGroup {
  name: string;
  category: string;
  entries: { id: number; sku: string; serviceType: ServiceType; basePrice: string; volumeM3?: number }[];
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
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { suggestions, loading } = useAddressSuggestions(value);

  // Recompute dropdown position relative to input
  const updateRect = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom, width: r.width });
  }, []);

  useEffect(() => {
    if (!show) return;
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [show, updateRect, suggestions.length]);

  // Outside-click / outside-touch closes dropdown
  useEffect(() => {
    function handler(e: Event) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setShow(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 block mb-2">{label}{required && <span className="text-black ml-1">*</span>}</label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30 pointer-events-none" />
        <input
          ref={inputRef}
          required={required}
          value={value}
          onChange={e => { onSelect(e.target.value); setShow(true); updateRect(); }}
          onFocus={() => { setShow(true); updateRect(); }}
          placeholder={placeholder || "Start typing an address…"}
          data-testid={`input-address-${label.toLowerCase().replace(/\s+/g, "-")}`}
          className="w-full pl-9 pr-4 py-3 bg-white border border-black/10 focus:border-black outline-none transition-all text-sm"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-black/30 pointer-events-none" />}
      </div>
      {show && suggestions.length > 0 && rect && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            left: rect.left,
            top: rect.top + 2,
            width: rect.width,
            zIndex: 9999,
            maxHeight: "50vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
          className="bg-white border border-black/15 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(s.address, s.lat, s.lng); setShow(false); }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 text-sm text-black border-b border-black/10 last:border-0 transition-colors"
            >{s.address}</button>
          ))}
        </div>,
        document.body
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
      map[key].entries.push({
        id: item.id,
        sku: item.sku || "",
        serviceType: item.serviceType as ServiceType,
        basePrice: item.basePrice,
        volumeM3: item.volumeM3 ? parseFloat(item.volumeM3) : undefined,
      });
    }
  });
  return Object.values(map);
}

function serviceBadge(s: ServiceType) {
  const labels: Record<ServiceType, string> = {
    install: "Install", dismantle: "Dismantle", relocate: "Relocate",
    dispose: "Dispose", dismantle_dispose: "Dismantle + Dispose",
  };
  return <span className="text-[10px] font-black uppercase tracking-[0.08em] px-2 py-0.5 border border-black/20 text-black/60">{labels[s] ?? s}</span>;
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
  useSEO({
    title: "Get an Instant Quote | Furniture Installation Singapore — TMG Install",
    description: "Use our free online quote wizard to get an instant itemised price for furniture installation, dismantling, or relocation anywhere in Singapore. 450+ items, upfront pricing.",
    canonical: "https://tmginstall.com/estimate",
  });
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const wizardStartFired = useRef(false);
  useEffect(() => {
    if (wizardStartFired.current) return;
    wizardStartFired.current = true;
    trackEvent("wizard_start", "/estimate");
    trackPixelEvent("InitiateCheckout");
  }, []);

  // Resume from abandoned lead link (?resume=TOKEN)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resumeToken = params.get("resume");
    if (!resumeToken) return;
    fetch(`/api/partial-leads/resume/${resumeToken}`)
      .then(r => r.ok ? r.json() : null)
      .then(lead => {
        if (!lead) return;
        setPartialLeadToken(resumeToken);
        setCaptureShown(true);
        if (lead.email) setCaptureEmail(lead.email);
        if (lead.name) setCaptureName(lead.name);
        if (lead.services && Array.isArray(lead.services)) {
          // Normalize on resume: if Relocation is present, drop redundant Install/Dismantle
          // (legacy partial leads may have stored conflicting selections before this UX fix).
          const raw = lead.services as ServiceType[];
          const normalized = raw.includes("relocate")
            ? raw.filter(s => s !== "install" && s !== "dismantle")
            : raw;
          setServices(normalized);
        }
        if (lead.serviceAddress) setServiceAddress(lead.serviceAddress);
        if (lead.pickupAddress) setPickupAddress(lead.pickupAddress);
        if (lead.dropoffAddress) setDropoffAddress(lead.dropoffAddress);
        setStep(3);
      })
      .catch(() => {});
  }, []);

  // Step 1
  const [services, setServices] = useState<ServiceType[]>([]);
  const [disposalMode, setDisposalMode] = useState<"dispose" | "dismantle_dispose">("dismantle_dispose");
  // Step 2
  const [serviceAddress, setServiceAddress] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLatLng, setPickupLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLatLng, setDropoffLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState("");
  // Default to ground floor (level 0) so we never auto-add a floor surcharge
  // before the customer has actually told us about lift/stairs/floor.
  const [floors, setFloors] = useState<Floor[]>([{ level: "0", hasLift: true }]);
  const [accessDifficulty, setAccessDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  // Tracks whether the customer has explicitly answered the access questions.
  // When false, any computed floor/access fee is shown as an *estimate* and
  // we surface a "confirmed on-site" caveat in the review summary.
  const [accessAnswered, setAccessAnswered] = useState(false);
  const [stairsAnswer, setStairsAnswer] = useState<"no" | "yes" | "unsure" | null>(null);
  // Step 3
  const [items, setItems] = useState<LineItem[]>([]);

  // Item reconciliation: when Relocation gets selected, install/dismantle line
  // items in the cart become redundant (Relocation already covers them as a
  // bundle). Drop them so the cart total reflects the user's intent and
  // matches what Step 1 visually communicates.
  useEffect(() => {
    if (services.includes("relocate")) {
      setItems(prev => {
        const filtered = prev.filter(i => i.serviceType !== "install" && i.serviceType !== "dismantle");
        return filtered.length === prev.length ? prev : filtered;
      });
    }
  }, [services]);

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogFocused, setCatalogFocused] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [photoDetecting, setPhotoDetecting] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [detectedPhotos, setDetectedPhotos] = useState<{ thumbnail: string; names: string[]; count: number }[]>([]);
  const [detectingProgress, setDetectingProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Step 4: Schedule
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
  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoStatus, setPromoStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [promoMessage, setPromoMessage] = useState("");

  // Partial lead capture (abandoned wizard recovery)
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [showContactEditor, setShowContactEditor] = useState(false);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureName, setCaptureName] = useState("");
  const [captureSaving, setCaptureSaving] = useState(false);
  const [partialLeadToken, setPartialLeadToken] = useState<string | null>(null);
  const [captureShown, setCaptureShown] = useState(false);

  const { visible: promoVisible, promo: promoBarData } = usePromoBar();

  const isRelocation = services.includes("relocate");

  // Fetch catalog — short stale time so price changes apply quickly
  const { data: catalogRaw } = useQuery<CatalogItem[]>({
    queryKey: ["/api/catalog"],
    queryFn: () => fetch("/api/catalog").then(r => r.json()),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });

  // Fetch slot availability (blocked + held + capacities)
  const { data: slotAvailability } = useQuery<SlotAvailability>({
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

  // ── Timeline / manpower estimator (large jobs, ≥50 total units) ───────────
  // Per-unit labour MAN-MINUTES for INSTALL by item family (single-person
  // equivalent — i.e. how many minutes one technician would need). Adding a
  // second crew member halves wall-clock time but keeps the man-minute total
  // the same, which is what we sum up for crew/day sizing.
  //
  // These are honest field averages from TMG jobs — they include the actual
  // mechanical work only (unboxing, fastening, levelling). Setup, breaks,
  // packaging removal, on-site coordination and customer Q&A are added back
  // separately as a 20% overhead, and we use 7 productive hours per crew per
  // day (not 8) to reflect lunch + 2 short breaks.
  const perUnitInstallMinutes = (item: LineItem): number => {
    const n = item.name.toLowerCase();
    if (/auditorium|theatre|theater|cinema|lecture/.test(n)) return 15;   // ~4 seats / man-hour
    if (/\bpax\b|wardrobe|closet/.test(n)) return 210;                    // 3.5 man-hours per PAX (real)
    if (/king\s*bed|queen\s*bed/.test(n)) return 90;
    if (/double\s*bed|super\s*single|single\s*bed|bed\s*frame/.test(n)) return 75;
    if (/dining\s*table|conference\s*table|kitchen\s*island/.test(n)) return 75;
    if (/office\s*desk|study\s*desk/.test(n)) return 50;
    if (/sofa|couch|sectional|chaise|recliner/.test(n)) return 50;
    if (/bookshelf|cabinet|shelving|kitchen\s*rack|tv\s*console/.test(n)) return 40;
    if (/dining\s*chair|stool/.test(n)) return 8;
    if (/ergonomic|office\s*chair|task\s*chair/.test(n)) return 10;
    if (/mattress/.test(n)) return 12;
    return 35; // generic furniture install
  };
  const itemLabourMinutes = (item: LineItem): number => {
    const inst = perUnitInstallMinutes(item);
    let perUnit = inst;
    if (item.serviceType === "dismantle") perUnit = Math.round(inst * 0.7);
    else if (item.serviceType === "dispose") perUnit = Math.round(inst * 0.6);
    else if (item.serviceType === "dismantle_dispose") perUnit = Math.round(inst * 1.1);
    else if (item.serviceType === "relocate") {
      // Carry-only ≈ lift, walk, place. D&R = dismantle + pack + carry + reinstall.
      perUnit = item.relocateMode === "carry" ? Math.round(inst * 0.6) : Math.round(inst * 2.0);
    }
    return perUnit * item.quantity;
  };
  const timelinePlan = useMemo(() => {
    const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
    if (totalUnits < 50) return null;
    const rawManMinutes = items.reduce((s, i) => s + itemLabourMinutes(i), 0);
    // 20% overhead for setup, breaks, packaging removal, coordination,
    // customer Q&A, navigating between rooms/units on multi-unit sites.
    const overheadMultiplier = 1.20;
    const totalManMinutes = Math.round(rawManMinutes * overheadMultiplier);
    const totalManHours = Math.ceil(totalManMinutes / 60);
    // Recommended crew sizing — scales with job size to stay within reason.
    let crewSize = 3;
    if (totalUnits >= 300) crewSize = 8;
    else if (totalUnits >= 200) crewSize = 6;
    else if (totalUnits >= 100) crewSize = 4;
    // 7 productive hours/day after lunch + breaks (8h shift, 1h non-productive).
    const hoursPerDayPerCrew = 7;
    const days = Math.max(1, Math.ceil(totalManHours / (crewSize * hoursPerDayPerCrew)));
    return { totalUnits, totalManHours, crewSize, days };
  }, [items]);

  // Category tab groups (maps display label → category keywords)
  const CATEGORY_TABS = [
    { label: "All",      match: null },
    { label: "Beds",     match: ["beds", "ikea beds", "mattresses"] },
    { label: "Wardrobes",match: ["ikea wardrobes", "wardrobes", "bedroom"] },
    { label: "Sofas",    match: ["sofas", "living room", "ikea living room"] },
    { label: "Dining",   match: ["dining"] },
    { label: "Office",   match: ["office", "meeting pods & phone booths"] },
    { label: "IKEA",     match: ["ikea beds", "ikea wardrobes", "ikea living room", "ikea shelving", "ikea storage", "ikea study", "ikea bedroom"] },
    { label: "Storage",  match: ["storage", "ikea shelving", "ikea storage"] },
  ];

  const filteredGroups = useMemo(() => {
    let groups = catalogGroups;
    // Category filter (ignored when searching)
    if (!catalogSearch.trim() && activeCategory !== "All") {
      const tab = CATEGORY_TABS.find(t => t.label === activeCategory);
      if (tab?.match) {
        groups = groups.filter(g => tab.match!.some(kw => g.category.toLowerCase().includes(kw)));
      }
    }
    if (!catalogSearch.trim()) return groups.slice(0, 16);
    const q = catalogSearch.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) ||
      g.entries.some(e => e.sku.toLowerCase().includes(q))
    );
  }, [catalogSearch, catalogGroups, activeCategory]);

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
      serviceType: c.serviceType as ServiceType,
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
      volumeM3: i.volumeM3,
      carryOnly: i.relocateMode === 'carry',
      sku: i.sku,
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

  // D&R mode = at least one relocate item with full dismantle+reinstall — NO time cap applies
  const hasDRMode = isRelocation && items.some(i => i.serviceType === 'relocate' && i.relocateMode === 'full');
  // Promo discount applied to the grand total (which already includes the $60 callout fee)
  const grandTotalAfterPromo = Math.max(0, total - promoDiscount);
  const effectiveDeposit = Math.round(grandTotalAfterPromo * 0.5 * 100) / 100;
  const effectiveFinal = Math.round((grandTotalAfterPromo - effectiveDeposit) * 100) / 100;

  const applyPromo = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setPromoStatus("validating");
    setPromoMessage("");
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, orderTotal: total }),
      });
      const data = await res.json();
      if (data.valid) {
        setPromoCode(trimmed);
        setPromoDiscount(data.discount);
        setPromoStatus("valid");
        setPromoMessage(data.message);
      } else {
        setPromoCode(null);
        setPromoDiscount(0);
        setPromoStatus("invalid");
        setPromoMessage(data.message || "Invalid code");
      }
    } catch {
      setPromoStatus("invalid");
      setPromoMessage("Could not validate code. Try again.");
    }
  }, [total]);

  const removePromo = useCallback(() => {
    setPromoCode(null);
    setPromoDiscount(0);
    setPromoStatus("idle");
    setPromoMessage("");
    setPromoInput("");
  }, []);

  // ── Catalog add ───────────────────────────────────────────────────────────

  const addCatalogGroup = (group: CatalogGroup, qty: number = 1) => {
    // Auto-fallback: items that can't actually be dismantled (mattresses,
    // boxes, plants, etc.) only ship with a plain "dispose" SKU. If the
    // customer picked "Dismantle + Dispose" mode and this group has no
    // dismantle_dispose variant, treat their request as plain "Dispose"
    // so the flat catalog rate is used instead of an inflated AI estimate.
    const groupHasDD = group.entries.some(e => e.serviceType === 'dismantle_dispose');
    const groupHasDispose = group.entries.some(e => e.serviceType === 'dispose');
    const effectiveServices: ServiceType[] = (services.includes('dismantle_dispose') && !groupHasDD && groupHasDispose)
      ? (Array.from(new Set(services.map(s => s === 'dismantle_dispose' ? 'dispose' : s))) as ServiceType[])
      : services;
    const relevant = group.entries.filter(e => effectiveServices.includes(e.serviceType));
    setItems(prev => {
      let updated = [...prev];
      if (relevant.length === 0) {
        // No matching service variants — add as custom for each selected service
        effectiveServices.forEach(st => {
          updated.push({ id: uid(), sku: "", name: group.name, category: group.category, serviceType: st, quantity: qty, unitPrice: 0, isCustom: true });
        });
      } else {
        // For relocation: show as a SINGLE line with a full/carry toggle
        const relocateEntry = relevant.find(e => e.serviceType === 'relocate');
        if (relocateEntry && services.length === 1 && services[0] === 'relocate') {
          const carryPrice = parseFloat(relocateEntry.basePrice);
          const installEntry = group.entries.find(e => e.serviceType === 'install');
          const dismantleEntry = group.entries.find(e => e.serviceType === 'dismantle');
          const fullPrice = computeDRPrice(
            installEntry ? parseFloat(installEntry.basePrice) : undefined,
            dismantleEntry ? parseFloat(dismantleEntry.basePrice) : undefined,
            carryPrice,
          );
          const existing = updated.find(i => i.catalogItemId === relocateEntry.id);
          if (existing) {
            updated = updated.map(i => i.catalogItemId === relocateEntry.id ? { ...i, quantity: i.quantity + qty } : i);
          } else {
            updated.push({
              id: uid(), catalogItemId: relocateEntry.id, sku: relocateEntry.sku,
              name: group.name, category: group.category, serviceType: 'relocate',
              quantity: qty, unitPrice: fullPrice, volumeM3: relocateEntry.volumeM3, isCustom: false,
              relocateMode: 'full', carryPrice, fullPrice,
            });
          }
        } else {
          // Non-relocate, or mixed services: add one line per service type
          // For relocate entries: always apply D&R bundle formula floored at carry × 1.30 (see computeDRPrice)
          relevant.forEach(entry => {
            const existing = updated.find(i => i.catalogItemId === entry.id);
            let unitPrice = parseFloat(entry.basePrice);
            if (entry.serviceType === 'relocate') {
              const installEntry = group.entries.find(e => e.serviceType === 'install');
              const dismantleEntry = group.entries.find(e => e.serviceType === 'dismantle');
              unitPrice = computeDRPrice(
                installEntry ? parseFloat(installEntry.basePrice) : undefined,
                dismantleEntry ? parseFloat(dismantleEntry.basePrice) : undefined,
                parseFloat(entry.basePrice),
              );
            }
            if (existing) {
              updated = updated.map(i => i.catalogItemId === entry.id ? { ...i, quantity: i.quantity + qty } : i);
            } else {
              updated.push({ id: uid(), catalogItemId: entry.id, sku: entry.sku, name: group.name, category: group.category, serviceType: entry.serviceType, quantity: qty, unitPrice, volumeM3: entry.volumeM3, isCustom: false });
            }
          });
        }
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
        // Same dismantle_dispose → dispose fallback as addCatalogGroup, so
        // pasted "1 mattress" doesn't get tagged as Dismantle + Dispose.
        const groupHasDD = matched.entries.some(e => e.serviceType === 'dismantle_dispose');
        const groupHasDispose = matched.entries.some(e => e.serviceType === 'dispose');
        const effectiveServices: ServiceType[] = (services.includes('dismantle_dispose') && !groupHasDD && groupHasDispose)
          ? (Array.from(new Set(services.map(s => s === 'dismantle_dispose' ? 'dispose' : s))) as ServiceType[])
          : services;
        const relevant = matched.entries.filter(e => effectiveServices.includes(e.serviceType));
        relevant.forEach(entry => {
          newItems.push({ id: uid(), catalogItemId: entry.id, sku: entry.sku, name: matched.name, category: matched.category, serviceType: entry.serviceType, quantity: qty, unitPrice: parseFloat(entry.basePrice), volumeM3: entry.volumeM3, isCustom: false });
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

  // Shared matching logic
  const stem = (w: string) => w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w;
  const stripParens = (s: string) => s.replace(/\s*\(.*?\)/g, "").trim();
  // Category families — if detected name belongs to one family and catalog name belongs to another,
  // they can never match (prevents e.g. "kitchen island" matching "pax wardrobe" on "ikea" alone)
  const CATEGORY_FAMILIES: string[][] = [
    ["wardrobe", "pax", "closet"],
    ["island", "kitchen island"],
    ["sofa", "couch", "sectional", "chaise"],
    ["treadmill", "elliptical", "rowing machine"],
    ["piano"],
    ["pool table", "billiard", "foosball"],
    ["pod", "phone booth"],
  ];
  // Synonym normalisation — collapse common alternate phrasings to the
  // canonical token used in catalog names so the fuzzy matcher hits the
  // intended entry. Currently: theatre/theater/cinema/lecture-hall seating
  // → "auditorium chair", which targets the Round 24 catalog row.
  const normaliseSynonyms = (s: string): string => {
    let out = s;
    out = out.replace(/\b(theatre|theater|cinema)\s+(seat|seats|seating|chair|chairs)\b/gi, "auditorium chair");
    out = out.replace(/\blecture\s*(hall|theatre|theater|room)?\s*(seat|seats|seating|chair|chairs)\b/gi, "auditorium chair");
    out = out.replace(/\bauditorium\s+(seat|seats|seating)\b/gi, "auditorium chair");
    return out;
  };
  const matchScore = (det: string, cat: string): number => {
    const d = normaliseSynonyms(det.toLowerCase()), c = cat.toLowerCase();
    const dC = stripParens(d), cC = stripParens(c);
    if (d === c) return 100;
    if (dC === cC) return 90;
    if (c.includes(d) || d.includes(c)) return 80;
    if (cC.includes(dC) || dC.includes(cC)) return 75;
    // Hard veto: if detected and catalog belong to different exclusive category families, score 0
    for (const family of CATEGORY_FAMILIES) {
      const detHas = family.some(kw => d.includes(kw));
      const catHas = family.some(kw => c.includes(kw));
      if (detHas !== catHas) return 0;
    }
    // IKEA model → map to specific catalog entry
    const ikeaModel = d.match(/\b(pax|kallax|billy|malm|hemnes|besta|micke|lack|alex|poäng|kivik|ivar|trofast|stuva|vittsjo|lillångén|lillangen|godmorgon|kleppstad|vadholma|stenstorp|förhöja|forhoja|råskog|raskog|norden|tornviken)\b/i);
    if (ikeaModel && c.includes(ikeaModel[1].toLowerCase())) return 70;
    // IKEA kitchen island models → map to "ikea kitchen island" entries
    const isIkeaIsland = /\b(vadholma|stenstorp|norden|tornviken)\b/i.test(d);
    if (isIkeaIsland && c.includes("kitchen island")) return 65;
    // IKEA trolley models → map to "ikea kitchen trolley" entries
    const isIkeaTrolley = /\b(råskog|raskog|förhöja|forhoja)\b/i.test(d);
    if (isIkeaTrolley && c.includes("trolley")) return 65;
    const dWords = dC.split(/\s+/).filter(w => w.length > 3).map(stem);
    const cWords = cC.split(/\s+/).filter(w => w.length > 3).map(stem);
    const overlap = dWords.filter(w => cWords.some(cw => cw.includes(w) || w.includes(cw)));
    if (overlap.length >= 2) return 60;
    if (overlap.length >= 1) return 40;
    return 0;
  };
  const bestCatalogMatch = (detectedName: string) => {
    let best: { group: typeof catalogGroups[0]; score: number } | null = null;
    catalogGroups.forEach(g => {
      const score = matchScore(detectedName, g.name);
      if (score > 0 && (!best || score > best.score)) best = { group: g, score };
    });
    return best && best.score >= 40 ? best.group : null;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setPhotoDetecting(true);
    setPhotoError("");

    let anyDetected = false;

    for (let i = 0; i < files.length; i++) {
      setDetectingProgress({ current: i + 1, total: files.length });
      try {
        const { base64, thumbnail, mimeType } = await compressImage(files[i], 1536);
        const res = await fetch("/api/catalog/detect-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Detection failed");

        const detected: { name: string; quantity: number; catalogGroup?: CatalogGroup }[] = data.detected || [];
        if (detected.length === 0) continue;

        anyDetected = true;
        let matchCount = 0;
        const nameList: string[] = [];

        detected.forEach(({ name, quantity, catalogGroup: serverGroup }) => {
          // Prefer server-returned catalog group (always fresh from DB) over client-side cache
          const matched = serverGroup || bestCatalogMatch(name);
          if (matched) {
            addCatalogGroup(matched, quantity || 1);
          } else {
            services.forEach(st => {
              setItems(prev => [...prev, {
                id: uid(), sku: "", name, category: "Custom",
                serviceType: st, quantity: quantity || 1, unitPrice: 0, isCustom: true,
              }]);
            });
          }
          matchCount++;
          nameList.push(quantity > 1 ? `${name} ×${quantity}` : name);
        });

        setDetectedPhotos(prev => [...prev, { thumbnail, names: nameList, count: matchCount }]);
      } catch (err: any) {
        console.error("Photo detection error:", err);
        // continue processing remaining photos
      }
    }

    if (!anyDetected) {
      setPhotoError("No furniture detected in the photos — try clearer shots or add items manually.");
    }
    setPhotoDetecting(false);
    setDetectingProgress(null);
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
          relocateMode: i.serviceType === 'relocate' ? (i.relocateMode || 'full') : undefined,
        })),
        customItems: [],
        logisticsFee: pricingResult.logisticsSubtotal,
        discount: pricingResult.discountAmount,
        distanceKm: distanceKm > 0 ? distanceKm : undefined,
        detectedPhotoUrl: detectedPhotos[0]?.thumbnail || undefined,
        preferredDate: slotDateStr || undefined,
        preferredTimeWindow: slotTime || undefined,
        promoCode: promoCode || undefined,
        promoDiscount: promoDiscount > 0 ? promoDiscount : undefined,
      };
      const res = await fetch("/api/quotes/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Submission failed"); }
      const quote = await res.json();

      // Google Ads conversion tracking — fires on successful estimate submission only.
      // Lead conversion (NOT a purchase): TMG customers don't pay on the website;
      // payment is collected later after admin review. Once-only guard keyed by the
      // quote reference / id prevents double-counting if this branch ever re-runs.
      try {
        const conversionTxnId: string = quote?.referenceNo || (quote?.id != null ? String(quote.id) : "");
        const firedKey = "tmg_gads_lead_fired";
        const alreadyFired = (() => {
          try { return conversionTxnId && sessionStorage.getItem(firedKey) === conversionTxnId; }
          catch { return false; }
        })();
        if (!alreadyFired && typeof window !== "undefined" && typeof (window as any).gtag === "function") {
          // Safety guard: do NOT fire any Google Ads lead conversion unless we
          // have a real backend-issued identifier (referenceNo or numeric id).
          // Without it we cannot dedupe in Google Ads, so skip entirely.
          if (!conversionTxnId) {
            if (import.meta.env.DEV) {
              console.log("[gads] estimate lead conversion SKIPPED — no quote referenceNo or id in response");
            }
          } else {
            // Submit Lead Form conversion — fires only after backend confirms the
            // quote was created. transaction_id uses the real quote reference / id
            // returned by /api/quotes/wizard so Google Ads dedupes duplicates.
            (window as any).gtag("event", "conversion", {
              send_to: "AW-18012639714/zTxuCNC63IccEOKjjI1D",
              value: 1.0,
              currency: "SGD",
              transaction_id: conversionTxnId,
            });
            // Estimate Form Submitted (Lead) conversion
            (window as any).gtag("event", "conversion", {
              send_to: "AW-18012639714/g1fTCM6xsYscEOKjjI1D",
              value: 1.0,
              currency: "SGD",
              transaction_id: conversionTxnId,
            });
            try { sessionStorage.setItem(firedKey, conversionTxnId); } catch {}
            if (import.meta.env.DEV) {
              console.log("[gads] estimate lead conversion fired", { txn: conversionTxnId });
            }
          }
        }
      } catch (_) {}
      trackEvent("wizard_submit", "/estimate");
      try {
        trackPixelEvent("Lead", {
          content_name: "Estimate Submitted",
          value: typeof quote?.total === "number" ? quote.total : undefined,
          currency: "SGD",
        });
      } catch (_) {}

      // Mark partial lead as completed so no re-engagement email is sent
      if (partialLeadToken) {
        fetch(`/api/partial-leads/${partialLeadToken}/complete`, { method: "POST" }).catch(() => {});
      }

      setLocation(`/quotes/${quote.id}?ref=${encodeURIComponent(quote.referenceNo)}`);
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

  const goNext = () => setStep(s => Math.min(s + 1, 5) as 1 | 2 | 3 | 4 | 5);

  const next = () => {
    // The save-progress modal previously interrupted Step 3 → 4 (before
    // scheduling). That broke the user's flow at the highest-intent moment.
    // It's now an explicit, optional secondary action triggered from a small
    // inline link on Step 3 — `next()` just advances the wizard.
    goNext();
  };

  const saveCaptureAndNext = async (skip = false) => {
    setShowCaptureModal(false);
    // Carry whatever the user typed in the modal forward — so Step 5 doesn't ask again.
    if (captureEmail.trim() && !email) setEmail(captureEmail.trim());
    if (captureName.trim() && !name) setName(captureName.trim());
    if (!skip && captureEmail.trim()) {
      setCaptureSaving(true);
      try {
        const res = await fetch("/api/partial-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: captureEmail.trim(),
            name: captureName.trim() || undefined,
            services,
            serviceAddress: isRelocation ? pickupAddress : serviceAddress,
            pickupAddress: isRelocation ? pickupAddress : undefined,
            dropoffAddress: isRelocation ? dropoffAddress : undefined,
            items: items.map(i => ({ name: i.name, quantity: i.quantity, serviceType: i.serviceType })),
          }),
        });
        if (res.ok) {
          const { token } = await res.json();
          setPartialLeadToken(token);
        }
      } catch { /* non-fatal */ }
      setCaptureSaving(false);
    }
    goNext();
  };

  const back = () => setStep(s => Math.max(s - 1, 1) as 1 | 2 | 3 | 4 | 5);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div className={`relative z-10 min-h-screen pb-20 text-black ${promoVisible ? "pt-[84px] sm:pt-24" : "pt-16"}`} style={{ background: "#f1efe7" }}>
      {/* Trust microbar — editorial style (matches homepage) */}
      <div className="bg-black/[0.025] border-b border-black/10 py-2.5">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">
              <Star className="w-3 h-3 text-black fill-black" /> 4.9 · 127 Reviews
            </span>
            <span className="hidden sm:inline-block w-px h-3 bg-black/15" />
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">
              <EstAccentSquare /> 60s Quote
            </span>
            <span className="hidden sm:inline-block w-px h-3 bg-black/15" />
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">
              <EstAccentSquare /> Fully Insured
            </span>
            <span className="hidden sm:inline-block w-px h-3 bg-black/15" />
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">
              <EstAccentSquare /> Island-Wide
            </span>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className={`sticky z-40 bg-[#f1efe7]/95 backdrop-blur border-b border-black/15 ${promoVisible ? "top-[84px] sm:top-24" : "top-16"}`}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2 flex-1">
                <div className="relative shrink-0">
                  <div className={`w-7 h-7 flex items-center justify-center text-xs font-black transition-all ${
                    step > s.num ? "bg-black text-white" :
                    step === s.num ? "bg-black text-white" :
                    "bg-black/[0.05] text-black/25"
                  }`}>
                    {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  {s.num === 3 && items.length > 0 && step <= 3 && (
                    <div data-testid="badge-items-count" className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-black text-white text-[9px] font-black flex items-center justify-center rounded-full" aria-label={`${items.length} items added`}>
                      {items.length}
                    </div>
                  )}
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
                <div className="relative overflow-hidden -mx-4 px-4 pb-2">

                  <EstDotGrid opacity={0.32} />

                  <div className="relative">

                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-black/45 mb-3">

                      <EstAccentSquare /> Step 1 of 5

                    </p>

                    <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">What do you need?</h2>

                    <p className="text-sm text-black/45">Select one or more services — you can mix and match.</p>

                  </div>

                </div>
                <div className="grid grid-cols-1 gap-3">
                  {(() => {
                    const relocateActive = services.includes("relocate");
                    const cards = [
                      {
                        type: "install" as ServiceType,
                        icon: <Wrench className="w-6 h-6" />,
                        label: "Installation",
                        desc: "Assemble and install new furniture at your location",
                        priceHint: "from $80/item",
                        // Disabled when Relocation is selected (Relocation already includes install)
                        coveredByRelocate: true,
                      },
                      {
                        type: "dismantle" as ServiceType,
                        icon: <Scissors className="w-6 h-6" />,
                        label: "Dismantling",
                        desc: "Carefully take apart existing furniture (no transport)",
                        priceHint: "from $60/item",
                        coveredByRelocate: true,
                      },
                      {
                        type: "relocate" as ServiceType,
                        icon: <Truck className="w-6 h-6" />,
                        label: "Relocation / Move",
                        desc: "Complete door-to-door bundle — pick this if you're moving furniture from one place to another",
                        priceHint: "from $120/item",
                        coveredByRelocate: false,
                        isBundle: true,
                        bundleItems: ["Dismantle at origin", "Transport in our van", "Reinstall at new home"],
                      },
                    ] as const;
                    return cards.map(({ type, icon, label, desc, priceHint, coveredByRelocate, isBundle, bundleItems }) => {
                      const active = services.includes(type);
                      // Disabled (covered) when relocate is on and this card is install/dismantle
                      const isCovered = relocateActive && coveredByRelocate;
                      const handleClick = () => {
                        if (isCovered) return; // ignore — visually shown as already included
                        if (type === "relocate" && !active) {
                          // Selecting Relocation auto-clears Install/Dismantle (they're bundled in)
                          setServices(prev => [...prev.filter(s => s !== "install" && s !== "dismantle"), "relocate"]);
                        } else {
                          setServices(prev => active ? prev.filter(s => s !== type) : [...prev, type]);
                        }
                      };
                      return (
                        <button
                          key={type}
                          type="button"
                          data-testid={`service-${type}`}
                          onClick={handleClick}
                          disabled={isCovered}
                          aria-disabled={isCovered}
                          tabIndex={isCovered ? -1 : 0}
                          className={`group relative border p-5 text-left transition-all duration-150 ${
                            isCovered
                              ? "border-black/15 bg-[rgba(250,250,247,0.88)] cursor-default"
                              : active
                                ? "border-black border-l-[3px] bg-[rgba(250,250,247,0.92)]"
                                : "border-black/12 bg-[rgba(250,250,247,0.85)] hover:border-black/35"
                          }`}
                          style={active ? { borderLeftColor: EST_ACCENT, borderLeftWidth: 3 } : undefined}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isCovered
                                ? "text-black"
                                : active ? "bg-black text-white" : "bg-black/[0.05] text-black/50"
                            }`}
                            style={isCovered ? { background: EST_ACCENT } : undefined}
                            >
                              {isCovered ? <Check className="w-6 h-6" /> : icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-black text-base uppercase tracking-[0.04em] ${isCovered ? "text-black/55 line-through decoration-2 decoration-black/30" : ""}`}>{label}</p>
                                {isBundle && !isCovered && (
                                  <span className="text-[10px] font-black px-2 py-0.5 tracking-[0.18em] uppercase text-black" style={{ background: EST_ACCENT }}>ALL-IN-ONE BUNDLE</span>
                                )}
                                {!isCovered && (
                                  <span className="text-[10px] font-black px-2 py-0.5 tracking-[0.18em] uppercase bg-black/[0.05] text-black/55">{priceHint}</span>
                                )}
                                {isCovered && (
                                  <span className="text-[10px] font-black px-2 py-0.5 tracking-[0.18em] uppercase text-black" style={{ background: EST_ACCENT }}>INCLUDED IN RELOCATION</span>
                                )}
                              </div>
                              <p className={`text-sm mt-0.5 ${isCovered ? "text-black/45" : "text-black/45"}`}>{desc}</p>

                              {/* Bundle includes — only on the Relocation card */}
                              {isBundle && bundleItems && (
                                <div className="mt-3 pt-3 border-t border-black/10">
                                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/55 mb-2"><EstAccentSquare /> What's included</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {bundleItems.map(b => (
                                      <span key={b} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 border border-black/15 bg-[rgba(250,250,247,0.7)] text-black">
                                        <Check className="w-3 h-3" style={{ color: EST_ACCENT === "#2af56a" ? "#0a8a3c" : EST_ACCENT }} /> {b}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-[11px] text-black/50 mt-2 leading-relaxed">
                                    <span className="font-bold">Don't add Dismantle or Installation separately</span> — they're already bundled in at a discount.
                                  </p>
                                </div>
                              )}
                            </div>
                            {!isCovered && (
                              <div className={`w-5 h-5 border flex items-center justify-center shrink-0 mt-1 transition-all ${
                                active ? "bg-black border-black" : "border-black/20"
                              }`}>
                                {active && <Check className="w-3 h-3 text-white" />}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    });
                  })()}

                  {/* ── Disposal card (special — has sub-mode toggle) ── */}
                  {(() => {
                    const disposalActive = services.includes("dispose") || services.includes("dismantle_dispose");
                    const toggleDisposal = () => {
                      if (disposalActive) {
                        setServices(prev => prev.filter(s => s !== "dispose" && s !== "dismantle_dispose"));
                      } else {
                        setServices(prev => [...prev, disposalMode]);
                      }
                    };
                    const switchMode = (mode: "dispose" | "dismantle_dispose") => {
                      setDisposalMode(mode);
                      setServices(prev => {
                        const without = prev.filter(s => s !== "dispose" && s !== "dismantle_dispose");
                        return [...without, mode];
                      });
                    };
                    return (
                      <div className={`border transition-all duration-150 ${disposalActive ? "border-black bg-black/[0.025]" : "border-black/10 bg-white"}`}>
                        <button
                          data-testid="service-dispose"
                          onClick={toggleDisposal}
                          className="w-full p-5 text-left"
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 flex items-center justify-center flex-shrink-0 transition-colors ${disposalActive ? "bg-black text-white" : "bg-black/[0.05] text-black/50"}`}>
                              <Trash2 className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                              <p className="font-black text-base uppercase tracking-[0.04em]">Disposal</p>
                              <p className="text-sm text-black/45 mt-0.5">Haul away and dispose of unwanted furniture</p>
                            </div>
                            <div className={`w-5 h-5 border flex items-center justify-center shrink-0 mt-1 transition-all ${disposalActive ? "bg-black border-black" : "border-black/20"}`}>
                              {disposalActive && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                        </button>
                        {disposalActive && (
                          <div className="px-5 pb-5 border-t border-black/10 pt-4 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-3">Choose disposal type</p>
                            <button
                              data-testid="disposal-mode-dismantle-dispose"
                              onClick={() => switchMode("dismantle_dispose")}
                              className={`w-full flex items-start gap-3 p-3 border text-left transition-all ${disposalMode === "dismantle_dispose" ? "border-black bg-black text-white" : "border-black/10 hover:border-black/30"}`}
                            >
                              <div className={`w-4 h-4 mt-0.5 border-2 rounded-full flex-shrink-0 flex items-center justify-center ${disposalMode === "dismantle_dispose" ? "border-white" : "border-black/30"}`}>
                                {disposalMode === "dismantle_dispose" && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <div>
                                <p className="font-black text-sm uppercase tracking-[0.04em]">Dismantle + Dispose <span className={`ml-1 text-[10px] px-1.5 py-0.5 ${disposalMode === "dismantle_dispose" ? "bg-white/20" : "bg-green-100 text-green-700"}`}>SAVE MORE</span></p>
                                <p className={`text-xs mt-0.5 ${disposalMode === "dismantle_dispose" ? "text-white/60" : "text-black/45"}`}>We dismantle the furniture first, then dispose — bundle price is cheaper than disposal only</p>
                              </div>
                            </button>
                            <button
                              data-testid="disposal-mode-dispose-only"
                              onClick={() => switchMode("dispose")}
                              className={`w-full flex items-start gap-3 p-3 border text-left transition-all ${disposalMode === "dispose" ? "border-black bg-black text-white" : "border-black/10 hover:border-black/30"}`}
                            >
                              <div className={`w-4 h-4 mt-0.5 border-2 rounded-full flex-shrink-0 flex items-center justify-center ${disposalMode === "dispose" ? "border-white" : "border-black/30"}`}>
                                {disposalMode === "dispose" && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <div>
                                <p className="font-black text-sm uppercase tracking-[0.04em]">Disposal Only</p>
                                <p className={`text-xs mt-0.5 ${disposalMode === "dispose" ? "text-white/60" : "text-black/45"}`}>Haul away assembled furniture as-is — no dismantling included</p>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {services.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {services.map(s => {
                      const labels: Record<string, string> = { install: "Installation", dismantle: "Dismantling", relocate: "Relocation", dispose: "Disposal Only", dismantle_dispose: "Dismantle + Dispose" };
                      return (
                        <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1 border border-black/15 text-black bg-black/[0.03] text-xs font-black uppercase tracking-[0.08em]">
                          <Check className="w-3 h-3" /> {labels[s] ?? s}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Bundle upsell — show when Install selected but not Dismantle */}
                {services.includes("install") && !services.includes("dismantle") && !services.includes("relocate") && (
                  <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 px-4 py-3.5">
                    <Tag className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-xs uppercase tracking-[0.08em] text-amber-900">Save 40% — Add Dismantling</p>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">Replacing old furniture? When Installation + Dismantling are combined, the dismantle price drops 40%. Most popular for IKEA moves.</p>
                    </div>
                    <button
                      data-testid="button-add-dismantle-upsell"
                      onClick={() => setServices(prev => [...prev, "dismantle"])}
                      className="shrink-0 text-[10px] font-black uppercase tracking-[0.08em] bg-amber-600 text-white px-3 py-2 hover:bg-amber-700 transition-colors whitespace-nowrap"
                    >
                      Add it
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Address ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="relative overflow-hidden -mx-4 px-4 pb-2">

                  <EstDotGrid opacity={0.32} />

                  <div className="relative">

                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-black/45 mb-3">

                      <EstAccentSquare /> Step 2 of 5

                    </p>

                    <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">
                    {isRelocation ? "Pickup & Dropoff" : "Service Location"}
                  </h2>

                    <p className="text-sm text-black/45">
                    {isRelocation ? "Where should we pick up and deliver?" : "Where will the work take place?"}
                  </p>

                  </div>

                </div>
                <div className="bg-[rgba(250,250,247,0.88)] border border-black/12 p-6 space-y-5">
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
                    <>
                      <AddressInput required label="Service Address" value={serviceAddress} onSelect={(addr) => setServiceAddress(addr)} placeholder="e.g. 100 Beach Road Singapore 189702" />

                      {/* Access questions — gate floor / stairs surcharge until
                          the customer has actually answered. Without these
                          inputs we previously auto-added a Stairs/Floor Access
                          fee on every job, which was confusing. */}
                      <div className="border-t border-black/8 pt-5 space-y-5">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-2">Lift available?</p>
                          <div className="flex gap-2">
                            {[
                              { v: true, l: "Yes" },
                              { v: false, l: "No" },
                            ].map(opt => {
                              const active = accessAnswered && floors[0]?.hasLift === opt.v;
                              return (
                                <button key={String(opt.v)} type="button" data-testid={`lift-${opt.l.toLowerCase()}`}
                                  onClick={() => {
                                    setFloors([{ level: floors[0]?.level || "0", hasLift: opt.v }]);
                                    setAccessAnswered(true);
                                  }}
                                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-[0.08em] transition-all border ${
                                    active ? "border-black bg-black/[0.03] text-black" : "border-black/10 bg-white text-black/40 hover:border-black/30 hover:bg-slate-50"
                                  }`}
                                >{opt.l}</button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-2">Floor level</p>
                          <input
                            type="number" min="0" max="50"
                            value={floors[0]?.level ?? "0"}
                            onChange={e => {
                              setFloors([{ level: e.target.value, hasLift: floors[0]?.hasLift ?? true }]);
                              setAccessAnswered(true);
                            }}
                            placeholder="e.g. 1 (ground = 0)"
                            className="w-32 px-3 py-2.5 bg-white border border-black/10 text-center outline-none focus:border-black text-sm"
                            data-testid="input-floor-level-single"
                          />
                          <p className="text-[11px] text-black/40 mt-1.5">Use 0 for ground floor / landed.</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-2">Any stairs or difficult access?</p>
                          <div className="flex gap-2">
                            {([
                              { v: "no", l: "No", diff: "easy" as const },
                              { v: "yes", l: "Yes", diff: "hard" as const },
                              { v: "unsure", l: "Not sure", diff: "medium" as const },
                            ] as const).map(opt => {
                              const active = stairsAnswer === opt.v;
                              return (
                                <button key={opt.v} type="button" data-testid={`stairs-${opt.v}`}
                                  onClick={() => {
                                    setStairsAnswer(opt.v);
                                    setAccessDifficulty(opt.diff);
                                    setAccessAnswered(true);
                                  }}
                                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-[0.08em] transition-all border ${
                                    active ? "border-black bg-black/[0.03] text-black" : "border-black/10 bg-white text-black/40 hover:border-black/30 hover:bg-slate-50"
                                  }`}
                                >{opt.l}</button>
                              );
                            })}
                          </div>
                          {stairsAnswer === "unsure" && (
                            <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">We'll confirm access on-site — any extra fee is shown as an estimate until then.</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 3: Items ── */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="relative overflow-hidden -mx-4 px-4 pb-2">

                  <EstDotGrid opacity={0.32} />

                  <div className="relative">

                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-black/45 mb-3">

                      <EstAccentSquare /> Step 3 of 5

                    </p>

                    <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">Add Your Items</h2>

                    <p className="text-sm text-black/45">Search our catalog, paste a list, or upload a photo.</p>

                  </div>

                </div>

                {/* Catalog Browse */}
                <div className="space-y-3">
                  {/* Category tabs */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {CATEGORY_TABS.map(tab => (
                      <button
                        key={tab.label}
                        data-testid={`category-tab-${tab.label.toLowerCase()}`}
                        onClick={() => { setActiveCategory(tab.label); setCatalogSearch(""); }}
                        className={`shrink-0 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] border transition-all ${
                          activeCategory === tab.label
                            ? "bg-black text-white border-black"
                            : "bg-white text-black/50 border-black/15 hover:border-black/40 hover:text-black"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/25 pointer-events-none" />
                    <input
                      value={catalogSearch}
                      onChange={e => { setCatalogSearch(e.target.value); if (e.target.value) setActiveCategory("All"); }}
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

                  {/* Search results dropdown (when searching) */}
                  {showCatalogResults && catalogSearch.trim() && (
                    <div className="border border-black/10 overflow-hidden bg-white">
                      {filteredGroups.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-black/40">
                          No items found for <strong>"{catalogSearch}"</strong>
                        </div>
                      ) : (
                        filteredGroups.map(group => {
                          const isSpecial = group.entries.some(e => requiresSpecialHandling(e.sku));
                          const showLiftWarning = isSpecial && services.includes('relocate');
                          return (
                          <button
                            key={group.name}
                            onClick={() => { addCatalogGroup(group, 1); setCatalogSearch(""); setCatalogFocused(false); }}
                            data-testid={`catalog-item-${group.name.toLowerCase().replace(/\s+/g, "-")}`}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 border-b border-black/6 last:border-0 transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{group.name}</p>
                              <p className="text-xs text-black/35">{group.category}</p>
                              {showLiftWarning && (
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mt-1" data-testid={`badge-lift-warning-${group.name.toLowerCase().replace(/\s+/g, '-')}`}>
                                  ⚠ Won't fit in lift — needs survey
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              {(() => {
                                if (services.length === 1 && services[0] === 'relocate') {
                                  const rel = group.entries.find(e => e.serviceType === 'relocate');
                                  if (rel) {
                                    const inst = group.entries.find(e => e.serviceType === 'install');
                                    const dis = group.entries.find(e => e.serviceType === 'dismantle');
                                    const fullPrice = computeDRPrice(
                                      inst ? parseFloat(inst.basePrice) : undefined,
                                      dis ? parseFloat(dis.basePrice) : undefined,
                                      parseFloat(rel.basePrice),
                                    );
                                    return (
                                      <div className="flex items-center gap-2 justify-end">
                                        {serviceBadge('relocate')}
                                        <span className="text-xs font-bold">{fullPrice <= 0 ? 'FREE' : `$${fullPrice.toFixed(0)}`}</span>
                                      </div>
                                    );
                                  }
                                }
                                return group.entries.filter(e => services.includes(e.serviceType)).map(e => {
                                  let displayPrice = parseFloat(e.basePrice);
                                  if (e.serviceType === 'relocate') {
                                    const inst2 = group.entries.find(x => x.serviceType === 'install');
                                    const dis2  = group.entries.find(x => x.serviceType === 'dismantle');
                                    displayPrice = computeDRPrice(
                                      inst2 ? parseFloat(inst2.basePrice) : undefined,
                                      dis2 ? parseFloat(dis2.basePrice) : undefined,
                                      parseFloat(e.basePrice),
                                    );
                                  }
                                  return (
                                    <div key={e.id} className="flex items-center gap-2 justify-end">
                                      {serviceBadge(e.serviceType)}
                                      <span className="text-xs font-bold">{e.serviceType === 'relocate' && displayPrice <= 0 ? 'FREE' : `$${displayPrice.toFixed(0)}`}</span>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </button>
                        );})
                      )}
                    </div>
                  )}

                  {/* Browse grid (when not searching — show popular items as cards) */}
                  {!catalogSearch.trim() && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/35 mb-2">
                        {activeCategory === "All" ? "Popular items — tap to add" : `${activeCategory} — tap to add`}
                      </p>
                      {filteredGroups.length === 0 ? (
                        <p className="text-sm text-black/35 py-4 text-center">No items in this category</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {filteredGroups.map(group => {
                            const alreadyAdded = items.some(i => i.name === group.name);
                            const isSpecial = group.entries.some(e => requiresSpecialHandling(e.sku));
                            const showLiftWarning = isSpecial && services.includes('relocate');
                            const priceDisplay = (() => {
                              if (services.length === 1 && services[0] === 'relocate') {
                                const rel = group.entries.find(e => e.serviceType === 'relocate');
                                if (rel) {
                                  const inst = group.entries.find(e => e.serviceType === 'install');
                                  const dis = group.entries.find(e => e.serviceType === 'dismantle');
                                  const fullPrice = computeDRPrice(
                                    inst ? parseFloat(inst.basePrice) : undefined,
                                    dis ? parseFloat(dis.basePrice) : undefined,
                                    parseFloat(rel.basePrice),
                                  );
                                  return fullPrice <= 0 ? 'FREE' : `$${fullPrice.toFixed(0)}`;
                                }
                              }
                              const relevant = group.entries.filter(e => services.includes(e.serviceType));
                              if (relevant.length === 0) return null;
                              const total = relevant.reduce((s, e) => {
                                if (e.serviceType === 'relocate') {
                                  const inst2 = group.entries.find(x => x.serviceType === 'install');
                                  const dis2  = group.entries.find(x => x.serviceType === 'dismantle');
                                  return s + computeDRPrice(
                                    inst2 ? parseFloat(inst2.basePrice) : undefined,
                                    dis2 ? parseFloat(dis2.basePrice) : undefined,
                                    parseFloat(e.basePrice),
                                  );
                                }
                                return s + parseFloat(e.basePrice);
                              }, 0);
                              return total <= 0 ? 'FREE' : `$${total.toFixed(0)}`;
                            })();
                            return (
                              <button
                                key={group.name}
                                data-testid={`catalog-item-${group.name.toLowerCase().replace(/\s+/g, "-")}`}
                                data-added={alreadyAdded ? "true" : undefined}
                                aria-pressed={alreadyAdded}
                                onClick={() => addCatalogGroup(group, 1)}
                                className={`relative text-left p-3 border transition-all active:scale-[0.98] ${
                                  alreadyAdded
                                    ? "border-black bg-black/[0.03]"
                                    : "border-black/10 bg-white hover:border-black/40 hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <p className="font-semibold text-sm leading-tight line-clamp-2 flex-1">{group.name}</p>
                                  <div className={`shrink-0 w-5 h-5 flex items-center justify-center border transition-all ${alreadyAdded ? "bg-black border-black" : "border-black/20 hover:border-black"}`}>
                                    {alreadyAdded ? <Check className="w-3 h-3 text-white" /> : <Plus className="w-3 h-3 text-black/40" />}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <p className="text-[10px] text-black/35 truncate">{group.category}</p>
                                  {priceDisplay && <p className="text-xs font-black text-black shrink-0">{priceDisplay}</p>}
                                </div>
                                {showLiftWarning && (
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700 mt-1.5 leading-tight" data-testid={`badge-lift-warning-grid-${group.name.toLowerCase().replace(/\s+/g, '-')}`}>
                                    ⚠ Won't fit in lift — needs survey
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Photo Upload */}
                <div className="bg-[rgba(250,250,247,0.88)] border border-black/12 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-3 flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5" /> AI Photo Detection
                    <span className="text-black/25 font-normal normal-case tracking-normal">(optional · multiple photos)</span>
                  </p>
                  <input type="file" ref={fileInputRef} accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />

                  {/* While scanning */}
                  {photoDetecting && (
                    <div className="w-full border border-dashed border-black/20 py-6 flex flex-col items-center gap-2 text-black/50">
                      <Loader2 className="w-7 h-7 animate-spin" />
                      <span className="text-sm font-black">
                        {detectingProgress && detectingProgress.total > 1
                          ? `Scanning photo ${detectingProgress.current} of ${detectingProgress.total}…`
                          : "Scanning photo with AI…"}
                      </span>
                      <span className="text-xs text-black/35">Identifying furniture — this may take a few seconds</span>
                    </div>
                  )}

                  {/* Success state — photo grid + item chips + add more */}
                  {!photoDetecting && detectedPhotos.length > 0 && (
                    <div className="space-y-4">
                      {/* Thumbnail grid */}
                      <div className="flex flex-wrap gap-3">
                        {detectedPhotos.map((photo, idx) => (
                          <div key={idx} className="relative" data-testid={`detected-photo-${idx}`}>
                            <img src={photo.thumbnail} alt={`Photo ${idx + 1}`}
                              className="w-20 h-20 object-cover border border-black/15" />
                            {/* Item count badge */}
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-black text-white text-[11px] font-black flex items-center justify-center rounded-full">
                              {photo.count}
                            </div>
                            {/* Remove photo */}
                            <button
                              onClick={() => setDetectedPhotos(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute -bottom-2 -right-2 w-5 h-5 bg-white border border-black/20 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
                              data-testid={`button-remove-photo-${idx}`}>
                              <X className="w-3 h-3 text-black/60" />
                            </button>
                          </div>
                        ))}

                        {/* Add more photos tile */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="button-add-more-photos"
                          className="w-20 h-20 border-2 border-dashed border-black/20 flex flex-col items-center justify-center gap-1 hover:border-black/50 hover:bg-slate-50 transition-all text-black/35 hover:text-black/60">
                          <Plus className="w-5 h-5" />
                          <span className="text-[9px] font-black uppercase tracking-wide leading-tight text-center">Add<br/>More</span>
                        </button>
                      </div>

                      {/* Summary */}
                      <p className="text-sm font-black flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        {detectedPhotos.reduce((t, p) => t + p.count, 0)} item{detectedPhotos.reduce((t, p) => t + p.count, 0) !== 1 ? "s" : ""} detected from {detectedPhotos.length} photo{detectedPhotos.length !== 1 ? "s" : ""}
                      </p>

                      {/* All detected names as chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {detectedPhotos.flatMap(p => p.names).map((nm, i) => (
                          <span key={i} className="inline-flex items-center text-[10px] font-black uppercase tracking-[0.08em] bg-black text-white px-2 py-0.5">
                            {nm}
                          </span>
                        ))}
                      </div>

                      <p className="text-xs text-black/40">Review and adjust quantities in the item list below.</p>
                    </div>
                  )}

                  {/* Initial upload zone */}
                  {!photoDetecting && detectedPhotos.length === 0 && (
                    <button onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload-photo"
                      className="w-full border border-dashed border-black/20 py-6 flex flex-col items-center gap-2 hover:border-black/40 hover:bg-slate-50 transition-all text-black/35 hover:text-black/60">
                      <Camera className="w-7 h-7" />
                      <span className="text-sm font-black">Take or upload photos</span>
                      <span className="text-xs text-center">Select multiple photos at once — AI detects furniture from each one</span>
                    </button>
                  )}

                  {photoError && (
                    <p className="text-sm text-black/60 mt-3 flex items-center gap-1.5 border border-black/15 px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />{photoError}
                    </p>
                  )}
                </div>

                {/* Paste List */}
                <div className="bg-[rgba(250,250,247,0.88)] border border-black/12 p-5">
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
                  <div className="bg-[rgba(250,250,247,0.88)] border border-black/12 overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
                      <p className="font-black text-sm flex items-center gap-2 uppercase tracking-[0.06em]"><Package className="w-4 h-4 text-black/40" /> Items ({items.length})</p>
                      <p className="font-black text-sm">${subtotal.toFixed(2)}</p>
                    </div>
                    <div className="divide-y divide-black/6">
                      {items.map((item, idx) => {
                        const computedLine = pricingResult.itemLines[idx];
                        const displayUnitPrice = item.isCustom && computedLine?.unitPrice > 0
                          ? computedLine.unitPrice
                          : item.unitPrice;
                        const isFallback = item.isCustom && computedLine?.fallbackUsed && computedLine?.unitPrice > 0;
                        return (
                        <div key={item.id} data-testid={`item-${item.id}`} className="px-5 py-4 flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-semibold text-sm truncate">{item.name}</p>
                              {item.sku && <span className="text-[10px] border border-black/10 px-2 py-0.5 font-mono text-black/40">{item.sku}</span>}
                              {item.isCustom && <span className="text-[10px] border border-black/15 px-2 py-0.5 font-black uppercase tracking-[0.06em] text-black/50">Custom</span>}
                              {isFallback && <span className="text-[10px] border border-amber-200 bg-amber-50 px-2 py-0.5 font-black uppercase tracking-[0.06em] text-amber-600">Est.</span>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {serviceBadge(item.serviceType)}
                              {item.category && <span className="text-xs text-black/35">{item.category}</span>}
                            </div>
                            {/* Relocate sub-mode toggle — shown for all relocate items */}
                            {item.serviceType === 'relocate' && (
                              <div className="mt-2 inline-flex border border-black/15 overflow-hidden text-[10px] font-black uppercase tracking-[0.06em]">
                                <button
                                  data-testid={`button-full-relocate-${item.id}`}
                                  onClick={() => setItems(prev => prev.map(i => {
                                    if (i.id !== item.id) return i;
                                    // Re-derive prices from catalog in case item was added before toggle feature
                                    const grp = catalogGroups.find(g => g.entries.some(e => e.id === i.catalogItemId));
                                    const rel = grp?.entries.find(e => e.serviceType === 'relocate');
                                    const inst = grp?.entries.find(e => e.serviceType === 'install');
                                    const dis = grp?.entries.find(e => e.serviceType === 'dismantle');
                                    const carry = rel ? parseFloat(rel.basePrice) : (i.carryPrice ?? i.unitPrice);
                                    const full = (inst && dis)
                                      ? computeDRPrice(parseFloat(inst.basePrice), parseFloat(dis.basePrice), carry)
                                      : (i.fullPrice ?? computeDRPrice(undefined, undefined, carry));
                                    return { ...i, relocateMode: 'full', carryPrice: carry, fullPrice: full, unitPrice: full };
                                  }))}
                                  className={`px-2.5 py-1.5 transition-colors ${item.relocateMode === 'full' ? 'bg-black text-white' : 'bg-white text-black/40 hover:text-black/70'}`}
                                >
                                  Dismantle &amp; Reinstall
                                </button>
                                <button
                                  data-testid={`button-carry-only-${item.id}`}
                                  onClick={() => setItems(prev => prev.map(i => {
                                    if (i.id !== item.id) return i;
                                    // Re-derive prices from catalog in case item was added before toggle feature
                                    const grp = catalogGroups.find(g => g.entries.some(e => e.id === i.catalogItemId));
                                    const rel = grp?.entries.find(e => e.serviceType === 'relocate');
                                    const inst = grp?.entries.find(e => e.serviceType === 'install');
                                    const dis = grp?.entries.find(e => e.serviceType === 'dismantle');
                                    const carry = rel ? parseFloat(rel.basePrice) : (i.carryPrice ?? i.unitPrice);
                                    const full = (inst && dis)
                                      ? computeDRPrice(parseFloat(inst.basePrice), parseFloat(dis.basePrice), carry)
                                      : (i.fullPrice ?? computeDRPrice(undefined, undefined, carry));
                                    // Fairness cap: customer should never pay more for less work.
                                    // For non-special-handling items, Carry Only is capped at the
                                    // D&R bundle price (e.g. single bed carry $80 → $63 D&R cap).
                                    const carryEffective = effectiveCarryPrice(
                                      inst ? parseFloat(inst.basePrice) : undefined,
                                      dis ? parseFloat(dis.basePrice) : undefined,
                                      carry,
                                      i.sku,
                                    );
                                    return { ...i, relocateMode: 'carry', carryPrice: carry, fullPrice: full, unitPrice: carryEffective };
                                  }))}
                                  className={`px-2.5 py-1.5 border-l border-black/15 transition-colors ${item.relocateMode === 'carry' ? 'bg-black text-white' : 'bg-white text-black/40 hover:text-black/70'}`}
                                >
                                  Carry Only
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
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
                            <p className="font-black text-sm">{isFallback ? "~" : ""}${(displayUnitPrice * item.quantity).toFixed(2)}</p>
                            <p className="text-xs text-black/35">{isFallback ? "~" : ""}${displayUnitPrice.toFixed(2)} ea</p>
                          </div>
                          <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                            data-testid={`button-remove-${item.id}`}
                            className="text-black/25 hover:text-black p-1.5 hover:bg-slate-100 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        );
                      })}
                    </div>
                    <div className="px-5 py-4 bg-black/[0.025] space-y-1.5 text-sm border-t border-black/8">
                      <div className="flex justify-between text-black/45"><span>Labor subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {items.some(i => i.serviceType === 'relocate') && (
                        <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium">
                          <Tag className="w-3 h-3 shrink-0" />
                          <span>Relocation: D&amp;R bundle rate applied — 40% off (install + dismantle combined)</span>
                        </div>
                      )}
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
                      {isRelocation && pricingResult.hasVolumeData && (
                        <div className="flex justify-between text-black/40 text-xs pt-1">
                          <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {pricingResult.totalVolumeM3.toFixed(2)} m³</span>
                          <span>{pricingResult.numTrips} {pricingResult.numTrips === 1 ? "trip" : "trips"}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-base pt-1.5 border-t border-black/10 mt-2">
                        <span className="uppercase tracking-[0.06em] text-sm">Estimated Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                      {isRelocation && hasDRMode && (
                        <div data-testid="notice-relocation-dr" className="mt-3 flex items-start gap-2 bg-green-50 border border-green-200 rounded px-3 py-2.5">
                          <span className="text-green-600 text-base leading-none mt-0.5">✓</span>
                          <div className="text-xs text-green-800 leading-relaxed">
                            <span className="font-black">No overtime charges.</span> Your job includes full dismantle &amp; reinstall service. D&amp;R labor covers the complete job duration — no additional time-based charges apply.
                          </div>
                        </div>
                      )}
                      {isRelocation && !hasDRMode && items.some(i => i.serviceType === 'relocate') && (
                        <div data-testid="notice-relocation-cap" className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-2.5">
                          <span className="text-blue-500 text-base leading-none mt-0.5">⏱</span>
                          <div className="text-xs text-blue-800 leading-relaxed">
                            <span className="font-black">2-hour job cap (Carry Only).</span> Carry Only pricing covers up to 120 minutes of crew and vehicle time. If the job runs longer: +$30 per 30-min block, capped at $200.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline + manpower banner — only shown for ≥50-unit projects */}
                {timelinePlan && (
                  <div data-testid="banner-timeline-plan" className="border-l-2 border-black bg-black/[0.025] px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Truck className="w-4 h-4 text-black" />
                      <p className="font-black text-xs uppercase tracking-[0.12em] text-black">Project Timeline &amp; Crew</p>
                      <span className="text-[10px] border border-black/15 px-2 py-0.5 font-black uppercase tracking-[0.08em] text-black/50">{timelinePlan.totalUnits} units</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div data-testid="stat-crew-size">
                        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black/40">Recommended crew</p>
                        <p className="font-black text-2xl text-black leading-tight">{timelinePlan.crewSize}-man</p>
                      </div>
                      <div data-testid="stat-days">
                        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black/40">Working days</p>
                        <p className="font-black text-2xl text-black leading-tight">{timelinePlan.days} {timelinePlan.days === 1 ? "day" : "days"}</p>
                      </div>
                      <div data-testid="stat-man-hours">
                        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-black/40">Total man-hours</p>
                        <p className="font-black text-2xl text-black leading-tight">{timelinePlan.totalManHours}h</p>
                      </div>
                    </div>
                    <div className="text-xs text-black/55 leading-relaxed border-t border-black/8 pt-3 space-y-1">
                      <p>
                        <span className="font-black text-black/70">How we calculated this:</span>{" "}
                        {timelinePlan.totalManHours} man-hours total (item-by-item field averages + 20% overhead for setup, breaks &amp; packaging) ÷ {timelinePlan.crewSize}-man crew × 7 productive hrs/day = {timelinePlan.days} working {timelinePlan.days === 1 ? "day" : "days"}.
                      </p>
                      <p className="text-black/40">
                        Final schedule confirmed after on-site survey — access, lift size and stairs can shift the figure either way. Larger crews available on request to compress the timeline.
                      </p>
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
            {step === 4 && (
              <div className="space-y-5">
                <div className="relative overflow-hidden -mx-4 px-4 pb-2">

                  <EstDotGrid opacity={0.32} />

                  <div className="relative">

                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-black/45 mb-3">

                      <EstAccentSquare /> Step 4 of 5

                    </p>

                    <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">Pick a Slot</h2>

                    <p className="text-sm text-black/45">Select a date, then choose your preferred time window.</p>

                  </div>

                </div>

                <SlotPicker
                  date={slotDateStr}
                  time={slotTime}
                  onDateChange={setSlotDateStr}
                  onTimeChange={setSlotTime}
                  availability={slotAvailability ?? null}
                />

                {/* Confirmation banner */}
                {slotDateStr && slotTime && !isSlotTaken(slotDateStr, slotTime) && (
                  <div className="border-l-2 border-emerald-500 bg-emerald-50/60 px-4 py-3 flex items-start gap-3">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black text-xs uppercase tracking-[0.1em] text-emerald-700">Slot Reserved</p>
                      <p className="text-sm text-black/60 mt-0.5">
                        {new Date(slotDateStr + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short", year: "numeric" })},{" "}
                        {TIME_SLOTS.find(t => t.value === slotTime)?.time}
                      </p>
                      <p className="text-xs text-black/35 mt-1">Held 48 hours — confirmed after deposit is paid.</p>
                    </div>
                  </div>
                )}

                <div className="border border-black/8 bg-black/[0.012] px-4 py-3">
                  <p className="text-xs text-black/45">
                    <strong>Note:</strong> This is your <em>preferred</em> slot — our team confirms it after deposit is paid.
                  </p>
                </div>
              </div>
            )}

            {/* ── STEP 5: Review ── */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="relative overflow-hidden -mx-4 px-4 pb-2">

                  <EstDotGrid opacity={0.32} />

                  <div className="relative">

                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-black/45 mb-3">

                      <EstAccentSquare /> Step 5 of 5

                    </p>

                    <h2 className="font-heading text-4xl font-black uppercase tracking-[-0.02em] text-black mb-1">Your Details</h2>

                    <p className="text-sm text-black/45">Review your estimate and enter your contact info.</p>

                  </div>

                </div>

                {/* Customer details form */}
                <div className="bg-[rgba(250,250,247,0.88)] border border-black/12 p-6 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40">Contact Information</p>

                  {/* If name + email already captured earlier, show a compact confirmation strip with edit toggle */}
                  {email && !showContactEditor ? (
                    <div className="flex items-start justify-between gap-4 px-4 py-3 bg-black/[0.03] border border-black/10">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-1">Sending quote to</p>
                        <p className="text-sm font-bold text-black truncate" data-testid="text-contact-summary">
                          {name ? `${name} · ` : ""}{email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowContactEditor(true)}
                        data-testid="button-edit-contact"
                        className="text-xs font-black uppercase tracking-[0.1em] text-black/60 hover:text-black underline shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.12em] text-black/40 mb-1.5 block">Full Name <span className="text-black">*</span></label>
                        <input required value={name} onChange={e => setName(e.target.value)} data-testid="input-name"
                          placeholder="e.g. James Tan Wei Ming" className="w-full px-4 py-3 bg-white border border-black/10 focus:border-black outline-none transition-all text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.12em] text-black/40 mb-1.5 block">Email <span className="text-black">*</span></label>
                        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email"
                          placeholder="e.g. james.tan@email.com" className="w-full px-4 py-3 bg-white border border-black/10 focus:border-black outline-none transition-all text-sm" />
                      </div>
                    </div>
                  )}

                  {/* Phone is always asked here (never collected in modal) */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.12em] text-black/40 mb-1.5 block">Phone <span className="text-black">*</span></label>
                    <input required value={phone} onChange={e => setPhone(e.target.value)} data-testid="input-phone"
                      placeholder="+65 9000 0000" className="w-full px-4 py-3 bg-white border border-black/10 focus:border-black outline-none transition-all text-sm" />
                    <p className="text-[11px] text-black/45 mt-1.5">We'll text you to confirm — no spam, ever.</p>
                  </div>
                </div>

                {/* Promo code field */}
                <div className="bg-[rgba(250,250,247,0.88)] border border-black/12 p-6">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-black/40 mb-4">Promo Code</p>
                  {promoStatus === "valid" && promoCode ? (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-green-50 border border-green-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-black text-green-800">{promoCode}</span>
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5">-${promoDiscount} OFF</span>
                        </div>
                        <p className="text-xs text-green-600 mt-1">{promoMessage}</p>
                      </div>
                      <button
                        onClick={removePromo}
                        data-testid="promo-remove"
                        className="text-xs font-semibold text-green-700 hover:text-red-600 underline transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={promoInput}
                          onChange={e => setPromoInput(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === "Enter" && applyPromo(promoInput)}
                          placeholder={promoBarData ? `Try ${promoBarData.code}` : "Enter promo code"}
                          data-testid="input-promo-code"
                          className="flex-1 px-4 py-3 bg-white border border-black/10 focus:border-black outline-none transition-all text-sm font-mono tracking-wider uppercase"
                          disabled={promoStatus === "validating"}
                        />
                        <button
                          onClick={() => applyPromo(promoInput)}
                          disabled={!promoInput.trim() || promoStatus === "validating"}
                          data-testid="promo-apply"
                          className="px-5 py-3 bg-black text-white text-xs font-black uppercase tracking-[0.1em] hover:bg-black/85 disabled:opacity-40 transition-all"
                        >
                          {promoStatus === "validating" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : "Apply"}
                        </button>
                      </div>
                      {promoStatus === "invalid" && promoMessage && (
                        <p className="text-xs text-red-600 font-semibold">{promoMessage}</p>
                      )}
                      {promoBarData && promoBarData.remaining > 0 && promoStatus === "idle" && (
                        <p className="text-[11px] text-amber-600 font-semibold">
                          🎉 Launch offer: Use <strong>{promoBarData.code}</strong> for ${promoBarData.discount} off — {promoBarData.remaining} slots left
                        </p>
                      )}
                    </div>
                  )}
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
                <div className="bg-[rgba(250,250,247,0.88)] border border-black/12 overflow-hidden">
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
                            <div className="flex items-center gap-2 flex-wrap">
                              {serviceBadge(item.serviceType)}
                              <span className="text-black/70">{item.name} ×{item.quantity}</span>
                              {item.isCustom && <span className="text-xs text-black/30">(TBD)</span>}
                              {item.serviceType === 'relocate' && item.relocateMode === 'carry' && (
                                <span className="text-[10px] font-black uppercase tracking-[0.06em] text-black/40">Carry Only</span>
                              )}
                              {item.serviceType === 'relocate' && item.relocateMode === 'full' && (
                                <span className="text-[10px] font-black uppercase tracking-[0.06em] text-black/40">Dismantle &amp; Reinstall</span>
                              )}
                              {item.serviceType === 'relocate' && requiresSpecialHandling(item.sku) && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700" data-testid={`badge-cart-lift-warning-${item.id}`}>
                                  ⚠ Won't fit in lift — survey needed
                                </span>
                              )}
                            </div>
                            <span className="font-black text-sm">{item.isCustom ? "TBD" : `$${(item.unitPrice * item.quantity).toFixed(2)}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {timelinePlan && (
                      <div className="pt-4" data-testid="review-timeline-plan">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/35 mb-2">Project Timeline &amp; Crew</p>
                        <div className="border border-black/10 px-3 py-2.5 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-black/55">Recommended crew</span>
                            <span className="font-black text-black">{timelinePlan.crewSize}-man</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-black/55">Estimated duration</span>
                            <span className="font-black text-black">{timelinePlan.days} {timelinePlan.days === 1 ? "day" : "days"} ({timelinePlan.totalManHours} man-hrs)</span>
                          </div>
                          <p className="text-[10px] text-black/40 pt-1 border-t border-black/8 leading-relaxed">
                            {timelinePlan.totalManHours} man-hrs (incl. 20% overhead) ÷ {timelinePlan.crewSize}-man × 7 productive hrs/day = {timelinePlan.days} {timelinePlan.days === 1 ? "day" : "days"}. Confirmed after on-site survey.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="pt-4 space-y-2 text-sm">
                      <div className="flex justify-between text-black/45"><span>Labor subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {items.some(i => i.serviceType === 'relocate') && (
                        <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium">
                          <Tag className="w-3 h-3 shrink-0" />
                          <span>Relocation: D&amp;R bundle rate applied — 40% off (install + dismantle combined)</span>
                        </div>
                      )}
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
                      {isRelocation && pricingResult.hasVolumeData && (
                        <div className="mt-2 border border-black/8 bg-black/[0.015] px-3 py-2 space-y-1">
                          <div className="flex justify-between text-xs text-black/50">
                            <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Total volume</span>
                            <span>{pricingResult.totalVolumeM3.toFixed(2)} m³</span>
                          </div>
                          <div className="flex justify-between text-xs font-black text-black/70">
                            <span>Toyota Hiace trips needed</span>
                            <span>{pricingResult.numTrips} {pricingResult.numTrips === 1 ? "trip" : "trips"}</span>
                          </div>
                          {pricingResult.numTrips > 1 && (
                            <p className="text-[10px] text-black/40 mt-1">Load exceeds one van — an additional trip is included in the transport fee.</p>
                          )}
                        </div>
                      )}
                      {promoDiscount > 0 && promoCode && (
                        <div className="flex justify-between text-green-700 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" /> Promo: {promoCode}
                          </span>
                          <span>−${promoDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-base pt-2 border-t border-black/10">
                        <span className="uppercase tracking-[0.06em] text-sm">Grand Total</span>
                        <span>${grandTotalAfterPromo.toFixed(2)}</span>
                      </div>
                      {isRelocation && hasDRMode && (
                        <div data-testid="notice-relocation-dr-review" className="flex items-start gap-2 bg-green-50 border border-green-200 rounded px-3 py-2 mt-1">
                          <span className="text-green-600 text-sm leading-none mt-0.5">✓</span>
                          <p className="text-xs text-green-800 leading-relaxed">
                            <span className="font-black">No overtime charges.</span> This job includes full dismantle &amp; reinstall. D&amp;R labor covers the complete job duration — no additional time-based charges apply.
                          </p>
                        </div>
                      )}
                      {isRelocation && !hasDRMode && items.some(i => i.serviceType === 'relocate') && (
                        <div data-testid="notice-relocation-cap-review" className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-2 mt-1">
                          <span className="text-blue-500 text-sm leading-none mt-0.5">⏱</span>
                          <p className="text-xs text-blue-800 leading-relaxed">
                            <span className="font-black">2-hour job cap (Carry Only).</span> Carry Only pricing covers up to 120 minutes of crew and vehicle time. If the job runs longer: +$30 per 30-min block, capped at $200.
                          </p>
                        </div>
                      )}
                      <div className="flex justify-between text-black/45"><span>Deposit after confirmation (50%)</span><span className="font-black">${effectiveDeposit.toFixed(2)}</span></div>
                      <div className="flex justify-between text-black/45"><span>Balance on completion (50%)</span><span>${effectiveFinal.toFixed(2)}</span></div>
                      <div className="flex items-start gap-2 text-[11px] text-black/55 leading-relaxed mt-2 border-t border-black/8 pt-3">
                        <Check className="w-3.5 h-3.5 text-black/40 shrink-0 mt-0.5" />
                        <span>Submitting this request <strong>does not charge you</strong>. We'll confirm details &amp; your slot by WhatsApp first — only then does the deposit secure your booking.</span>
                      </div>
                      {pricingResult.feeLines.some(f => f.label.toLowerCase().includes('stairs') || f.label.toLowerCase().includes('access')) && !accessAnswered && (
                        <div className="flex items-start gap-2 text-[11px] text-amber-700 leading-relaxed mt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>Floor / access fee shown is an <strong>estimate</strong> — confirmed on-site once we see the building.</span>
                        </div>
                      )}
                      {pricingResult.requiresAdminReview && (
                        <div className="mt-2 flex items-start gap-2 border border-black/10 bg-black/[0.015] px-3 py-2">
                          <AlertCircle className="w-4 h-4 text-black/40 shrink-0 mt-0.5" />
                          <p className="text-xs text-black/55">This quote includes items requiring admin review — final pricing may be adjusted.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* What happens next — sets clear expectations so the customer
                    knows submitting is a request, not a charge. */}
                <div className="bg-[rgba(250,250,247,0.88)] border border-black/12 p-6" data-testid="section-what-happens-next">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/50 mb-4">
                    <EstAccentSquare /> What Happens Next
                  </p>
                  <ol className="space-y-3">
                    {[
                      { n: 1, t: "We review your request", d: "Usually within a few hours during business hours." },
                      { n: 2, t: "We confirm details & slot by WhatsApp", d: "Final pricing locked in once we agree on the schedule." },
                      { n: 3, t: "Deposit secures the booking", d: "50% deposit only after you've confirmed — sent via PayNow or card link." },
                      { n: 4, t: "Balance is paid after completion", d: "Once the job is done and you're happy with the work." },
                    ].map(s => (
                      <li key={s.n} className="flex items-start gap-3">
                        <span className="w-6 h-6 shrink-0 bg-black text-white text-[11px] font-black flex items-center justify-center mt-0.5">{s.n}</span>
                        <div className="min-w-0">
                          <p className="font-black text-sm text-black uppercase tracking-[0.04em]">{s.t}</p>
                          <p className="text-xs text-black/50 mt-0.5 leading-relaxed">{s.d}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
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

        {/* Live price bar — visible from step 3 onwards when items exist */}
        {items.length > 0 && step >= 3 && step < 5 && (
          <div className="mt-6 border border-black/10 bg-black/[0.02] px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Package className="w-4 h-4 text-black/40 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-black/40">Estimated total</p>
                <p className="font-black text-lg leading-none tabular-nums">
                  ${total.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-black/40">{items.length} item{items.length !== 1 ? "s" : ""}</p>
                <p className="text-xs text-black/40">50% deposit ${effectiveDeposit.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 gap-4">
          {step > 1 ? (
            <button onClick={back} data-testid="button-back"
              className="flex items-center gap-2 px-5 py-3 border border-black/30 text-black font-black text-[11px] uppercase tracking-[0.22em] hover:bg-black hover:text-white hover:border-black transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < 5 ? (
            <button onClick={next} disabled={!canNext()} data-testid="button-next"
              className="bg-black text-white flex items-center gap-2 px-7 py-3 font-black text-[11px] uppercase tracking-[0.22em] hover:bg-neutral-800 disabled:opacity-35 disabled:cursor-not-allowed transition-colors">
              {step === 1 ? "Next" : step === 2 ? "Add Items" : step === 3 ? `Continue · ${items.length}` : "Review"}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !email.trim() || !phone.trim() || !termsAccepted}
              data-testid="button-submit"
              className="text-black flex items-center gap-2 px-7 py-3 font-black text-[11px] uppercase tracking-[0.22em] hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-opacity"
              style={{ background: EST_ACCENT }}
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <>Request My Quote <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
        </div>

        {/* Save-progress secondary link — step 3 only, optional + low-emphasis */}
        {step === 3 && items.length > 0 && (
          <div className="text-center mt-3">
            <button
              type="button"
              data-testid="button-save-progress"
              onClick={() => { setCaptureShown(true); setShowCaptureModal(true); }}
              className="inline-flex items-center gap-1.5 text-xs text-black/40 hover:text-black/70 transition-colors underline underline-offset-2"
            >
              Email me my progress so I can finish later (optional)
            </button>
          </div>
        )}

        {/* WhatsApp escape hatch — step 5 only · prefilled with everything we
            already know about the customer's request so they don't have to
            re-type it on WhatsApp. */}
        {step === 5 && (() => {
          const slotLabel = slotDateStr && slotTime
            ? `${new Date(slotDateStr + "T12:00:00").toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })} · ${TIME_SLOTS.find(t => t.value === slotTime)?.label || slotTime}`
            : "";
          const serviceLabels: Record<string, string> = { install: "Installation", dismantle: "Dismantling", relocate: "Relocation", dispose: "Disposal", dismantle_dispose: "Dismantle + Dispose" };
          const itemLines = items.slice(0, 8).map(i => `• ${i.name} ×${i.quantity}`);
          if (items.length > 8) itemLines.push(`• … +${items.length - 8} more`);
          const lines = [
            "Hi TMG Install — I started a quote on your site:",
            "",
            services.length ? `Services: ${services.map(s => serviceLabels[s] || s).join(", ")}` : "",
            isRelocation
              ? (pickupAddress ? `Pickup: ${pickupAddress}` : "")
              : (serviceAddress ? `Address: ${serviceAddress}` : ""),
            isRelocation && dropoffAddress ? `Dropoff: ${dropoffAddress}` : "",
            slotLabel ? `Preferred slot: ${slotLabel}` : "",
            itemLines.length ? "" : "",
            itemLines.length ? "Items:" : "",
            ...itemLines,
            "",
            total > 0 ? `Estimated total: $${grandTotalAfterPromo.toFixed(2)}` : "",
            "",
            "Could you help me confirm?",
          ].filter(Boolean);
          const waHref = `https://wa.me/6580880757?text=${encodeURIComponent(lines.join("\n"))}`;
          return (
            <div className="text-center mt-3">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-whatsapp-escape"
                onClick={() => trackEvent("cta_click", "/estimate", "whatsapp_escape_step5")}
                className="inline-flex items-center gap-1.5 text-xs text-black/35 hover:text-black/60 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Prefer to chat? WhatsApp us with these details
              </a>
            </div>
          );
        })()}
      </div>
    </div>

    {/* Terms & Conditions Modal */}
    {showTermsModal && (
      <div className="fixed inset-0 z-50 tmg-scrim flex items-center justify-center p-4" onClick={() => setShowTermsModal(false)}>
        <div
          className="bg-[#fafaf7] border border-black/20 max-w-2xl w-full max-h-[85vh] flex flex-col"
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
                <li><strong>Relocation jobs</strong> include up to <strong>120 minutes (2 hours)</strong> of crew time. Jobs that exceed 120 minutes incur +$30 per 30-minute block, capped at $200 — our team will advise you on-site.</li>
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

    {/* ── Partial Lead Capture Modal ── */}
    {showCaptureModal && (
      <div className="fixed inset-0 z-50 tmg-scrim flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={() => saveCaptureAndNext(true)}>
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="bg-white w-full sm:max-w-md sm:border sm:border-black/15"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-0">
            <div>
              <p className="font-heading text-2xl font-black uppercase tracking-[-0.02em] leading-tight">Save your progress</p>
              <p className="text-sm text-black/50 mt-1 leading-relaxed">Enter your email and we'll keep your items saved — pick up right where you left off anytime.</p>
            </div>
            <button
              onClick={() => saveCaptureAndNext(true)}
              data-testid="button-capture-close"
              className="ml-4 p-1.5 text-black/30 hover:text-black transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Trust strip */}
          <div className="mx-6 mt-4 px-4 py-3 bg-black/[0.03] border border-black/8 flex items-center gap-3">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
            <p className="text-[11px] text-black/55 leading-snug">
              <strong className="text-black">4.9★ · 127 reviews</strong> · Fully insured · No hidden fees · Island-wide
            </p>
          </div>

          {/* Form */}
          <div className="px-6 pb-6 pt-4 space-y-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-black/40 mb-1.5">Email Address *</label>
              <input
                type="email"
                autoFocus
                value={captureEmail}
                onChange={e => setCaptureEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveCaptureAndNext(false); }}
                placeholder="you@email.com"
                data-testid="input-capture-email"
                className="w-full px-4 py-3 border border-black/15 text-sm outline-none focus:border-black transition-colors placeholder:text-black/25"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-black/40 mb-1.5">Your Name <span className="font-normal normal-case tracking-normal text-black/30">(optional)</span></label>
              <input
                type="text"
                value={captureName}
                onChange={e => setCaptureName(e.target.value)}
                placeholder="e.g. Sarah"
                data-testid="input-capture-name"
                className="w-full px-4 py-3 border border-black/15 text-sm outline-none focus:border-black transition-colors placeholder:text-black/25"
              />
            </div>

            <button
              onClick={() => saveCaptureAndNext(false)}
              disabled={captureSaving || !captureEmail.trim()}
              data-testid="button-capture-save"
              className="w-full bg-black text-white py-3.5 font-black text-xs uppercase tracking-[0.1em] hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {captureSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
            </button>

            <button
              onClick={() => saveCaptureAndNext(true)}
              data-testid="button-capture-skip"
              className="w-full text-center text-xs text-black/35 hover:text-black/60 transition-colors py-1"
            >
              Skip — continue without saving
            </button>

            <p className="text-[10px] text-black/30 text-center leading-relaxed">
              We'll only use your email to send you the resume link. No spam, ever.
            </p>
          </div>
        </motion.div>
      </div>
    )}
    </>
  );
}
