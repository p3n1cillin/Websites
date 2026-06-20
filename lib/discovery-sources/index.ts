import type { DiscoverySource } from "./types";
import { overpassSource } from "./overpass";

/**
 * Discovery source registry. Overpass (free) is the default + only live source
 * today; a Google Places source would register here behind the same interface
 * (and flip `available` when STRIPE-style env keys are present).
 */
const SOURCES: Record<string, DiscoverySource> = {
  [overpassSource.id]: overpassSource,
};

export const DEFAULT_SOURCE_ID = overpassSource.id;

export function getDiscoverySource(id?: string): DiscoverySource {
  return (id && SOURCES[id]) || SOURCES[DEFAULT_SOURCE_ID];
}

export function listDiscoverySources(): DiscoverySource[] {
  return Object.values(SOURCES);
}

export type { DiscoverySource, DiscoveryQuery } from "./types";
