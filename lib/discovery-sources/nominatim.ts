import type { DiscoveryCandidate } from "@/lib/agents/discovery";
import type { DiscoverySource, DiscoveryQuery } from "./types";

/**
 * Nominatim (OpenStreetMap) keyword discovery source — free, no API key.
 *
 * Unlike the Overpass source (a broad geographic sweep of every POI near a point),
 * this searches by SERVICE + PLACE — "plumber in Warrington" — which is exactly the
 * "[service] in [city]" stream the growth spec calls for. It is a genuinely
 * different source: keyword-targeted rather than radius-swept, so a discovery
 * campaign that runs both gets wider, less-correlated coverage.
 *
 * Respects Nominatim's usage policy: descriptive User-Agent, hard timeout, bounded
 * results, and the campaign layer throttles calls to ~1/sec. Never throws — returns
 * [] on any failure so callers degrade gracefully.
 */

const UA = "AgencyOS-Discovery/1.0 (local-business discovery; admin tool)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 9_000;

/** OSM classes that represent an actual business (filters out roads, areas, etc.). */
const BUSINESS_CLASSES = new Set(["amenity", "shop", "craft", "office", "leisure", "tourism", "healthcare"]);

interface NominatimResult {
  name?: string;
  display_name?: string;
  class?: string;
  type?: string;
  namedetails?: Record<string, string>;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA },
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

function cityFrom(addr: Record<string, string> | undefined, fallback: string): string {
  return (
    addr?.city || addr?.town || addr?.village || addr?.suburb || addr?.municipality || fallback
  );
}

export const nominatimSource: DiscoverySource = {
  id: "nominatim",
  label: "OSM keyword search (free)",
  requiresKey: false,
  available: true,
  async search(query: DiscoveryQuery): Promise<DiscoveryCandidate[]> {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 50);
    const term = [query.category, query.area].filter(Boolean).join(" in ").trim();
    if (!term) return [];
    const url =
      `${NOMINATIM}?format=jsonv2&addressdetails=1&extratags=1&namedetails=1` +
      `&limit=${limit}&q=${encodeURIComponent(term)}`;

    const results = await fetchJson<NominatimResult[]>(url);
    if (!results?.length) return [];

    const seen = new Set<string>();
    const candidates: DiscoveryCandidate[] = [];
    for (const r of results) {
      if (r.class && !BUSINESS_CLASSES.has(r.class)) continue;
      const name = (r.name || r.namedetails?.name || r.display_name?.split(",")[0])?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const ex = r.extratags ?? {};
      candidates.push({
        name,
        // The searched service is the truest industry text; fall back to the OSM type.
        category: query.category?.trim() || r.type?.replace(/_/g, " "),
        city: cityFrom(r.address, query.area),
        phone: (ex.phone || ex["contact:phone"])?.trim() || undefined,
        email: (ex.email || ex["contact:email"])?.trim() || undefined,
        websiteUrl: (ex.website || ex["contact:website"] || ex.url)?.trim() || undefined,
      });
    }
    return candidates;
  },
};
