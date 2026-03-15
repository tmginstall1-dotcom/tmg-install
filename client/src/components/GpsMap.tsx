import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import { format } from "date-fns";
import L from "leaflet";

// Fix Leaflet default marker icons broken by Vite asset bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const startIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  iconSize:   [14, 14],
  iconAnchor: [7, 7],
});

const endIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#64748b;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  iconSize:   [14, 14],
  iconAnchor: [7, 7],
});

const stopIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;background:#f59e0b;border:2px solid white;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
  iconSize:   [12, 12],
  iconAnchor: [6, 6],
});

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Auto-fits map viewport to all track points
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 16);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [48, 48] });
    }
  }, [positions, map]);
  return null;
}

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
      stops.push({ lat: aLat, lng: aLng, startTime: start, endTime: end, durationMins: Math.round((end.getTime() - start.getTime()) / 60000) });
      i = j;
    } else {
      i++;
    }
  }
  return stops;
}

interface GpsMapProps {
  points: TrackPoint[];
  height?: number;
}

export default function GpsMap({ points, height = 400 }: GpsMapProps) {
  if (points.length === 0) return null;

  const positions: [number, number][] = points.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
  const first = positions[0];
  const last  = positions[positions.length - 1];
  const stops = detectStops(points);

  return (
    <div style={{ height }} className="w-full border border-black/[0.07]">
      <MapContainer
        center={first}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <FitBounds positions={positions} />

        {/* Blue route polyline */}
        <Polyline
          positions={positions}
          pathOptions={{ color: "#2563eb", weight: 3.5, opacity: 0.85 }}
        />

        {/* Green start marker */}
        <Marker position={first} icon={startIcon}>
          <Popup>
            <div className="text-xs font-semibold">
              Start · {format(new Date(points[0].recordedAt), "HH:mm:ss")}
            </div>
          </Popup>
        </Marker>

        {/* Grey end marker */}
        {points.length > 1 && (
          <Marker position={last} icon={endIcon}>
            <Popup>
              <div className="text-xs font-semibold">
                Last seen · {format(new Date(points[points.length - 1].recordedAt), "HH:mm:ss")}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Amber stop markers */}
        {stops.map((s, idx) => (
          <Marker key={idx} position={[s.lat, s.lng]} icon={stopIcon}>
            <Popup>
              <div className="text-xs">
                <div className="font-semibold mb-0.5">
                  Stopped {s.durationMins > 0 ? `· ${s.durationMins} min` : ""}
                </div>
                <div className="text-gray-500">
                  {format(s.startTime, "HH:mm")} – {format(s.endTime, "HH:mm")}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
