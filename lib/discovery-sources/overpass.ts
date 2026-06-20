import type { DiscoveryCandidate } from "@/lib/agents/discovery";
import type { DiscoverySource, DiscoveryQuery } from "./types";

/**
 * OpenStreetMap / Overpass discovery source (free, no API key).
 *
 * Geocodes a place name via Nominatim, then queries Overpass for named local
 * businesses (shops, crafts, offices, healthcare, hospitality, gyms) within a
 * radius. The OSM tag value becomes the raw industry text (e.g. "hairdresser",
 * "car_repair", "lawyer"), which flows straight into the universal Industry
 * Profiler — so no fixed category list is imposed.
 *
 * Respects the public-API usage policies: a descriptive User-Agent, hard timeouts,
 * a bounded result count, and a single request per discovery run. Never throws —
 * returns [] on any failure so the caller degrades gracefully.
 *
 * Reliability: Overpass mirrors flap constantly (one can be dead while two are
 * fast). They are therefore RACED in parallel — the first to return a non-empty
 * result wins — so a single hung mirror can never stall the request. Every fetch
 * is hard-bounded by a short AbortController timeout, so the whole search resolves
 * in a few seconds (or fails fast) and the calling server action never hangs.
 */

const UA = "AgencyOS-Discovery/1.0 (local-business discovery; admin tool)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
/** Overpass mirrors — raced in parallel, so order is not significance. */
const OVERPASS_MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
/** Per-request hard ceilings. Geocode is tiny; Overpass does the heavy lifting. */
const GEOCODE_TIMEOUT_MS = 8_000;
const OVERPASS_TIMEOUT_MS = 18_000;

/** OSM tag keys that denote a business, in priority order for naming the industry. */
const INDUSTRY_KEYS = ["craft", "shop", "office", "healthcare", "amenity", "leisure"] as const;

/** Amenity values that are actually businesses (amenity is broad — filter it). */
const BUSINESS_AMENITIES =
  "restaurant|cafe|fast_food|bar|pub|dentist|doctors|veterinary|pharmacy|fuel|car_wash|driving_school|hairdresser|childcare";

interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
}

async function fetchJson<T>(
  url: string,
  timeoutMs: number,
  init?: RequestInit
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Place name → centre coordinate (Nominatim). */
async function geocode(area: string): Promise<{ lat: number; lon: number } | null> {
  const q = encodeURIComponent(area);
  const data = await fetchJson<{ lat: string; lon: string }[]>(
    `${NOMINATIM}?format=json&limit=1&q=${q}`,
    GEOCODE_TIMEOUT_MS
  );
  if (!data || data.length === 0) return null;
  const { lat, lon } = data[0];
  return { lat: Number(lat), lon: Number(lon) };
}

/** Query one mirror; resolves only on a NON-EMPTY result, else rejects (so the
 *  parallel race ignores dead/degraded mirrors and takes the first that delivers). */
async function queryMirror(mirror: string, ql: string): Promise<{ elements: OsmElement[] }> {
  const res = await fetchJson<{ elements: OsmElement[] }>(mirror, OVERPASS_TIMEOUT_MS, {
    method: "POST",
    body: `data=${encodeURIComponent(ql)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res?.elements?.length) throw new Error("empty or unreachable");
  return res;
}

/** Pick the industry text from an element's tags (first matching business key). */
function industryFromTags(tags: Record<string, string>): string | null {
  for (const key of INDUSTRY_KEYS) {
    const v = tags[key];
    if (!v || v === "no") continue;
    if (key === "amenity" && !new RegExp(`^(${BUSINESS_AMENITIES})$`).test(v)) continue;
    if (v === "yes") return key === "shop" ? "shop" : key; // e.g. shop=yes
    return v.replace(/_/g, " ");
  }
  return null;
}

export const overpassSource: DiscoverySource = {
  id: "overpass",
  label: "OpenStreetMap (free)",
  requiresKey: false,
  available: true,
  async search(query: DiscoveryQuery): Promise<DiscoveryCandidate[]> {
    const radius = Math.min(Math.max(query.radiusMeters ?? 2500, 500), 10_000);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 60);

    const centre = await geocode(query.area);
    if (!centre) return [];

    // Query NODES only (the vast majority of small-business POIs) — `nwr` would
    // force Overpass to resolve way/relation geometry, which makes the union too
    // expensive for the free mirrors and times out. We read only tags (never
    // coordinates), so `out tags` (no `center`) is requested. Broad standalone
    // key scans (office/healthcare/leisure) were dropped: they are what tipped the
    // query over the mirrors' limits, and their businesses are largely covered by
    // shop/craft/amenity anyway (dentist, doctors, pharmacy, vet are amenities).
    const around = `around:${radius},${centre.lat},${centre.lon}`;
    const ql = `[out:json][timeout:20];
(
  node(${around})[shop][name];
  node(${around})[craft][name];
  node(${around})[amenity~"^(${BUSINESS_AMENITIES})$"][name];
);
out tags ${Math.min(limit * 3, 90)};`;

    // Race all mirrors in parallel — the first to return a non-empty result wins.
    // Promise.any rejects only if EVERY mirror failed/empty, in which case we
    // degrade to []. A single slow or dead mirror (e.g. one that 504s under load)
    // can no longer stall the request behind it.
    let data: { elements: OsmElement[] } | null = null;
    try {
      data = await Promise.any(OVERPASS_MIRRORS.map((m) => queryMirror(m, ql)));
    } catch {
      data = null; // all mirrors failed
    }
    if (!data?.elements?.length) return [];

    const seen = new Set<string>();
    const candidates: DiscoveryCandidate[] = [];
    for (const el of data.elements) {
      const tags = el.tags;
      if (!tags?.name) continue;
      const industry = industryFromTags(tags);
      if (!industry) continue;

      const key = tags.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        name: tags.name.trim(),
        category: industry,
        city: tags["addr:city"]?.trim() || query.area,
        phone: (tags.phone || tags["contact:phone"])?.trim() || undefined,
        email: (tags.email || tags["contact:email"])?.trim() || undefined,
        websiteUrl: (tags.website || tags["contact:website"])?.trim() || undefined,
      });
      if (candidates.length >= limit) break;
    }
    return candidates;
  },
};
