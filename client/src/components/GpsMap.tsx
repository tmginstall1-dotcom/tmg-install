import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  Tooltip,
  CircleMarker,
  Circle,
  useMap,
  useMapEvents,
  ScaleControl,
} from "react-leaflet";
import { format } from "date-fns";
import L from "leaflet";

// ── Inject custom CSS animations ─────────────────────────────────────────────
const GPS_CSS = `
@keyframes gps-ripple {
  0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.65); }
  70%  { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}
.gps-live-ripple { animation: gps-ripple 1.5s ease-out infinite; }
.leaflet-tooltip-gps {
  background: rgba(15,23,42,0.92) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  border-radius: 6px !important;
  color: #f1f5f9 !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  padding: 5px 8px !important;
  white-space: nowrap !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35) !important;
}
.leaflet-tooltip-gps::before { display: none !important; }
.leaflet-popup-content-wrapper {
  border-radius: 8px !important;
  padding: 0 !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.22) !important;
  overflow: hidden !important;
}
.leaflet-popup-content { margin: 0 !important; }
.leaflet-popup-tip-container { display: none !important; }
`;

// ── Fix Leaflet default marker icons broken by Vite ──────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Tile layer definitions ────────────────────────────────────────────────────
const TILE_LAYERS = [
  {
    id: "street",
    label: "Street",
    emoji: "🗺",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attr: "© OpenStreetMap contributors",
  },
  {
    id: "satellite",
    label: "Satellite",
    emoji: "🛰",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attr: "© Esri, Maxar, Earthstar Geographics",
  },
  {
    id: "dark",
    label: "Dark",
    emoji: "🌙",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    maxZoom: 19,
    attr: "© CARTO",
  },
  {
    id: "light",
    label: "Light",
    emoji: "☀",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    maxZoom: 19,
    attr: "© CARTO",
  },
] as const;

type LayerId = (typeof TILE_LAYERS)[number]["id"];

// ── Speed color scale ─────────────────────────────────────────────────────────
function getSpeedColor(kmh: number | null): string {
  if (kmh === null || kmh < 0) return "#3b82f6";
  if (kmh < 2)  return "#94a3b8"; // stopped
  if (kmh < 15) return "#f59e0b"; // walking / very slow
  if (kmh < 60) return "#3b82f6"; // normal driving
  return "#22c55e";               // expressway / fast
}

const SPEED_LEGEND = [
  { color: "#94a3b8", label: "Stopped" },
  { color: "#f59e0b", label: "Slow (<15 km/h)" },
  { color: "#3b82f6", label: "Normal (<60 km/h)" },
  { color: "#22c55e", label: "Fast (60+ km/h)" },
];

