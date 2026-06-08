import { Clock } from "lucide-react";
import { getJobSchedule } from "@shared/pricing";

/**
 * Customer-facing job SCHEDULE line: how many movers, for how long, the total
 * man-hours that price covers, and the overtime rate beyond that. Scheduled
 * time is derived from the job scope (items + distance) via getJobSchedule —
 * never from dividing the price. Rendered on the estimate, quote status,
 * invoice, PDF, and admin quote screen so the customer always sees exactly what
 * their price covers BEFORE they pay the deposit and agree to the terms.
 */
export function QuoteScheduleNote({
  items,
  totalVolumeM3,
  distanceKm,
  isRelocation = true,
  crewSize,
  className = "",
}: {
  items: { serviceType: string; quantity: number; volumeM3?: number | null; carryOnly?: boolean }[];
  totalVolumeM3?: number;
  distanceKm?: number;
  isRelocation?: boolean;
  crewSize?: number;
  className?: string;
}) {
  const s = getJobSchedule({ items, totalVolumeM3, distanceKm, isRelocation, crewSize });
  const fmt = (n: number) => (n % 1 === 0 ? `${n}` : n.toFixed(1));
  const hrs = fmt(s.scheduledHours);
  const manHours = fmt(s.scheduledHours * s.crewSize);
  const crewRate = s.overtimePerManPerHour * s.crewSize;
  const movers = `${s.crewSize} mover${s.crewSize !== 1 ? "s" : ""}`;

  return (
    <div
      className={`border border-gray-200 bg-gray-50 px-3 py-2.5 ${className}`}
      data-testid="block-quote-schedule"
    >
      <div className="flex items-start gap-2">
        <Clock className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
        <div className="text-[11px] leading-relaxed text-gray-600">
          <p data-testid="text-scheduled-time">
            <span className="font-semibold text-gray-800">Included on-site time:</span>{" "}
            {movers} × {hrs} hour{hrs === "1" ? "" : "s"} ={" "}
            <span className="font-semibold text-gray-800">{manHours} man-hours</span>.
          </p>
          <p data-testid="text-overtime-rate" className="text-gray-500">
            Extra time beyond this is ${s.overtimePerManPerHour} per mover, per hour
            {" "}(= ${crewRate}/hour for your {s.crewSize}-person crew), billed in{" "}
            {s.blockMinutes}-minute blocks.
          </p>
        </div>
      </div>
    </div>
  );
}
