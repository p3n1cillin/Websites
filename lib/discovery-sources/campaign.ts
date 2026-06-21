import type { DiscoveryCandidate } from "@/lib/agents/discovery";
import { getDiscoverySource } from "./index";

/**
 * Discovery campaign — turns one brief into MANY queries and runs them at scale.
 *
 * The growth spec wants discovery to map whole markets, not a single query: "city +
 * service combinations at scale", "hundreds per run". This fans a brief out across
 * areas × (optional) categories × sources, runs them politely (sequential rounds
 * with a small gap so free OSM endpoints' rate limits are respected), and merges +
 * dedups the results. The merged candidate list flows through the existing Discovery
 * agent unchanged (normalise → score → dedup-persist).
 *
 * Pure orchestration over the source registry — no new deps, never throws.
 */

export interface CampaignBrief {
  /** Towns/areas to sweep, e.g. ["Warrington", "Widnes", "Runcorn"]. */
  areas: string[];
  /** Optional services to target via keyword sources, e.g. ["plumber", "dentist"]. */
  categories?: string[];
  /** Source ids to run (default: both free OSM streams). */
  sourceIds?: string[];
  /** Max candidates per individual query. */
  perQueryLimit?: number;
  /** Safety ceiling on total candidates returned. */
  maxTotal?: number;
  /** Keep only businesses that already have a website (i.e. likely emailable). */
  requireWebsite?: boolean;
}

export interface CampaignResult {
  candidates: DiscoveryCandidate[];
  /** How many individual source queries ran. */
  queries: number;
  /** Per-area counts (post-dedup contribution is approximate; this is raw found). */
  found: number;
  duplicatesMerged: number;
}

const GAP_MS = 1_100; // be polite to free OSM endpoints (≈1 req/sec)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dedupKey(c: DiscoveryCandidate): string {
  return `${c.name.toLowerCase().trim()}|${(c.city ?? "").toLowerCase().trim()}`;
}

export async function runDiscoveryCampaign(brief: CampaignBrief): Promise<CampaignResult> {
  const areas = brief.areas.map((a) => a.trim()).filter(Boolean).slice(0, 25);
  const categories = (brief.categories ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 12);
  const sourceIds = brief.sourceIds?.length ? brief.sourceIds : ["overpass", "nominatim"];
  const perQueryLimit = Math.min(Math.max(brief.perQueryLimit ?? 25, 1), 60);
  const maxTotal = Math.min(Math.max(brief.maxTotal ?? 500, 1), 2000);

  // Build the query grid. Overpass is a broad sweep → one query per area (category
  // ignored). Keyword sources (nominatim) → one query per area × category, or a
  // bare area sweep when no categories were supplied.
  type Q = { sourceId: string; area: string; category?: string };
  const grid: Q[] = [];
  for (const sourceId of sourceIds) {
    for (const area of areas) {
      if (sourceId === "overpass") {
        grid.push({ sourceId, area });
      } else if (categories.length) {
        for (const category of categories) grid.push({ sourceId, area, category });
      } else {
        grid.push({ sourceId, area });
      }
    }
  }

  const merged = new Map<string, DiscoveryCandidate>();
  let found = 0;
  let duplicatesMerged = 0;
  let queries = 0;

  for (const q of grid) {
    if (merged.size >= maxTotal) break;
    const source = getDiscoverySource(q.sourceId);
    if (!source.available) continue;
    queries += 1;
    let batch: DiscoveryCandidate[] = [];
    try {
      batch = await source.search({ area: q.area, category: q.category, limit: perQueryLimit });
    } catch {
      batch = [];
    }
    for (const c of batch) {
      if (!c.name?.trim()) continue;
      found += 1;
      const key = dedupKey(c);
      const existing = merged.get(key);
      if (existing) {
        duplicatesMerged += 1;
        // Enrich: fill any contact field the first hit was missing.
        existing.phone ||= c.phone;
        existing.email ||= c.email;
        existing.websiteUrl ||= c.websiteUrl;
        existing.category ||= c.category;
        continue;
      }
      merged.set(key, { ...c });
      if (merged.size >= maxTotal) break;
    }
    await sleep(GAP_MS);
  }

  let candidates = [...merged.values()];
  // Emailable-pipeline filter: keep only businesses that publish a website (the ones
  // we can actually scrape an email from). The no-website majority are great leads
  // but unreachable by email — chase those by phone instead.
  if (brief.requireWebsite) {
    candidates = candidates.filter((c) => c.websiteUrl?.trim());
  }
  return { candidates, queries, found, duplicatesMerged };
}
