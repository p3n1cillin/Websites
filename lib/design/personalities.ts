/**
 * Personality presets — the bridge from a business category to a design "feel".
 *
 * A personality biases the *ranges* the DNA generator samples from (palette mode,
 * font pairings, radius, density, motion) AND carries a `tone` hint that the future
 * AI copy step (the `design` agent) uses to keep words and visuals consistent —
 * e.g. a dentist gets a calm, premium-clinical look and measured copy, a plumber a
 * fast, urgent look and direct copy.
 *
 * Sampling within a personality (not a single fixed theme) is what keeps two sites
 * in the same category visibly distinct while staying on-brief.
 */

import type { BusinessCategory } from "@/lib/types";
import type {
  DensityKey,
  FontKey,
  MotionKey,
  PaletteMode,
  PersonalityKey,
  RadiusKey,
  TypeScale,
} from "./types";

export interface PersonalityPreset {
  key: PersonalityKey;
  /** Human label for dashboards / the factory UI. */
  label: string;
  /** Allowed palette modes (the generator picks one). */
  modes: PaletteMode[];
  headingFonts: FontKey[];
  bodyFonts: FontKey[];
  scales: TypeScale[];
  radii: RadiusKey[];
  densities: DensityKey[];
  motions: MotionKey[];
  /** Copy-tone guidance for the AI copy step (Phase B+ / the design agent). */
  tone: string;
}

export const PERSONALITIES: Record<PersonalityKey, PersonalityPreset> = {
  "premium-clinical": {
    key: "premium-clinical",
    label: "Premium / Clinical",
    modes: ["light"],
    headingFonts: ["garamond", "georgia", "grotesk"],
    bodyFonts: ["inter", "system"],
    scales: ["editorial", "tight"],
    radii: ["soft", "sharp"],
    densities: ["airy"],
    motions: ["calm"],
    tone: "Calm, precise and reassuring. Emphasise expertise, hygiene, comfort and quiet confidence. No exclamation marks; let credentials do the talking.",
  },
  "fast-urgent": {
    key: "fast-urgent",
    label: "Fast / Urgent",
    modes: ["light"],
    headingFonts: ["grotesk", "inter", "slab"],
    bodyFonts: ["inter", "system"],
    scales: ["tight"],
    radii: ["sharp", "soft"],
    densities: ["compact"],
    motions: ["lively"],
    tone: "Direct and action-led. Lead with speed, availability and a clear phone number. Short sentences, strong verbs, emphasise emergency call-out and rapid response.",
  },
  "warm-inviting": {
    key: "warm-inviting",
    label: "Warm / Inviting",
    modes: ["warm", "light"],
    headingFonts: ["georgia", "garamond", "inter"],
    bodyFonts: ["inter", "system"],
    scales: ["editorial", "tight"],
    radii: ["pill", "soft"],
    densities: ["airy"],
    motions: ["calm", "lively"],
    tone: "Friendly, personal and local. Use a warm, welcoming voice; mention the team, the neighbourhood and a relaxed, looked-after experience.",
  },
  "modern-bold": {
    key: "modern-bold",
    label: "Modern / Bold",
    modes: ["light", "warm"],
    headingFonts: ["grotesk", "slab", "inter"],
    bodyFonts: ["inter", "system"],
    scales: ["tight", "editorial"],
    radii: ["sharp", "soft"],
    densities: ["airy", "compact"],
    motions: ["lively"],
    tone: "Confident and contemporary. A sharp, stylish voice with strong statements; appeal to people who want the current, on-trend choice.",
  },
  "trusted-traditional": {
    key: "trusted-traditional",
    label: "Trusted / Traditional",
    modes: ["light"],
    headingFonts: ["slab", "georgia", "grotesk"],
    bodyFonts: ["inter", "system"],
    scales: ["tight"],
    radii: ["soft", "sharp"],
    densities: ["compact", "airy"],
    motions: ["calm"],
    tone: "Dependable and established. Stress experience, guarantees, accreditations and honest, no-nonsense workmanship. Plain, trustworthy language.",
  },
};

/** Default personality for each category (the discovery/market agents can override later). */
const CATEGORY_PERSONALITY: Record<BusinessCategory, PersonalityKey> = {
  dentist: "premium-clinical",
  "beauty-salon": "premium-clinical",
  plumber: "fast-urgent",
  electrician: "fast-urgent",
  cleaner: "fast-urgent",
  roofer: "trusted-traditional",
  mechanic: "trusted-traditional",
  restaurant: "warm-inviting",
  landscaper: "warm-inviting",
  barber: "modern-bold",
  retail: "modern-bold",
  other: "trusted-traditional",
};

export function personalityForCategory(category: BusinessCategory): PersonalityKey {
  return CATEGORY_PERSONALITY[category] ?? "trusted-traditional";
}

export function getPersonality(key: PersonalityKey): PersonalityPreset {
  return PERSONALITIES[key];
}
