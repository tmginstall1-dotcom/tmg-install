import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useMemo } from "react";
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

// ─── CSS injected once ────────────────────────────────────────────────────────
const GPS_CSS = `
@keyframes gps-ripple {
  0%   { box-shadow: 0 0 0 0 rgba(37,99,235,0.7); }
  70%  { box-shadow: 0 0 0 16px rgba(37,99,235,0); }
  100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
}
@keyframes gps-live-badge {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.6; }
}
@keyframes accuracy-pulse {
  0%,100% { opacity: 0.35; }
  50%      { opacity: 0.15; }
}
.gps-nav-ripple   { animation: gps-ripple 1.8s ease-out infinite; }
.gps-live-pulse   { animation: gps-live-badge 1.2s ease-in-out infinite; }
.gps-acc-pulse    { animation: accuracy-pulse 2.5s ease-in-out infinite; }

.leaflet-tooltip-gps {
  background: rgba(15,23,42,0.93) !important;
  border: 1px solid rgba(255,255,255,0.13) !important;
  border-radius: 7px !important;
  color: #f1f5f9 !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  padding: 6px 10px !important;
  white-space: nowrap !important;
  box-shadow: 0 6px 20px rgba(0,0,0,0.4) !important;
}
.leaflet-tooltip-gps::before { display: none !important; }
.leaflet-popup-content-wrapper {
  border-radius: 10px !important;
  padding: 0 !important;
  box-shadow: 0 10px 30px rgba(0,0,0,0.28) !important;
  overflow: hidden !important;
}
.leaflet-popup-content { margin: 0 !important; }
.leaflet-popup-tip-container { display: none !important; }
`;

// ─── Fix Leaflet icon paths (Vite breaks default icons) ───────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Tile layers ──────────────────────────────────────────────────────────────
const TILE_LAYERS = [
  { id: "street",    label: "Street",    emoji: "🗺",  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19, attr: "© OpenStreetMap contributors" },
  { id: "satellite", label: "Satellite", emoji: "🛰",  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", maxZoom: 19, attr: "© Esri, Maxar" },
  { id: "dark",      label: "Dark",      emoji: "🌙",  url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", maxZoom: 19, attr: "© CARTO" },
  { id: "light",     label: "Light",     emoji: "☀",   url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", maxZoom: 19, attr: "© CARTO" },
] as const;
type LayerId = (typeof TILE_LAYERS)[number]["id"];

// ─── Speed colour scale ───────────────────────────────────────────────────────
function getSpeedColor(kmh: number | null): string {
  if (kmh === null || kmh < 0) return "#3b82f6";
  if (kmh < 2)  return "#94a3b8";
  if (kmh < 15) return "#f59e0b";
  if (kmh < 60) return "#3b82f6";
  return "#22c55e";
}
const SPEED_LEGEND = [
  { color: "#94a3b8", label: "Stopped" },
  { color: "#f59e0b", label: "Slow (<15 km/h)" },
  { color: "#3b82f6", label: "Normal (<60 km/h)" },
  { color: "#22c55e", label: "Fast (60+ km/h)" },
];

// ─── Compass heading helpers ──────────────────────────────────────────────────
function headingToLabel(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}
function signalLabel(accuracyM: number | null): { label: string; color: string } {
  if (accuracyM === null)  return { label: "No signal", color: "#94a3b8" };
  if (accuracyM <= 10)     return { label: "Excellent",  color: "#22c55e" };
  if (accuracyM <= 30)     return { label: "Good",       color: "#86efac" };
  if (accuracyM <= 60)     return { label: "Fair",       color: "#f59e0b" };
  return                          { label: "Poor",        color: "#ef4444" };
}

// ─── Icon factories ───────────────────────────────────────────────────────────
const startIcon = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center">
    <div style="width:8px;height:8px;background:white;border-radius:50%"></div>
  </div>`,
  iconSize: [26, 26], iconAnchor: [13, 13],
});

/** Rotating navigation arrow for the current position */
function makeNavArrow(heading: number | null, isLive: boolean): L.DivIcon {
  const rot = heading ?? 0;
  const ripple = isLive ? 'class="gps-nav-ripple"' : "";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center">
        <div ${ripple} style="width:36px;height:36px;position:absolute;border-radius:50%;background:rgba(37,99,235,0.18)"></div>
        <div style="transform:rotate(${rot}deg);display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 32" width="22" height="29" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.55))">
            <polygon points="12,0 24,32 12,23 0,32"
              fill="${isLive ? '#2563eb' : '#475569'}"
              stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>`,
    iconSize: [36, 36], iconAnchor: [18, 18],
  });
}

