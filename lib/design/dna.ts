/**
 * Deterministic Design DNA generator.
 *
 * `getDesignDNA(business)` is the single entry point the render layer calls. Today
 * it derives the DNA deterministically from the business (so a given site always
 * looks the same, and pre-rendering is stable). A later phase (the Website Factory /
 * `design` agent) can persist a chosen/edited DNA and have this return that instead
 * — the call site never changes.
 */

import type { Business } from "@/lib/types";
import { getPalette } from "@/lib/branding";
import type { DesignDNA, DesignLayout } from "./types";
import { getPersonality, personalityForCategory } from "./personalities";
import { LAYOUT_SLOTS, pick, selectLayout, type LayoutSlot, type RandomSource } from "./variants";

/** Stable 32-bit hash of a string (same approach as lib/branding). */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

/** mulberry32 — a tiny, fast, well-distributed seeded PRNG. */
function mulberry32(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate the presentation genome for a business. Deterministic: the same seed
 * always yields the same DNA, so SSG output is stable and regeneration is exact.
 *
 * Pass a `seedOverride` to explore *alternate* designs for the same business (the
 * factory's "generate / compare" — each candidate is just a different seed). With
 * no override the seed is the slug, so the live site is stable.
 */
export function generateDesignDNA(business: Business, seedOverride?: string): DesignDNA {
  const seed = seedOverride || business.slug || business.name;
  const rng = mulberry32(hashString(seed));

  // An explicit personality (e.g. set by the Industry Profiler) wins; otherwise
  // derive it from the category. Lets any industry get an on-brief feel.
  const personalityKey = business.personality ?? personalityForCategory(business.category);
  const p = getPersonality(personalityKey);

  // Palette comes from lib/branding (which already honours any business brand
  // override, then falls back to a category hue + per-name variance).
  const palette = getPalette(business);

  return {
    seed,
    personality: personalityKey,
    palette: {
      mode: pick(rng, p.modes),
      primaryHex: palette.primaryHex,
      accentHex: palette.accentHex,
    },
    typography: {
      heading: pick(rng, p.headingFonts),
      body: pick(rng, p.bodyFonts),
      scale: pick(rng, p.scales),
    },
    radius: pick(rng, p.radii),
    density: pick(rng, p.densities),
    motion: pick(rng, p.motions),
    layout: selectLayout(personalityKey, rng),
  };
}

/** The render layer's single source for a business's DNA. */
export function getDesignDNA(business: Business): DesignDNA {
  // A DNA chosen/saved in the Website Factory wins; otherwise derive deterministically.
  if (business.design) return business.design;
  return generateDesignDNA(business);
}

// ---------------------------------------------------------------------------
// Design specs — a tiny, serialisable description of one candidate design.
// The factory passes these around (in component props and preview URLs) instead
// of whole DNA objects: a seed (which fixes palette/type/radius/density/motion +
// a base layout) plus optional per-slot layout overrides (from "regenerate
// section"). buildDna() resolves a spec back to a full DesignDNA.
// ---------------------------------------------------------------------------

export interface DnaSpec {
  seed: string;
  /** Slot overrides applied on top of the seed's base layout. */
  overrides?: Partial<DesignLayout>;
}

/** Stable seed for the Nth candidate of a business (0 = the canonical/live seed). */
export function candidateSeed(business: Business, n: number): string {
  const base = business.slug || business.name;
  return n <= 0 ? base : `${base}#${n}`;
}

/** Resolve a spec to a full DesignDNA (seed → base DNA, then apply slot overrides). */
export function buildDna(business: Business, spec: DnaSpec): DesignDNA {
  const dna = generateDesignDNA(business, spec.seed);
  if (spec.overrides) {
    dna.layout = { ...dna.layout, ...spec.overrides };
  }
  return dna;
}

/** Flatten a spec to URL search params (seed + every resolved slot) for previews. */
export function specToParams(business: Business, spec: DnaSpec): URLSearchParams {
  const layout = buildDna(business, spec).layout;
  const params = new URLSearchParams({ seed: spec.seed });
  for (const slot of LAYOUT_SLOTS) params.set(slot, layout[slot]);
  return params;
}

/** Rebuild a spec from preview search params (the inverse of specToParams). */
export function specFromParams(params: {
  [key: string]: string | string[] | undefined;
}): DnaSpec {
  const get = (k: string): string | undefined => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const seed = get("seed") || "";
  const overrides: Partial<DesignLayout> = {};
  for (const slot of LAYOUT_SLOTS) {
    const v = get(slot) as DesignLayout[LayoutSlot] | undefined;
    if (v) overrides[slot] = v as never;
  }
  return { seed, overrides };
}
