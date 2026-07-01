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

// Thrown for transient OneMap failures (rate limit / server error / network)
// so the caller can avoid caching a "not located" result it should retry later.
class TransientGeocodeError extends Error {}

async function onemapQuery(searchVal: string): Promise<GeoPoint | null> {
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(
    searchVal,
  )}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const r = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "TMG-Install/1.0 (+tmginstall.com)" },
  });
  // 429 (rate limit) and 5xx are transient — do NOT treat them as "address has
  // no coordinates", or a momentary blip would permanently mark a real job site
  // "not located" for the life of the process.
  if (r.status === 429 || r.status >= 500) throw new TransientGeocodeError(`OneMap ${r.status}`);
  if (!r.ok) return null;
  const data: any = await r.json();
  const first = Array.isArray(data?.results) ? data.results[0] : null;
  if (!first?.LATITUDE || !first?.LONGITUDE) return null;
  const lat = parseFloat(first.LATITUDE);
  const lng = parseFloat(first.LONGITUDE);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng, matched: first.ADDRESS || searchVal };
}

// OneMap's search does not understand the Singapore "BLK"/"BLOCK" prefix that is
// common in job addresses (e.g. GGV imports): "BLK 420 CLEMENTI AVENUE 1" returns
// zero results, while "420 CLEMENTI AVENUE 1" resolves exactly. We therefore build
// an ordered list of query candidates — the raw address, the address with the
// block prefix stripped, and the first comma-separated segment (dropping condo
// names / unit numbers that can throw off matching) — and try them until one hits.
function stripBlkPrefix(s: string): string {
  // Only strip a LEADING "BLK"/"BLOCK" token so we never mangle a legitimate
  // street name that happens to contain the word elsewhere.
  return s.replace(/^\s*(?:blk|block)\b\.?\s*/i, "").replace(/\s{2,}/g, " ").trim();
}

function buildQueryCandidates(address: string): string[] {
  const a = address.trim();
  const cands: string[] = [];
  const push = (v: string) => {
    const t = v.trim();
    if (t && !cands.includes(t)) cands.push(t);
  };
  push(a);
  push(stripBlkPrefix(a));
  const firstSeg = a.split(",")[0] ?? "";
  push(firstSeg);
  push(stripBlkPrefix(firstSeg));
  return cands;
}

/** Geocode a Singapore address to coordinates, or null if it can't be located. */
export async function geocodeSgAddress(address: string): Promise<GeoPoint | null> {
  const key = (address || "").trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  let result: GeoPoint | null = null;
  let transient = false;
  try {
    const postal = extractPostal(address);
    if (postal) result = await onemapQuery(postal);
    if (!result) {
      for (const cand of buildQueryCandidates(address)) {
        result = await onemapQuery(cand);
        if (result) break;
      }
    }
  } catch {
    // Any thrown error — OneMap 429/5xx, a fetch/network failure, or a bad JSON
    // body — is transient. A genuine "no such address" outcome does NOT throw
    // (onemapQuery returns null), so only definitive results are cached below;
    // transient failures retry on the next call instead of sticking as "not located".
    transient = true;
    result = null;
  }
  if (!transient) cache.set(key, result);
  return result;
}
