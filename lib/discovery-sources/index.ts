import type { DiscoverySource } from "./types";
import { overpassSource } from "./overpass";
import { nominatimSource } from "./nominatim";

/**
 * Discovery source registry. Two free OSM streams ship today: Overpass (broad
 * radius sweep) and Nominatim (keyword "[service] in [city]" search). A licensed
 * source (Google Places) registers here behind the same interface and flips
 * `available` when its env key is present.
 */
const SOURCES: Record<string, DiscoverySource> = {
  [overpassSource.id]: overpassSource,
  [nominatimSource.id]: nominatimSource,
};

export const DEFAULT_SOURCE_ID = overpassSource.id;

export function getDiscoverySource(id?: string): DiscoverySource {
  return (id && SOURCES[id]) || SOURCES[DEFAULT_SOURCE_ID];
}

export function listDiscoverySources(): DiscoverySource[] {
  return Object.values(SOURCES);
}

export type { DiscoverySource, DiscoveryQuery } from "./types";
