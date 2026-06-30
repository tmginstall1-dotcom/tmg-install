// Server-side Singapore address → coordinates via OneMap, with a simple
// in-memory cache. Used to match a staff member's GPS track against the
// addresses of the jobs assigned to them that day, so admins can check whether
// staff were actually at their job sites (per the Staff Handbook GPS / payroll
// rules) or spent time away from any assigned job.
//
// OneMap is far more accurate for Singapore addresses than generic geocoders,
// and a 6-digit SG postal code resolves to an exact building. We therefore try
// the postal code first (when present in the address text) and fall back to the
// free-text address. Results are cached by normalised address string for the
// lifetime of the process — job addresses rarely change and this keeps us well
// within OneMap's fair-use limits.

export type GeoPoint = { lat: number; lng: number; matched: string };

const cache = new Map<string, GeoPoint | null>();

function extractPostal(s: string): string | null {
  // Singapore postal codes are exactly 6 digits. Prefer an explicit
  // "Singapore 123456" / "S123456" style token when present.
  const tagged = s.match(/(?:singapore|s)\s*\(?(\d{6})\)?/i);
  if (tagged) return tagged[1];
  const bare = s.match(/\b(\d{6})\b/);
  return bare ? bare[1] : null;
}

async function onemapQuery(searchVal: string): Promise<GeoPoint | null> {
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(
    searchVal,
  )}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const r = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "TMG-Install/1.0 (+tmginstall.com)" },
  });
  if (!r.ok) return null;
  const data: any = await r.json();
  const first = Array.isArray(data?.results) ? data.results[0] : null;
  if (!first?.LATITUDE || !first?.LONGITUDE) return null;
  const lat = parseFloat(first.LATITUDE);
  const lng = parseFloat(first.LONGITUDE);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng, matched: first.ADDRESS || searchVal };
}

/** Geocode a Singapore address to coordinates, or null if it can't be located. */
export async function geocodeSgAddress(address: string): Promise<GeoPoint | null> {
  const key = (address || "").trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  let result: GeoPoint | null = null;
  try {
    const postal = extractPostal(address);
    if (postal) result = await onemapQuery(postal);
    if (!result) result = await onemapQuery(address.trim());
  } catch {
    result = null;
  }
  cache.set(key, result);
  return result;
}
