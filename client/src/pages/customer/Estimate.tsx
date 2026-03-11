import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wrench, Scissors, Truck, MapPin, Search, Plus, Minus, Trash2, 
  ChevronRight, ChevronLeft, Check, ClipboardList, Camera, X, 
  Loader2, AlertCircle, Star, Package, ArrowRight, Upload
} from "lucide-react";
import type { CatalogItem } from "@shared/schema";

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

function useAddressSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!query || query.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=N&getAddrDetails=Y&pageNum=1`);
        const data = await res.json();
        const addresses = (data.results || []).slice(0, 6).map((r: any) =>
          `${r.ADDRESS}${r.BUILDING && r.BUILDING !== "NIL" ? ", " + r.BUILDING : ""} Singapore ${r.POSTAL}`
        );
        setSuggestions(addresses);
      } catch { setSuggestions([]); }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);
  return { suggestions, loading };
}

function AddressInput({ value, onChange, placeholder, label, required }: {
  value: string; onChange: (v: string) => void; placeholder?: string; label: string; required?: boolean;
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
          onChange={e => { onChange(e.target.value); setShow(true); }}
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
            <button key={i} type="button" onMouseDown={() => { onChange(s); setShow(false); }}
              className="w-full text-left px-4 py-3 hover:bg-secondary text-sm border-b last:border-0 transition-colors"
            >{s}</button>
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
    map[key].entries.push({ id: item.id, sku: item.sku || "", serviceType: item.serviceType as ServiceType, basePrice: item.basePrice });
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
  { num: 4, label: "Review" },
];

export default function EstimateWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [services, setServices] = useState<ServiceType[]>([]);
  // Step 2
  const [serviceAddress, setServiceAddress] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [floors, setFloors] = useState<Floor[]>([{ level: "1", hasLift: true }]);
  const [accessDifficulty, setAccessDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  // Step 3
  const [items, setItems] = useState<LineItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [photoDetecting, setPhotoDetecting] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogDropdownRef = useRef<HTMLDivElement>(null);
  // Step 4
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isRelocation = services.includes("relocate");

  // Fetch catalog
  const { data: catalogRaw } = useQuery<CatalogItem[]>({
    queryKey: ["/api/catalog"],
    queryFn: () => fetch("/api/catalog").then(r => r.json()),
  });

  const catalogGroups = useMemo(() => groupCatalog(catalogRaw || []), [catalogRaw]);

  const filteredGroups = useMemo(() => {
    if (!catalogSearch.trim()) return catalogGroups.slice(0, 8);
    const q = catalogSearch.toLowerCase();
    return catalogGroups.filter(g =>
      g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) ||
      g.entries.some(e => e.sku.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [catalogSearch, catalogGroups]);

  // Close catalog dropdown on outside click
  useEffect(() => {
    function h(e: MouseEvent) { if (!catalogDropdownRef.current?.contains(e.target as Node)) setShowCatalogDropdown(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Pricing math ──────────────────────────────────────────────────────────

  const calcTransportFee = useCallback(() => {
    if (!isRelocation) return 0;
    let fee = 80;
    floors.forEach(f => {
      const lvl = parseInt(f.level) || 1;
      if (!f.hasLift && lvl > 1) fee += (lvl - 1) * 20;
    });
    if (accessDifficulty === "medium") fee += 30;
    if (accessDifficulty === "hard") fee += 80;
    return fee;
  }, [isRelocation, floors, accessDifficulty]);

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const transportFee = calcTransportFee();
  const total = subtotal + transportFee;
  const deposit = total * 0.3;
  const finalAmt = total * 0.7;

  // ── Catalog add ───────────────────────────────────────────────────────────

  const addCatalogGroup = (group: CatalogGroup, qty: number = 1) => {
    const relevant = group.entries.filter(e => services.includes(e.serviceType));
    if (relevant.length === 0) {
      // Add as custom for each selected service
      services.forEach(st => {
        setItems(prev => [...prev, { id: uid(), sku: "", name: group.name, category: group.category, serviceType: st, quantity: qty, unitPrice: 0, isCustom: true }]);
      });
      return;
    }
    relevant.forEach(entry => {
      setItems(prev => {
        const existing = prev.find(i => i.catalogItemId === entry.id);
        if (existing) {
          return prev.map(i => i.catalogItemId === entry.id ? { ...i, quantity: i.quantity + qty } : i);
        }
        return [...prev, { id: uid(), catalogItemId: entry.id, sku: entry.sku, name: group.name, category: group.category, serviceType: entry.serviceType, quantity: qty, unitPrice: parseFloat(entry.basePrice), isCustom: false }];
      });
    });
    setCatalogSearch("");
    setShowCatalogDropdown(false);
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoDetecting(true);
    setPhotoError("");
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const mimeType = file.type;
        const res = await fetch("/api/catalog/detect-items", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        const detected: { name: string; quantity: number }[] = data.detected || [];
        detected.forEach(({ name, quantity }) => {
          const lc = name.toLowerCase();
          const matched = catalogGroups.find(g => g.name.toLowerCase().includes(lc) || lc.includes(g.name.toLowerCase()));
          if (matched) { addCatalogGroup(matched, quantity || 1); }
          else {
            services.forEach(st => {
              setItems(prev => [...prev, { id: uid(), sku: "", name, category: "Custom", serviceType: st, quantity: quantity || 1, unitPrice: 0, isCustom: true }]);
            });
          }
        });
        if (detected.length === 0) setPhotoError("No furniture detected. Please try a clearer photo.");
        setPhotoDetecting(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setPhotoError("Detection failed. Please add items manually.");
      setPhotoDetecting(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const body = {
        customer: { name, email, phone },
        selectedServices: services,
        serviceAddress: isRelocation ? pickupAddress : serviceAddress,
        pickupAddress: isRelocation ? pickupAddress : undefined,
        dropoffAddress: isRelocation ? dropoffAddress : undefined,
        accessDifficulty: isRelocation ? accessDifficulty : undefined,
        floorsInfo: isRelocation ? JSON.stringify(floors) : undefined,
        items: items.filter(i => !i.isCustom).map(i => ({
          catalogItemId: i.catalogItemId,
          quantity: i.quantity,
          serviceType: i.serviceType,
          unitPrice: i.unitPrice,
          itemName: i.name,
          sku: i.sku,
        })),
        customItems: items.filter(i => i.isCustom).map(i => ({
          description: i.name,
          serviceType: i.serviceType,
          quantity: i.quantity,
        })),
        transportFee,
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
    return false;
  };

  const next = () => setStep(s => Math.min(s + 1, 4) as 1 | 2 | 3 | 4);
  const back = () => setStep(s => Math.max(s - 1, 1) as 1 | 2 | 3 | 4);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pt-20 pb-20 bg-secondary/30">
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
                      <AddressInput required label="Pickup Address" value={pickupAddress} onChange={setPickupAddress} placeholder="e.g. 100 Beach Road Singapore 189702" />
                      <AddressInput required label="Dropoff Address" value={dropoffAddress} onChange={setDropoffAddress} placeholder="e.g. 10 Bayfront Ave Singapore 018956" />
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
                    <AddressInput required label="Service Address" value={serviceAddress} onChange={setServiceAddress} placeholder="e.g. 100 Beach Road Singapore 189702" />
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
                  <div ref={catalogDropdownRef} className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        value={catalogSearch}
                        onChange={e => { setCatalogSearch(e.target.value); setShowCatalogDropdown(true); }}
                        onFocus={() => setShowCatalogDropdown(true)}
                        placeholder="e.g. wardrobe, bed, sofa…"
                        data-testid="input-catalog-search"
                        className="w-full pl-9 pr-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                      />
                    </div>
                    {showCatalogDropdown && filteredGroups.length > 0 && (
                      <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                        {filteredGroups.map(group => (
                          <button key={group.name} onMouseDown={e => { e.preventDefault(); addCatalogGroup(group, 1); }}
                            data-testid={`catalog-item-${group.name.toLowerCase().replace(/\s+/g, "-")}`}
                            className="w-full text-left px-4 py-3 hover:bg-secondary border-b last:border-0 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-sm">{group.name}</p>
                                <p className="text-xs text-muted-foreground">{group.category}</p>
                              </div>
                              <div className="text-right space-y-0.5">
                                {group.entries.filter(e => services.includes(e.serviceType)).map(e => (
                                  <div key={e.id} className="flex items-center gap-2 justify-end">
                                    {serviceBadge(e.serviceType)}
                                    <span className="text-xs font-bold text-foreground">${e.basePrice}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Photo Upload */}
                <div className="bg-card rounded-2xl border p-5">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Camera className="w-4 h-4 text-accent" /> Photo Detection <span className="text-muted-foreground font-normal text-xs">(optional)</span></p>
                  <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <button onClick={() => fileInputRef.current?.click()}
                    disabled={photoDetecting}
                    data-testid="button-upload-photo"
                    className="w-full border-2 border-dashed border-border rounded-xl py-4 flex flex-col items-center gap-2 hover:border-accent hover:bg-accent/5 transition-all text-muted-foreground hover:text-accent disabled:opacity-50"
                  >
                    {photoDetecting ? <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Detecting items…</span></> : <><Upload className="w-6 h-6" /><span className="text-sm font-medium">Upload photo to auto-detect items</span></>}
                  </button>
                  {photoError && <p className="text-sm text-destructive mt-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{photoError}</p>}
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
                      <div className="flex justify-between text-muted-foreground"><span>Items subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {isRelocation && <div className="flex justify-between text-muted-foreground"><span>Relocation logistics fee</span><span>${transportFee.toFixed(2)}</span></div>}
                      <div className="flex justify-between font-bold text-base pt-1 border-t border-border mt-2"><span>Estimated Total</span><span className="text-primary">${total.toFixed(2)}</span></div>
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

            {/* ── STEP 4: Review ── */}
            {step === 4 && (
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
                        placeholder="Jane Tan" className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-1.5 block">Phone <span className="text-destructive">*</span></label>
                      <input required value={phone} onChange={e => setPhone(e.target.value)} data-testid="input-phone"
                        placeholder="+65 9123 4567" className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">Email <span className="text-destructive">*</span></label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email"
                      placeholder="jane@example.com" className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all" />
                  </div>
                </div>

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
                      <div className="flex justify-between text-muted-foreground"><span>Items subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                      {isRelocation && <div className="flex justify-between text-muted-foreground"><span>Relocation logistics</span><span>${transportFee.toFixed(2)}</span></div>}
                      <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Grand Total (estimated)</span><span className="text-primary">${total.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Deposit (30%)</span><span>${deposit.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Balance on completion</span><span>${finalAmt.toFixed(2)}</span></div>
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

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 gap-4">
          {step > 1 ? (
            <button onClick={back} data-testid="button-back"
              className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-border bg-card font-semibold hover:bg-secondary transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < 4 ? (
            <button onClick={next} disabled={!canNext()} data-testid="button-next"
              className="btn-primary-gradient flex items-center gap-2 px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim() || !email.trim() || !phone.trim()}
              data-testid="button-submit"
              className="btn-primary-gradient flex items-center gap-2 px-8 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
            >
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <>Get Estimate <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
