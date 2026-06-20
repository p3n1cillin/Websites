/**
 * Section variant selection.
 *
 * Each section SLOT (hero, services, trust, testimonials, cta) has a small set of
 * concrete component variants. A personality narrows the candidate set per slot so
 * the chosen layout still fits the brief, and a seeded RNG picks one — so the same
 * business always regenerates the same layout, but two businesses (even in the same
 * category) diverge across the combined slot space.
 */

import type {
  CtaVariant,
  DesignLayout,
  HeroVariant,
  PersonalityKey,
  ServicesVariant,
  TestimonialsVariant,
  TrustVariant,
} from "./types";

/** A 0..1 random source (see lib/design/dna.ts for the seeded implementation). */
export type RandomSource = () => number;

/** Deterministically pick one item from a non-empty list. */
export function pick<T>(rng: RandomSource, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/** Per-personality candidate variants for each slot. */
const HERO: Record<PersonalityKey, HeroVariant[]> = {
  "premium-clinical": ["spotlight", "minimal"],
  "fast-urgent": ["fullbleed", "spotlight"],
  "warm-inviting": ["spotlight", "fullbleed"],
  "modern-bold": ["fullbleed", "minimal"],
  "trusted-traditional": ["spotlight", "minimal"],
};

const SERVICES: Record<PersonalityKey, ServicesVariant[]> = {
  "premium-clinical": ["feature", "rows"],
  "fast-urgent": ["rows", "cards"],
  "warm-inviting": ["cards", "feature"],
  "modern-bold": ["cards", "feature"],
  "trusted-traditional": ["rows", "cards"],
};

const TRUST: Record<PersonalityKey, TrustVariant[]> = {
  "premium-clinical": ["badges", "stats"],
  "fast-urgent": ["strip", "stats"],
  "warm-inviting": ["stats", "badges"],
  "modern-bold": ["stats", "strip"],
  "trusted-traditional": ["badges", "strip"],
};

const TESTIMONIALS: Record<PersonalityKey, TestimonialsVariant[]> = {
  "premium-clinical": ["quote", "grid"],
  "fast-urgent": ["grid", "quote"],
  "warm-inviting": ["grid", "quote"],
  "modern-bold": ["quote", "grid"],
  "trusted-traditional": ["grid", "quote"],
};

const CTA: Record<PersonalityKey, CtaVariant[]> = {
  "premium-clinical": ["split", "gradient"],
  "fast-urgent": ["gradient", "split"],
  "warm-inviting": ["split", "gradient"],
  "modern-bold": ["gradient", "split"],
  "trusted-traditional": ["split", "gradient"],
};

/** Choose a concrete variant for every home-page slot. */
export function selectLayout(
  personality: PersonalityKey,
  rng: RandomSource
): DesignLayout {
  return {
    hero: pick(rng, HERO[personality]),
    services: pick(rng, SERVICES[personality]),
    trust: pick(rng, TRUST[personality]),
    testimonials: pick(rng, TESTIMONIALS[personality]),
    cta: pick(rng, CTA[personality]),
  };
}

/** A section slot of the home page. */
export type LayoutSlot = keyof DesignLayout;

export const LAYOUT_SLOTS: LayoutSlot[] = [
  "hero",
  "services",
  "trust",
  "testimonials",
  "cta",
];

/** All candidate maps keyed by slot, so a slot can be addressed dynamically. */
const CANDIDATES: { [S in LayoutSlot]: Record<PersonalityKey, DesignLayout[S][]> } = {
  hero: HERO,
  services: SERVICES,
  trust: TRUST,
  testimonials: TESTIMONIALS,
  cta: CTA,
};

/** The on-brief candidate variants a slot can take for a given personality. */
export function variantCandidates<S extends LayoutSlot>(
  personality: PersonalityKey,
  slot: S
): DesignLayout[S][] {
  return CANDIDATES[slot][personality];
}

/**
 * Next on-brief variant for a slot (wraps). Powers the factory's "regenerate this
 * section" — it stays within the personality's candidate set so the result is still
 * coherent, just structurally different.
 */
export function cycleVariant<S extends LayoutSlot>(
  personality: PersonalityKey,
  slot: S,
  current: DesignLayout[S]
): DesignLayout[S] {
  const list = CANDIDATES[slot][personality];
  const i = list.indexOf(current);
  return list[(i + 1) % list.length];
}
