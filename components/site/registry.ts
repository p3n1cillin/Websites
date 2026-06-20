/**
 * Variant registry — maps each DesignDNA layout key to a concrete component.
 *
 * The home page renders `heroRegistry[dna.layout.hero]`, etc. Adding a new variant
 * is: write the component, add one entry here, extend the variant union in
 * lib/design/types.ts (+ its candidate list in lib/design/variants.ts). Every future
 * site can then receive it — no per-site code.
 */

import type {
  CtaVariant,
  HeroVariant,
  ServicesVariant,
  TestimonialsVariant,
  TrustVariant,
} from "@/lib/design/types";
import type { Business } from "@/lib/types";
import type { DesignDNA } from "@/lib/design/types";

import HeroFullbleed from "./hero/HeroFullbleed";
import HeroSpotlight from "./hero/HeroSpotlight";
import HeroMinimal from "./hero/HeroMinimal";

import ServicesCards from "./services/ServicesCards";
import ServicesRows from "./services/ServicesRows";
import ServicesFeature from "./services/ServicesFeature";

import TrustStrip from "./trust/TrustStrip";
import TrustStats from "./trust/TrustStats";
import TrustBadges from "./trust/TrustBadges";

import TestimonialsGrid from "./testimonials/TestimonialsGrid";
import TestimonialsQuote from "./testimonials/TestimonialsQuote";

import CtaGradient from "./cta/CtaGradient";
import CtaSplit from "./cta/CtaSplit";

/** Every section variant has the same props contract. */
export type SiteSectionProps = { business: Business; dna: DesignDNA };
export type SiteSection = (props: SiteSectionProps) => JSX.Element | null;

export const heroRegistry: Record<HeroVariant, SiteSection> = {
  fullbleed: HeroFullbleed,
  spotlight: HeroSpotlight,
  minimal: HeroMinimal,
};

export const servicesRegistry: Record<ServicesVariant, SiteSection> = {
  cards: ServicesCards,
  rows: ServicesRows,
  feature: ServicesFeature,
};

export const trustRegistry: Record<TrustVariant, SiteSection> = {
  strip: TrustStrip,
  stats: TrustStats,
  badges: TrustBadges,
};

export const testimonialsRegistry: Record<TestimonialsVariant, SiteSection> = {
  grid: TestimonialsGrid,
  quote: TestimonialsQuote,
};

export const ctaRegistry: Record<CtaVariant, SiteSection> = {
  gradient: CtaGradient,
  split: CtaSplit,
};