function makeStopIcon(durationMins: number): L.DivIcon {
  const badge = durationMins > 0
    ? `<div style="background:rgba(217,119,6,0.95);color:white;font-size:9px;font-weight:900;padding:1px 4px;margin-top:2px;border-radius:3px;white-space:nowrap;line-height:1.4">${durationMins}m</div>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:16px;height:16px;background:#f59e0b;border:2.5px solid white;border-radius:3px;box-shadow:0 1px 5px rgba(0,0,0,0.35)"></div>${badge}
    </div>`,
    iconSize: [16, durationMins > 0 ? 32 : 16], iconAnchor: [8, 8],
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type TrackPoint = {
  id: number; lat: string; lng: string;
  accuracy: string | null; speed: string | null;
  heading: string | null; recordedAt: string;
};
interface StopMarker { lat: number; lng: number; startTime: Date; endTime: Date; durationMins: number; }
interface ColoredSeg  { from: [number,number]; to: [number,number]; color: string; speedKmh: number|null; }

// ─── Utilities ────────────────────────────────────────────────────────────────
function haversineM(lat1:number,lng1:number,lat2:number,lng2:number):number {
  const R=6371000, φ1=(lat1*Math.PI)/180, φ2=(lat2*Math.PI)/180;
  const Δφ=((lat2-lat1)*Math.PI)/180, Δλ=((lng2-lng1)*Math.PI)/180;
  const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmtDist(m:number){ return m>=1000?`${(m/1000).toFixed(1)} km`:`${Math.round(m)} m`; }
function fmtDuration(secs:number){ const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }

function detectStops(points: TrackPoint[]): StopMarker[] {
  const stops: StopMarker[] = [];
  let i = 0;
  while (i < points.length) {
    const a = points[i]; const aLat=parseFloat(a.lat), aLng=parseFloat(a.lng);
    let j = i + 1;
    while (j < points.length && haversineM(aLat,aLng,parseFloat(points[j].lat),parseFloat(points[j].lng)) <= 50) j++;
    if (j - i >= 2) {
      const start = new Date(a.recordedAt), end = new Date(points[j-1].recordedAt);
      stops.push({ lat:aLat, lng:aLng, startTime:start, endTime:end, durationMins:Math.round((end.getTime()-start.getTime())/60000) });
      i = j;
    } else { i++; }
  }
  return stops;
}

function buildColorSegs(points: TrackPoint[]): ColoredSeg[] {
  return points.slice(0,-1).map((p1,i) => {
    const p2 = points[i+1];
    const dist = haversineM(parseFloat(p1.lat),parseFloat(p1.lng),parseFloat(p2.lat),parseFloat(p2.lng));
    const timeSec = (new Date(p2.recordedAt).getTime()-new Date(p1.recordedAt).getTime())/1000;
    let speedKmh: number|null = null;
    if (p1.speed && parseFloat(p1.speed)>=0) speedKmh = parseFloat(p1.speed)*3.6;
    else if (timeSec>0 && dist<500) speedKmh = (dist/timeSec)*3.6;
    return { from:[parseFloat(p1.lat),parseFloat(p1.lng)], to:[parseFloat(p2.lat),parseFloat(p2.lng)], color:getSpeedColor(speedKmh), speedKmh };
  });
}

// ─── Inner map components ─────────────────────────────────────────────────────

/** Fits bounds once on initial mount only */
function FitBounds({ positions }: { positions: [number,number][] }) {
  const map = useMap(); const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || positions.length===0) return;
    fitted.current = true;
    if (positions.length===1) map.setView(positions[0], 17);
    else map.fitBounds(L.latLngBounds(positions), { padding:[48,48] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Smooth pan to latest position when follow mode is ON */
function FollowLatest({ position, enabled, zoom }: { position:[number,number]; enabled:boolean; zoom:number }) {
  const map = useMap(); const prevKey = useRef("");
  useEffect(() => {
    if (!enabled) return;
    const key = `${position[0].toFixed(6)},${position[1].toFixed(6)}`;
    if (key === prevKey.current) return;
    prevKey.current = key;
    map.flyTo(position, Math.max(map.getZoom(), zoom), { animate:true, duration:1.2 });
  }, [position, enabled, zoom, map]);
  return null;
}

function MapResizeHandler({ trigger }: { trigger:boolean }) {
  const map = useMap();
  useEffect(() => { const t = setTimeout(()=>map.invalidateSize(),150); return ()=>clearTimeout(t); }, [trigger,map]);
  return null;
}

function CoordTracker({ onMove }: { onMove:(c:[number,number]|null)=>void }) {
  useMapEvents({ mousemove:(e)=>onMove([e.latlng.lat,e.latlng.lng]), mouseout:()=>onMove(null) });
  return null;
}

// ─── Overlay button helper ────────────────────────────────────────────────────
function OvBtn({ onClick, title, active, children, size=36 }: {
  onClick:()=>void; title:string; active?:boolean; children:React.ReactNode; size?:number;
}) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        width:size, height:size, display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:15, borderRadius:7, cursor:"pointer", backdropFilter:"blur(8px)",
        transition:"all 0.15s", userSelect:"none",
        border: active ? "2px solid #2563eb" : "2px solid rgba(255,255,255,0.75)",
        background: active ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.92)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
        color: active ? "#2563eb" : "#374151",
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface GpsMapProps {
  points: TrackPoint[];
  height?: number;
  isLive?: boolean;
}

export default function GpsMap({ points, height = 520, isLive = false }: GpsMapProps) {
  const [activeLayer, setActiveLayer]   = useState<LayerId>("street");
  const [followMode, setFollowMode]     = useState(isLive);  // auto-follow when live
  const [showAccuracy, setShowAccuracy] = useState(false);
  const [showLegend, setShowLegend]     = useState(false);
  const [showPoints, setShowPoints]     = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mouseCoords, setMouseCoords]   = useState<[number,number]|null>(null);
  const styleRef = useRef<HTMLStyleElement|null>(null);

  // Inject CSS once
  useEffect(() => {
    if (styleRef.current) return;
    const el = document.createElement("style");
    el.textContent = GPS_CSS;
    document.head.appendChild(el);
    styleRef.current = el;
    return () => { if (styleRef.current) { document.head.removeChild(styleRef.current); styleRef.current=null; } };
  }, []);

  // Activate follow mode whenever a new live session starts
  useEffect(() => { if (isLive) setFollowMode(true); }, [isLive]);

  if (points.length === 0) return null;

  // ── Derived data (memoised to avoid reinstating FitBounds) ──
  const positions = useMemo(()=>points.map(p=>[parseFloat(p.lat),parseFloat(p.lng)] as [number,number]),[points]);
  const first     = positions[0];
  const lastPt    = points[points.length-1];
  const lastPos   = positions[positions.length-1];

  // Current-position stats
  const currentSpeedKmh = lastPt.speed ? parseFloat(lastPt.speed)*3.6 : null;
  const currentHeading  = lastPt.heading ? parseFloat(lastPt.heading) : null;
  const currentAccuracy = lastPt.accuracy ? parseFloat(lastPt.accuracy) : null;
  const signal          = signalLabel(currentAccuracy);
  const lastFixTime     = format(new Date(lastPt.recordedAt), "HH:mm:ss");

  // Route stats
  const segments = useMemo(()=>buildColorSegs(points),[points]);
  const stops    = useMemo(()=>detectStops(points),[points]);
  const totalDistM = useMemo(()=>points.length<2?0:points.reduce((sum,pt,i)=>{
    if(i===0) return sum;
    const d=haversineM(parseFloat(points[i-1].lat),parseFloat(points[i-1].lng),parseFloat(pt.lat),parseFloat(pt.lng));
    return d<500?sum+d:sum;
  },0),[points]);
  const durationSecs = points.length>=2
    ? Math.floor((new Date(lastPt.recordedAt).getTime()-new Date(points[0].recordedAt).getTime())/1000)
    : 0;
  const allSpeeds  = segments.map(s=>s.speedKmh).filter((s): s is number=>s!==null&&s>0);
  const topSpeed   = allSpeeds.length>0 ? Math.max(...allSpeeds) : null;

  // Trail: last 25 points fading from opaque → transparent
  const TRAIL = 25;
  const trailPoints = positions.slice(-TRAIL);

  const currentLayer = TILE_LAYERS.find(l=>l.id===activeLayer)!;
  const navArrow     = makeNavArrow(currentHeading, isLive);

  return (
    <div
      data-testid="gps-map-container"
      className={isFullscreen ? "fixed inset-0 z-[9999] flex flex-col bg-black" : "relative w-full"}
      style={isFullscreen ? undefined : { height }}
    >
      {/* ─── Map canvas ─── */}
      <div className={isFullscreen ? "flex-1 relative" : "absolute inset-0"}>
        <MapContainer
          center={first} zoom={15}
          style={{ height:"100%", width:"100%", zIndex:0 }}
          scrollWheelZoom attributionControl={false} zoomControl
        >
          <TileLayer key={activeLayer} url={currentLayer.url} maxZoom={currentLayer.maxZoom} />
          <ScaleControl position="bottomright" imperial={false} />
          <FitBounds positions={positions} />
          <MapResizeHandler trigger={isFullscreen} />
          <CoordTracker onMove={setMouseCoords} />
          <FollowLatest position={lastPos} enabled={followMode} zoom={17} />

          {/* Full speed-coloured route */}
          {segments.map((seg,i) => (
            <Polyline key={i} positions={[seg.from,seg.to]}
              pathOptions={{ color:seg.color, weight:5, opacity:0.88, lineCap:"round", lineJoin:"round" }} />
          ))}

          {/* Fading recent-position trail (last TRAIL points, blue gradient) */}
          {isLive && trailPoints.map((pos,i) => {
            const opacity = 0.08 + (i/TRAIL)*0.55;
            const radius  = 2 + (i/TRAIL)*3;
            return (
              <CircleMarker key={`trail-${i}`} center={pos} radius={radius}
                pathOptions={{ color:"#2563eb", fillColor:"#2563eb", fillOpacity:opacity, weight:0, opacity:0 }} />
            );
          })}

          {/* Individual GPS point dots (toggleable) */}
          {showPoints && positions.map((pos,i) => {
            const pt  = points[i];
            const acc = pt.accuracy ? parseFloat(pt.accuracy) : null;
            const spd = pt.speed    ? (parseFloat(pt.speed)*3.6).toFixed(1) : null;
            return (
              <CircleMarker key={pt.id} center={pos} radius={3.5}
                pathOptions={{ color:"#fff", fillColor:getSpeedColor(spd?parseFloat(spd):null), fillOpacity:0.85, weight:1.5, opacity:0.9 }}
              >
                <Tooltip className="leaflet-tooltip-gps" direction="top" offset={[0,-5]}>
                  <div>
                    <div style={{fontWeight:900,marginBottom:3,color:"#e2e8f0"}}>{format(new Date(pt.recordedAt),"HH:mm:ss")}</div>
                    {spd && <div style={{color:"#94a3b8"}}>Speed: <span style={{color:"#f1f5f9"}}>{spd} km/h</span></div>}
                    {acc && <div style={{color:"#94a3b8"}}>Accuracy: <span style={{color:"#f1f5f9"}}>±{Math.round(acc)} m</span></div>}
                    {pt.heading && <div style={{color:"#94a3b8"}}>Heading: <span style={{color:"#f1f5f9"}}>{parseFloat(pt.heading).toFixed(0)}° {headingToLabel(parseFloat(pt.heading))}</span></div>}
                    <div style={{color:"#64748b",marginTop:3,fontSize:10}}>
                      {parseFloat(pt.lat).toFixed(6)}, {parseFloat(pt.lng).toFixed(6)}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* GPS accuracy circles (toggleable) */}
          {showAccuracy && positions.map((pos,i) => {
            const acc = points[i].accuracy ? parseFloat(points[i].accuracy!) : null;
            if (!acc || acc>200) return null;
            return (
              <Circle key={`acc-${points[i].id}`} center={pos} radius={acc}
                pathOptions={{ color:"#3b82f6", fillColor:"#3b82f6", fillOpacity:0.05, weight:0.5, opacity:0.25 }} />
            );
          })}

          {/* Accuracy ring for current position */}
          {currentAccuracy && currentAccuracy<=150 && (
            <Circle center={lastPos} radius={currentAccuracy}
              pathOptions={{ color:signal.color, fillColor:signal.color, fillOpacity:0.1, weight:1.5, opacity:0.5, dashArray:"6 4" }} />
          )}

          {/* Start marker */}
          <Marker position={first} icon={startIcon}>
            <Popup>
              <div style={{padding:"10px 14px",minWidth:160}}>
                <div style={{fontSize:10,fontWeight:900,letterSpacing:"0.08em",color:"#16a34a",textTransform:"uppercase",marginBottom:4}}>Shift Start</div>
                <div style={{fontSize:18,fontWeight:900,color:"#0f172a",marginBottom:6}}>{format(new Date(points[0].recordedAt),"HH:mm:ss")}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{parseFloat(points[0].lat).toFixed(6)}, {parseFloat(points[0].lng).toFixed(6)}</div>
                {points[0].accuracy&&<div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>GPS accuracy: ±{Math.round(parseFloat(points[0].accuracy))} m</div>}
              </div>
            </Popup>
          </Marker>

          {/* Navigation arrow at current position */}
          {points.length>1 && (
            <Marker position={lastPos} icon={navArrow}>
              <Popup>
                <div style={{padding:"10px 14px",minWidth:170}}>
                  <div style={{fontSize:10,fontWeight:900,letterSpacing:"0.08em",color:isLive?"#2563eb":"#475569",textTransform:"uppercase",marginBottom:4}}>
                    {isLive?"📍 Current Position":"Last Known Position"}
                  </div>
                  <div style={{fontSize:20,fontWeight:900,color:"#0f172a",marginBottom:2}}>
                    {currentSpeedKmh!==null ? `${currentSpeedKmh.toFixed(0)} km/h` : "—"}
                  </div>
                  <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>{lastFixTime}</div>
                  {currentHeading!==null && <div style={{fontSize:11,color:"#94a3b8"}}>Heading: {currentHeading.toFixed(0)}° {headingToLabel(currentHeading)}</div>}
                  {currentAccuracy && <div style={{fontSize:11,color:signal.color}}>GPS: {signal.label} (±{Math.round(currentAccuracy)} m)</div>}
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>{lastPos[0].toFixed(6)}, {lastPos[1].toFixed(6)}</div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Stop markers */}
          {stops.map((s,idx) => (
            <Marker key={idx} position={[s.lat,s.lng]} icon={makeStopIcon(s.durationMins)}>
              <Popup>
                <div style={{padding:"10px 14px",minWidth:160}}>
                  <div style={{fontSize:10,fontWeight:900,letterSpacing:"0.08em",color:"#d97706",textTransform:"uppercase",marginBottom:4}}>⏸ Stationary</div>
                  <div style={{fontSize:18,fontWeight:900,color:"#0f172a",marginBottom:2}}>{s.durationMins>0?`${s.durationMins} min`:"Brief stop"}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{format(s.startTime,"HH:mm")} – {format(s.endTime,"HH:mm")}</div>
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{s.lat.toFixed(6)}, {s.lng.toFixed(6)}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* ═══════════════ OVERLAY CONTROLS ═══════════════ */}

        {/* ── Tile layer switcher (top-right) ── */}
        <div style={{position:"absolute",top:10,right:44,zIndex:900,display:"flex",flexDirection:"column",gap:5}}>
          {TILE_LAYERS.map(layer=>(
            <OvBtn key={layer.id} onClick={()=>setActiveLayer(layer.id)} title={layer.label} active={activeLayer===layer.id}>
              <span style={{fontSize:16}}>{layer.emoji}</span>
            </OvBtn>
          ))}
        </div>

        {/* ── Left controls (top-left) ── */}
        <div style={{position:"absolute",top:10,left:10,zIndex:900,display:"flex",flexDirection:"column",gap:5}}>
          {/* Fullscreen */}
          <OvBtn onClick={()=>setIsFullscreen(fs=>!fs)} title={isFullscreen?"Exit fullscreen":"Fullscreen"}>
            <span style={{fontSize:14}}>{isFullscreen?"✕":"⛶"}</span>
          </OvBtn>
          {/* Follow mode */}
          <OvBtn onClick={()=>setFollowMode(v=>!v)} title={followMode?"Disable auto-follow":"Enable auto-follow"} active={followMode}>
            <span style={{fontSize:13}}>⊕</span>
          </OvBtn>
          {/* Point dots toggle */}
          <OvBtn onClick={()=>setShowPoints(v=>!v)} title={showPoints?"Hide GPS dots":"Show GPS dots"} active={showPoints}>
            <span style={{fontSize:14}}>•</span>
          </OvBtn>
          {/* Accuracy circles */}
          <OvBtn onClick={()=>setShowAccuracy(v=>!v)} title={showAccuracy?"Hide accuracy circles":"Show accuracy circles"} active={showAccuracy}>
            <span style={{fontSize:13}}>⊙</span>
          </OvBtn>
          {/* Legend */}
          <OvBtn onClick={()=>setShowLegend(v=>!v)} title="Speed legend" active={showLegend}>
            <span style={{fontSize:13}}>≡</span>
          </OvBtn>
        </div>

        {/* ── Navigation HUD (right side, always visible when live or has speed) ── */}
        {(isLive || currentSpeedKmh !== null) && (
          <div style={{
            position:"absolute", top:"50%", right:10, transform:"translateY(-50%)", zIndex:900,
            background:"rgba(15,23,42,0.92)", backdropFilter:"blur(10px)",
            borderRadius:14, padding:"16px 14px",
            border:"1px solid rgba(255,255,255,0.12)",
            boxShadow:"0 8px 32px rgba(0,0,0,0.45)",
            color:"white", width:110, textAlign:"center",
          }}>
            {/* Speed */}
            <div style={{fontSize:9,fontWeight:900,letterSpacing:"0.12em",color:"#64748b",textTransform:"uppercase",marginBottom:4}}>SPEED</div>
            <div style={{fontSize:42,fontWeight:900,lineHeight:1,color:getSpeedColor(currentSpeedKmh),letterSpacing:"-2px",fontVariantNumeric:"tabular-nums"}}>
              {currentSpeedKmh!==null ? Math.round(currentSpeedKmh) : "—"}
            </div>
            <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:14}}>km/h</div>

            {/* Divider */}
            <div style={{height:1,background:"rgba(255,255,255,0.08)",marginBottom:12}} />

            {/* Heading */}
            <div style={{fontSize:9,fontWeight:900,letterSpacing:"0.12em",color:"#64748b",textTransform:"uppercase",marginBottom:3}}>HEADING</div>
            {currentHeading!==null ? (
              <>
                <div style={{fontSize:20,fontWeight:900,color:"#e2e8f0",lineHeight:1}}>{headingToLabel(currentHeading)}</div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:12}}>{Math.round(currentHeading)}°</div>
              </>
            ) : (
              <div style={{fontSize:16,color:"#475569",marginBottom:12}}>—</div>
            )}

            {/* Divider */}
            <div style={{height:1,background:"rgba(255,255,255,0.08)",marginBottom:12}} />

            {/* GPS signal */}
            <div style={{fontSize:9,fontWeight:900,letterSpacing:"0.12em",color:"#64748b",textTransform:"uppercase",marginBottom:4}}>GPS SIGNAL</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginBottom:2}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:signal.color}} />
              <span style={{fontSize:11,fontWeight:800,color:signal.color}}>{signal.label}</span>
            </div>
            {currentAccuracy && <div style={{fontSize:10,color:"#64748b",marginBottom:12}}>±{Math.round(currentAccuracy)} m</div>}

            {/* Divider */}
            <div style={{height:1,background:"rgba(255,255,255,0.08)",marginBottom:12}} />

            {/* Last fix */}
            <div style={{fontSize:9,fontWeight:900,letterSpacing:"0.12em",color:"#64748b",textTransform:"uppercase",marginBottom:3}}>LAST FIX</div>
            <div style={{fontSize:12,fontWeight:800,color:"#e2e8f0"}}>{lastFixTime}</div>
          </div>
        )}

        {/* ── Speed legend panel ── */}
        {showLegend && (
          <div style={{
            position:"absolute", top:10, left:54, zIndex:900,
            background:"rgba(15,23,42,0.93)", backdropFilter:"blur(8px)",
            borderRadius:9, padding:"10px 14px", color:"white",
            boxShadow:"0 4px 20px rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.1)",
          }}>
            <div style={{fontSize:9,fontWeight:900,letterSpacing:"0.12em",color:"#94a3b8",textTransform:"uppercase",marginBottom:8}}>Speed</div>
            {SPEED_LEGEND.map(({color,label})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                <div style={{width:28,height:4,background:color,borderRadius:2,flexShrink:0}} />
                <span style={{fontSize:11,color:"#e2e8f0"}}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Route stats (bottom-left) ── */}
        <div style={{
          position:"absolute", bottom:30, left:10, zIndex:900,
          background:"rgba(15,23,42,0.88)", backdropFilter:"blur(8px)",
          borderRadius:9, padding:"8px 12px", color:"white",
          boxShadow:"0 4px 20px rgba(0,0,0,0.38)", border:"1px solid rgba(255,255,255,0.09)",
          display:"grid", gridTemplateColumns:"auto auto", gap:"3px 14px", minWidth:160,
        }}>
          {([
            ["Distance",  fmtDist(totalDistM)],
            ["Duration",  durationSecs>0 ? fmtDuration(durationSecs) : "—"],
            ...(topSpeed!==null ? [["Top Speed",`${topSpeed.toFixed(0)} km/h`]] : []),
            ["Stops",     String(stops.length)],
            ["Points",    String(points.length)],
          ] as [string,string][]).map(([k,v])=>(
            <>
              <span key={k+"-k"} style={{fontSize:10,color:"#94a3b8"}}>{k}</span>
              <span key={k+"-v"} style={{fontWeight:900,fontSize:11}}>{v}</span>
            </>
          ))}
        </div>

        {/* ── Live badge (top-centre) ── */}
        {isLive && (
          <div className="gps-live-pulse" style={{
            position:"absolute", top:10, left:"50%", transform:"translateX(-50%)", zIndex:900,
            background:"rgba(37,99,235,0.92)", backdropFilter:"blur(4px)",
            borderRadius:20, padding:"5px 14px", color:"white",
            fontSize:10, fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase",
            display:"flex", alignItems:"center", gap:7,
            boxShadow:"0 2px 12px rgba(37,99,235,0.55)",
          }}>
            <span style={{width:7,height:7,background:"white",borderRadius:"50%",display:"inline-block"}} />
            LIVE TRACKING
          </div>
        )}

        {/* ── Mouse coordinate display (bottom-centre) ── */}
        {mouseCoords && (
          <div style={{
            position:"absolute", bottom:6, left:"50%", transform:"translateX(-50%)", zIndex:900,
            background:"rgba(15,23,42,0.82)", backdropFilter:"blur(4px)",
            borderRadius:4, padding:"3px 10px", color:"#94a3b8",
            fontSize:10, fontFamily:"monospace", fontWeight:700, letterSpacing:"0.04em", pointerEvents:"none",
          }}>
            {mouseCoords[0].toFixed(6)}, {mouseCoords[1].toFixed(6)}
          </div>
        )}

        {/* ── Recenter button (bottom-right of map, above scale bar) ── */}
        <div style={{position:"absolute",bottom:36,right:10,zIndex:900}}>
          <OvBtn onClick={()=>setFollowMode(true)} title="Recenter & follow" size={40} active={followMode}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              <circle cx="12" cy="12" r="8" strokeOpacity="0.35"/>
            </svg>
          </OvBtn>
        </div>
      </div>

      {/* Attribution bar in fullscreen */}
      {isFullscreen && (
        <div style={{height:20,display:"flex",alignItems:"center",padding:"0 8px",fontSize:9,color:"#64748b",background:"#020617"}}>
          {currentLayer.attr} · Leaflet · react-leaflet
        </div>
      )}
    </div>
  );
}