// ── Marker icons ──────────────────────────────────────────────────────────────
const startIcon = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center">
    <div style="width:8px;height:8px;background:white;border-radius:50%"></div>
  </div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function makeEndIcon(isLive: boolean) {
  if (isLive) {
    return L.divIcon({
      className: "",
      html: `<div class="gps-live-ripple" style="width:22px;height:22px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(239,68,68,0.5)"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }
  return L.divIcon({
    className: "",
    html: `<div style="width:22px;height:22px;background:#475569;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function makeStopIcon(durationMins: number) {
  const badge = durationMins > 0
    ? `<div style="background:rgba(217,119,6,0.95);color:white;font-size:9px;font-weight:900;padding:1px 4px;margin-top:2px;border-radius:3px;white-space:nowrap;line-height:1.4">${durationMins}m</div>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:16px;height:16px;background:#f59e0b;border:2.5px solid white;border-radius:3px;box-shadow:0 1px 5px rgba(0,0,0,0.35)"></div>
      ${badge}
    </div>`,
    iconSize: [16, durationMins > 0 ? 32 : 16],
    iconAnchor: [8, 8],
  });
}

// ── Utility functions ─────────────────────────────────────────────────────────
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type TrackPoint = {
  id: number;
  lat: string;
  lng: string;
  accuracy: string | null;
  speed: string | null;
  heading: string | null;
  recordedAt: string;
};

interface StopMarker {
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
  durationMins: number;
}

interface ColoredSegment {
  from: [number, number];
  to: [number, number];
  color: string;
  speedKmh: number | null;
}

// ── Stop detection ────────────────────────────────────────────────────────────
function detectStops(points: TrackPoint[]): StopMarker[] {
  const stops: StopMarker[] = [];
  let i = 0;
  while (i < points.length) {
    const a = points[i];
    const aLat = parseFloat(a.lat), aLng = parseFloat(a.lng);
    let j = i + 1;
    while (j < points.length) {
      const d = haversineM(aLat, aLng, parseFloat(points[j].lat), parseFloat(points[j].lng));
      if (d <= 50) j++;
      else break;
    }
    if (j - i >= 2) {
      const start = new Date(a.recordedAt), end = new Date(points[j - 1].recordedAt);
      stops.push({
        lat: aLat, lng: aLng,
        startTime: start, endTime: end,
        durationMins: Math.round((end.getTime() - start.getTime()) / 60000),
      });
      i = j;
    } else {
      i++;
    }
  }
  return stops;
}

// ── Build speed-colored segments ──────────────────────────────────────────────
function buildColorSegments(points: TrackPoint[]): ColoredSegment[] {
  const segs: ColoredSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i], p2 = points[i + 1];
    const dist = haversineM(parseFloat(p1.lat), parseFloat(p1.lng), parseFloat(p2.lat), parseFloat(p2.lng));
    const timeSec = (new Date(p2.recordedAt).getTime() - new Date(p1.recordedAt).getTime()) / 1000;
    let speedKmh: number | null = null;
    if (p1.speed && parseFloat(p1.speed) >= 0) {
      speedKmh = parseFloat(p1.speed) * 3.6;
    } else if (timeSec > 0 && dist < 500) {
      speedKmh = (dist / timeSec) * 3.6;
    }
    segs.push({
      from: [parseFloat(p1.lat), parseFloat(p1.lng)],
      to:   [parseFloat(p2.lat), parseFloat(p2.lng)],
      color: getSpeedColor(speedKmh),
      speedKmh,
    });
  }
  return segs;
}

// ── Map helper components ─────────────────────────────────────────────────────

// Only fits the map to bounds ONCE on initial load — does NOT re-run on re-renders
// so that manual zoom/pan by the user is preserved.
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || positions.length === 0) return;
    fitted.current = true;
    if (positions.length === 1) {
      map.setView(positions[0], 17);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [48, 48] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only
  return null;
}

function MapResizeHandler({ trigger }: { trigger: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(timer);
  }, [trigger, map]);
  return null;
}

