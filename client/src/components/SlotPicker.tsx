import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Sun, Sunset, Ban, Check, AlertCircle } from "lucide-react";

export interface SlotAvailability {
  blocked: { date: string; timeSlot: string | null }[];
  held: { date: string; timeSlot: string; quoteId: number }[];
  capacities: { date: string; timeSlot: string; usedAmount: number }[];
}

interface SlotPickerProps {
  date: string;
  time: string;
  onDateChange: (d: string) => void;
  onTimeChange: (t: string) => void;
  availability: SlotAvailability | null;
  minDate?: string;
  maxMonthsAhead?: number;
}

const TIME_SLOTS = [
  { value: "09:00-12:00", label: "Morning",   time: "9am – 12pm", duration: "3 hrs", Icon: Sun   },
  { value: "13:00-17:00", label: "Afternoon", time: "1pm – 5pm",  duration: "4 hrs", Icon: Sunset },
] as const;

const SLOT_CAPACITY = 500;

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function SlotPicker({ date, time, onDateChange, onTimeChange, availability, minDate, maxMonthsAhead = 4 }: SlotPickerProps) {
  const today = useMemo(() => new Date(), []);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const minStr = minDate ?? todayStr;

  const [calYear, setCalYear]   = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const cells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const offset   = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const arr: (number | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [calYear, calMonth]);

  const monthLabel = new Date(calYear, calMonth, 1).toLocaleString("en-SG", { month: "long", year: "numeric" });

  const isSlotTaken = (ds: string, ts: string): boolean => {
    if (!availability) return false;
    const adminBlocked = availability.blocked.some(b => b.date === ds && (b.timeSlot === null || b.timeSlot === ts));
    if (adminBlocked) return true;
    return availability.held.some(h => h.date === ds && h.timeSlot === ts);
  };

  const getUsedAmount = (ds: string, ts: string): number => {
    if (!availability) return 0;
    return availability.capacities.find(c => c.date === ds && c.timeSlot === ts)?.usedAmount ?? 0;
  };

  type DayStatus = "past" | "unavailable" | "full" | "partial" | "available";
  const getDayStatus = (ds: string): DayStatus => {
    if (ds < minStr) return "past";
    const mTaken = isSlotTaken(ds, "09:00-12:00");
    const aTaken = isSlotTaken(ds, "13:00-17:00");
    if (mTaken && aTaken) return "full";
    if (mTaken || aTaken) return "partial";
    return "available";
  };

  const prevMonth = () => {
    const d = new Date(calYear, calMonth - 1, 1);
    const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (d >= minMonth) { setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }
  };
  const nextMonth = () => {
    const d = new Date(calYear, calMonth + 1, 1);
    const cap = new Date(today.getFullYear(), today.getMonth() + maxMonthsAhead, 1);
    if (d < cap) { setCalMonth(d.getMonth()); setCalYear(d.getFullYear()); }
  };

  const handleDayClick = (ds: string, status: DayStatus) => {
    if (status === "past" || status === "unavailable" || status === "full") return;
    onDateChange(ds);
    onTimeChange("");
  };

  return (
    <div className="space-y-3">
      {/* ── Calendar ── */}
      <div className="bg-white border border-black/10">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
          <button onClick={prevMonth} data-testid="button-cal-prev"
            className="p-1.5 hover:bg-black/5 transition-colors text-black/35 hover:text-black rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="font-black text-xs uppercase tracking-[0.12em] text-black/70">{monthLabel}</p>
          <button onClick={nextMonth} data-testid="button-cal-next"
            className="p-1.5 hover:bg-black/5 transition-colors text-black/35 hover:text-black rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => (
              <div key={d} className="text-center text-[9px] font-black text-black/25 py-1 uppercase tracking-wider">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="h-11" />;
              const ds     = toDateStr(calYear, calMonth, day);
              const status = getDayStatus(ds);
              const isSel  = ds === date;
              const isToday = ds === todayStr;
              const disabled = status === "past" || status === "full";

              return (
                <button
                  key={ds}
                  data-testid={`button-cal-${ds}`}
                  disabled={disabled}
                  onClick={() => handleDayClick(ds, status)}
                  className={[
                    "relative flex flex-col items-center justify-center h-11 text-sm font-medium select-none transition-all overflow-hidden",
                    isSel
                      ? "bg-black text-white font-black"
                      : disabled
                        ? "text-black/15 cursor-not-allowed"
                        : "hover:bg-slate-50 cursor-pointer text-black/75 hover:text-black",
                    isToday && !isSel ? "ring-1 ring-inset ring-black/30" : "",
                  ].join(" ")}
                >
                  {/* Strikethrough for full days */}
                  {status === "full" && !isSel && (
                    <span className="line-through text-black/20 text-xs">{day}</span>
                  )}
                  {status !== "full" && (
                    <span className={isToday && !isSel ? "font-black text-black" : ""}>{day}</span>
                  )}

                  {/* Capacity strip at bottom of cell */}
                  {!isSel && status !== "past" && status !== "full" && (
                    <span className={[
                      "absolute bottom-0 left-0 right-0 h-[3px]",
                      status === "available" ? "bg-emerald-400/50" : "bg-amber-400/70",
                    ].join(" ")} />
                  )}
                  {isSel && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/30" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 px-4 py-2.5 border-t border-black/8 text-[9px] font-black uppercase tracking-[0.1em] text-black/35">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-400/60 shrink-0" /> Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-amber-400/80 shrink-0" /> Partial
          </span>
          <span className="flex items-center gap-1.5 opacity-40">
            <span className="line-through mr-0.5">00</span> Full
          </span>
        </div>
      </div>

      {/* ── Slot cards ── */}
      {date ? (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/40 flex items-center gap-1.5">
            <span className="w-3 h-px bg-black/20 inline-block" />
            {new Date(date + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short" })}
            <span className="w-3 h-px bg-black/20 inline-block" />
          </p>

          <div className="grid grid-cols-2 gap-2">
            {TIME_SLOTS.map(slot => {
              const taken  = isSlotTaken(date, slot.value);
              const sel    = time === slot.value;
              const used   = getUsedAmount(date, slot.value);
              const pct    = Math.min(100, Math.round((used / SLOT_CAPACITY) * 100));
              const barColor = pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-orange-400" : pct >= 50 ? "bg-amber-400" : "bg-emerald-400";

              return (
                <button
                  key={slot.value}
                  disabled={taken}
                  onClick={() => !taken && onTimeChange(slot.value)}
                  data-testid={`button-slot-${slot.value}`}
                  className={[
                    "relative flex flex-col items-start p-4 border transition-all text-left",
                    taken
                      ? "border-black/6 bg-black/[0.015] cursor-not-allowed"
                      : sel
                        ? "border-black bg-black"
                        : "border-black/12 bg-white hover:border-black/30 hover:bg-slate-50 cursor-pointer",
                  ].join(" ")}
                >
                  {/* Icon */}
                  <slot.Icon className={`w-5 h-5 mb-3 ${taken ? "text-black/15" : sel ? "text-white/70" : "text-black/35"}`} />

                  {/* Label */}
                  <p className={`font-black text-sm uppercase tracking-[0.05em] leading-none mb-0.5 ${taken ? "text-black/20" : sel ? "text-white" : "text-black"}`}>
                    {slot.label}
                  </p>

                  {/* Time */}
                  <p className={`text-xs leading-none mb-3 ${taken ? "text-black/15" : sel ? "text-white/60" : "text-black/40"}`}>
                    {slot.time}
                  </p>

                  {/* Duration pill */}
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 mb-4 ${
                    taken ? "bg-black/5 text-black/20"
                    : sel  ? "bg-white/15 text-white/70"
                    : "bg-black/6 text-black/40"
                  }`}>
                    {slot.duration}
                  </span>

                  {/* Capacity bar */}
                  {!taken && (
                    <div className="w-full space-y-1">
                      <div className={`w-full h-1 rounded-full overflow-hidden ${sel ? "bg-white/20" : "bg-black/8"}`}>
                        <div
                          className={`h-full rounded-full transition-all ${sel ? "bg-white/70" : barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className={`text-[9px] font-black uppercase tracking-wider ${sel ? "text-white/50" : "text-black/30"}`}>
                        {pct === 0 ? "Open" : `S$${Math.round(used)} / S$${SLOT_CAPACITY}`}
                      </p>
                    </div>
                  )}

                  {/* Full badge */}
                  {taken && (
                    <div className="flex items-center gap-1 mt-1">
                      <Ban className="w-3 h-3 text-black/20" />
                      <span className="text-[9px] font-black uppercase tracking-wider text-black/20">Full</span>
                    </div>
                  )}

                  {/* Selected check */}
                  {sel && !taken && (
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-white/70" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-black/15 p-6 text-center">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-black/15" />
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/30">Select a date above</p>
        </div>
      )}
    </div>
  );
}
