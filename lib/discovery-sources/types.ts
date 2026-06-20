import type { DiscoveryCandidate } from "@/lib/agents/discovery";

/**
 * Pluggable discovery sources (Agency OS — live discovery, Agent 1).
 *
 * A source turns a location query into raw candidate businesses, which then flow
 * through the existing Discovery agent (normalise → score → dedup → persist). The
 * default source is OpenStreetMap/Overpass (free, no key, ToS-friendly); a licensed
 * source (Google Places) can be added as another implementation of this same
 * interface without changing the agent or the UI. See docs/AGENCY_OS.md §11.2.
 */

export interface DiscoveryQuery {
  /** Free-text place to search, e.g. "Warrington" or "Stockton Heath, UK". */
  area: string;
  /** Search radius around the geocoded centre, metres. */
  radiusMeters?: number;
  /** Max candidates to return. */
  limit?: number;
}

export interface DiscoverySource {
  id: string;
  label: string;
  /** Whether this source needs an API key/config to run. */
  requiresKey: boolean;
  /** Whether it's usable right now (key present, etc.). */
  available: boolean;
  search(query: DiscoveryQuery): Promise<DiscoveryCandidate[]>;
}