function CoordTracker({ onMove }: { onMove: (c: [number, number] | null) => void }) {
  useMapEvents({
    mousemove: (e) => onMove([e.latlng.lat, e.latlng.lng]),
    mouseout:  () => onMove(null),
  });
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
interface GpsMapProps {
  points: TrackPoint[];
  height?: number;
  isLive?: boolean;
}

export default function GpsMap({ points, height = 480, isLive = false }: GpsMapProps) {
  const [activeLayer, setActiveLayer] = useState<LayerId>("street");
  const [showAccuracy, setShowAccuracy] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mouseCoords, setMouseCoords] = useState<[number, number] | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Inject CSS animations once
  useEffect(() => {
    if (!styleRef.current) {
      const el = document.createElement("style");
      el.textContent = GPS_CSS;
      document.head.appendChild(el);
      styleRef.current = el;
    }
    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, []);

  if (points.length === 0) return null;

  const positions: [number, number][] = points.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
  const first = positions[0];
  const last  = positions[positions.length - 1];
  const stops = detectStops(points);
  const segments = buildColorSegments(points);

  // Route stats
  const totalDistM = points.length < 2 ? 0 : points.reduce((sum, pt, i) => {
    if (i === 0) return sum;
    const prev = points[i - 1];
    const d = haversineM(parseFloat(prev.lat), parseFloat(prev.lng), parseFloat(pt.lat), parseFloat(pt.lng));
    return d < 500 ? sum + d : sum;
  }, 0);
  const allSpeeds = segments.map(s => s.speedKmh).filter((s): s is number => s !== null && s > 0);
  const topSpeedKmh = allSpeeds.length > 0 ? Math.max(...allSpeeds) : null;
  const avgSpeedKmh = allSpeeds.length > 0 ? allSpeeds.reduce((a, b) => a + b, 0) / allSpeeds.length : null;
  const durationMins = points.length >= 2
    ? Math.round((new Date(points[points.length - 1].recordedAt).getTime() - new Date(points[0].recordedAt).getTime()) / 60000)
    : 0;

  const currentLayer = TILE_LAYERS.find(l => l.id === activeLayer)!;
  const endIcon = makeEndIcon(isLive);

  const mapHeight = isFullscreen ? "100vh" : `${height}px`;

  return (
    <div
      data-testid="gps-map-container"
      className={isFullscreen ? "fixed inset-0 z-[9999] flex flex-col bg-black" : "relative w-full"}
      style={isFullscreen ? undefined : { height }}
    >
      {/* ── Map ── */}
      <div className={isFullscreen ? "flex-1 relative" : "absolute inset-0"}>
        <MapContainer
          center={first}
          zoom={15}
          style={{ height: "100%", width: "100%", zIndex: 0 }}
          scrollWheelZoom
          attributionControl={false}
          zoomControl={true}
        >
          {/* Tile layer */}
          <TileLayer key={activeLayer} url={currentLayer.url} maxZoom={currentLayer.maxZoom} />

          {/* Scale bar */}
          <ScaleControl position="bottomright" imperial={false} />

          {/* Fit bounds + resize handlers */}
          <FitBounds positions={positions} />
          <MapResizeHandler trigger={isFullscreen} />
          <CoordTracker onMove={setMouseCoords} />

          {/* Speed-colored route segments */}
          {segments.map((seg, i) => (
            <Polyline
              key={i}
              positions={[seg.from, seg.to]}
              pathOptions={{ color: seg.color, weight: 4.5, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
            />
          ))}

          {/* Individual GPS point dots (toggleable) */}
          {showPoints && positions.map((pos, i) => {
            const pt = points[i];
            const acc = pt.accuracy ? parseFloat(pt.accuracy) : null;
            const spd = pt.speed ? (parseFloat(pt.speed) * 3.6).toFixed(1) : null;
            return (
              <CircleMarker
                key={pt.id}
                center={pos}
                radius={3}
                pathOptions={{
                  color: "#fff",
                  fillColor: getSpeedColor(spd ? parseFloat(spd) : null),
                  fillOpacity: 0.85,
                  weight: 1,
                  opacity: 0.9,
                }}
              >
                <Tooltip className="leaflet-tooltip-gps" direction="top" offset={[0, -5]}>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 2 }}>{format(new Date(pt.recordedAt), "HH:mm:ss")}</div>
                    {spd && <div style={{ color: "#94a3b8" }}>Speed: {spd} km/h</div>}
                    {acc && <div style={{ color: "#94a3b8" }}>Accuracy: ±{Math.round(acc)} m</div>}
                    {pt.heading && <div style={{ color: "#94a3b8" }}>Heading: {parseFloat(pt.heading).toFixed(0)}°</div>}
                    <div style={{ color: "#64748b", marginTop: 2 }}>
                      {parseFloat(pt.lat).toFixed(6)}, {parseFloat(pt.lng).toFixed(6)}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* Accuracy circles (toggleable) */}
          {showAccuracy && positions.map((pos, i) => {
            const acc = points[i].accuracy ? parseFloat(points[i].accuracy!) : null;
            if (!acc || acc > 200) return null;
            return (
              <Circle
                key={`acc-${points[i].id}`}
                center={pos}
                radius={acc}
                pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.04, weight: 0.5, opacity: 0.3 }}
              />
            );
          })}

          {/* Start marker */}
          <Marker position={first} icon={startIcon}>
            <Popup>
              <div style={{ padding: "10px 14px", minWidth: 160 }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "#16a34a", textTransform: "uppercase", marginBottom: 4 }}>
                  Shift Start
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
                  {format(new Date(points[0].recordedAt), "HH:mm:ss")}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {parseFloat(points[0].lat).toFixed(6)}, {parseFloat(points[0].lng).toFixed(6)}
                </div>
                {points[0].accuracy && (
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                    GPS accuracy: ±{Math.round(parseFloat(points[0].accuracy))} m
                  </div>
                )}
              </div>
            </Popup>
          </Marker>

          {/* End / Live marker */}
          {points.length > 1 && (
            <Marker position={last} icon={endIcon}>
              <Popup>
                <div style={{ padding: "10px 14px", minWidth: 160 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: isLive ? "#ef4444" : "#475569", textTransform: "uppercase", marginBottom: 4 }}>
                    {isLive ? "📍 Live Position" : "Last Seen"}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>
                    {format(new Date(points[points.length - 1].recordedAt), "HH:mm:ss")}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {parseFloat(last[0].toString()).toFixed(6)}, {parseFloat(last[1].toString()).toFixed(6)}
                  </div>
                  {points[points.length - 1].speed && (
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                      Speed: {(parseFloat(points[points.length - 1].speed!) * 3.6).toFixed(1)} km/h
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Stop markers */}
          {stops.map((s, idx) => (
            <Marker key={idx} position={[s.lat, s.lng]} icon={makeStopIcon(s.durationMins)}>
              <Popup>
                <div style={{ padding: "10px 14px", minWidth: 160 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "#d97706", textTransform: "uppercase", marginBottom: 4 }}>
                    ⏸ Stationary Stop
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 2 }}>
                    {s.durationMins > 0 ? `${s.durationMins} min` : "Brief stop"}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {format(s.startTime, "HH:mm")} – {format(s.endTime, "HH:mm")}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                    {s.lat.toFixed(6)}, {s.lng.toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* ── Layer switcher (top-right overlay) ── */}
        <div
          style={{ position: "absolute", top: 10, right: 42, zIndex: 900 }}
          className="flex flex-col gap-1"
        >
          {TILE_LAYERS.map(layer => (
            <button
              key={layer.id}
              data-testid={`map-layer-${layer.id}`}
              onClick={() => setActiveLayer(layer.id)}
              title={layer.label}
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                borderRadius: 6,
                border: activeLayer === layer.id ? "2px solid #2563eb" : "2px solid rgba(255,255,255,0.7)",
                background: activeLayer === layer.id ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.92)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
                cursor: "pointer",
                backdropFilter: "blur(6px)",
                transition: "all 0.15s",
              }}
            >
              {layer.emoji}
            </button>
          ))}
        </div>

        {/* ── Toggle controls (top-left overlay) ── */}
        <div
          style={{ position: "absolute", top: 10, left: 10, zIndex: 900 }}
          className="flex flex-col gap-1"
        >
          {/* Fullscreen */}
          <button
            data-testid="map-fullscreen-toggle"
            onClick={() => setIsFullscreen(fs => !fs)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            style={{
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, borderRadius: 6,
              border: "2px solid rgba(255,255,255,0.7)",
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
              cursor: "pointer", backdropFilter: "blur(6px)",
            }}
          >
            {isFullscreen ? "✕" : "⛶"}
          </button>

          {/* Show/hide point dots */}
          <button
            data-testid="map-toggle-points"
            onClick={() => setShowPoints(v => !v)}
            title={showPoints ? "Hide GPS points" : "Show GPS points"}
            style={{
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, borderRadius: 6,
              border: showPoints ? "2px solid #2563eb" : "2px solid rgba(255,255,255,0.7)",
              background: showPoints ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.92)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
              cursor: "pointer", backdropFilter: "blur(6px)",
            }}
          >
            ·
          </button>

          {/* Accuracy circles toggle */}
          <button
            data-testid="map-toggle-accuracy"
            onClick={() => setShowAccuracy(v => !v)}
            title={showAccuracy ? "Hide accuracy circles" : "Show accuracy circles"}
            style={{
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, borderRadius: 6,
              border: showAccuracy ? "2px solid #2563eb" : "2px solid rgba(255,255,255,0.7)",
              background: showAccuracy ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.92)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
              cursor: "pointer", backdropFilter: "blur(6px)",
            }}
          >
            ⊙
          </button>

          {/* Legend toggle */}
          <button
            data-testid="map-toggle-legend"
            onClick={() => setShowLegend(v => !v)}
            title="Speed legend"
            style={{
              width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, borderRadius: 6,
              border: showLegend ? "2px solid #2563eb" : "2px solid rgba(255,255,255,0.7)",
              background: showLegend ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.92)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
              cursor: "pointer", backdropFilter: "blur(6px)",
            }}
          >
            ≡
          </button>
        </div>

        {/* ── Stats panel (bottom-left overlay) ── */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: 10,
            zIndex: 900,
            background: "rgba(15,23,42,0.88)",
            backdropFilter: "blur(8px)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "white",
            fontSize: 11,
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px 16px",
            minWidth: 180,
          }}
        >
          <span style={{ color: "#94a3b8", fontSize: 10 }}>Distance</span>
          <span style={{ fontWeight: 900 }}>{fmtDist(totalDistM)}</span>
          <span style={{ color: "#94a3b8", fontSize: 10 }}>Duration</span>
          <span style={{ fontWeight: 900 }}>{durationMins > 0 ? `${durationMins} min` : "—"}</span>
          {topSpeedKmh !== null && <>
            <span style={{ color: "#94a3b8", fontSize: 10 }}>Top Speed</span>
            <span style={{ fontWeight: 900 }}>{topSpeedKmh.toFixed(0)} km/h</span>
          </>}
          {avgSpeedKmh !== null && <>
            <span style={{ color: "#94a3b8", fontSize: 10 }}>Avg Speed</span>
            <span style={{ fontWeight: 900 }}>{avgSpeedKmh.toFixed(0)} km/h</span>
          </>}
          <span style={{ color: "#94a3b8", fontSize: 10 }}>Stops</span>
          <span style={{ fontWeight: 900 }}>{stops.length}</span>
          <span style={{ color: "#94a3b8", fontSize: 10 }}>Points</span>
          <span style={{ fontWeight: 900 }}>{points.length}</span>
        </div>

        {/* ── Speed legend panel ── */}
        {showLegend && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 54,
              zIndex: 900,
              background: "rgba(15,23,42,0.92)",
              backdropFilter: "blur(8px)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "white",
              fontSize: 11,
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>Speed</div>
            {SPEED_LEGEND.map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ width: 28, height: 4, background: color, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ color: "#e2e8f0" }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Mouse coordinate display (bottom bar) ── */}
        {mouseCoords && (
          <div
            style={{
              position: "absolute",
              bottom: 4,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 900,
              background: "rgba(15,23,42,0.82)",
              backdropFilter: "blur(4px)",
              borderRadius: 4,
              padding: "3px 10px",
              color: "#94a3b8",
              fontSize: 10,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: "0.04em",
              pointerEvents: "none",
            }}
          >
            {mouseCoords[0].toFixed(6)}, {mouseCoords[1].toFixed(6)}
          </div>
        )}

        {/* ── Live badge (top-center overlay) ── */}
        {isLive && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 900,
              background: "rgba(239,68,68,0.9)",
              backdropFilter: "blur(4px)",
              borderRadius: 20,
              padding: "4px 12px",
              color: "white",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 8px rgba(239,68,68,0.5)",
            }}
          >
            <span style={{ width: 7, height: 7, background: "white", borderRadius: "50%", display: "inline-block", animation: "gps-ripple 1.5s ease-out infinite" }} />
            Live Tracking
          </div>
        )}
      </div>

      {/* ── Layer attribution bar ── */}
      {isFullscreen && (
        <div className="h-5 flex items-center px-2 text-[9px] text-zinc-500 bg-zinc-950">
          {currentLayer.attr} · Leaflet
        </div>
      )}
    </div>
  );
}
