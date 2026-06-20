/**
 * Design DNA — the presentation half of a generated website.
 *
 * The render model is: a site = `Business` (content) × `DesignDNA` (presentation).
 * Both are data. The `Business` (lib/types.ts) stays the single source of truth for
 * *what* a site says; `DesignDNA` decides *how it looks and is laid out* — without
 * any per-site code. Two layers do the work:
 *
 *  1. Tokens (palette/type/radius/density/motion) → CSS custom properties
 *     (see lib/design/tokens.ts). Components read the vars, so one change re-skins
 *     every section.
 *  2. Layout variants → a concrete component per section SLOT, chosen from a
 *     registry (see components/site/registry.ts).
 *
 * ~3 variants across 5 slots ≈ 100 structural layouts × a continuous palette/type
 * space ⇒ effectively unbounded distinct sites, all generated from data.
 *
 * These are the primitive types only (no generation logic) so personalities,
 * variants, tokens and the generator can all import them without a cycle.
 */

/** Overall light/contrast feel of the page surface. */
export type PaletteMode = "light" | "dark" | "warm";

/**
 * Font family choice. Resolved to a concrete CSS font stack in lib/design/tokens.ts.
 * Web-safe / system stacks only (no network webfont) to preserve the zero-dep,
 * fast-render philosophy — variety comes from genuinely different families
 * (sans vs grotesk vs serif vs slab), not from loading Google Fonts.
 */
export type FontKey =
  | "inter" // the bundled UI sans (var(--font-sans))
  | "system" // native system UI sans
  | "grotesk" // tighter geometric sans
  | "georgia" // classic serif
  | "garamond" // editorial old-style serif
  | "slab"; // slab serif, sturdy/industrial

/** Type rhythm: "tight" = punchy marketing scale, "editorial" = larger, looser. */
export type TypeScale = "tight" | "editorial";

/** Corner treatment across the whole site. */
export type RadiusKey = "sharp" | "soft" | "pill";

/** Vertical whitespace / breathing room. */
export type DensityKey = "airy" | "compact";

/** Animation energy. "lively" enables entrance animations; "calm" keeps still. */
export type MotionKey = "calm" | "lively";

/** Brand "feel" — biases palette, type, motion AND (later) the AI copy tone. */
export type PersonalityKey =
  | "premium-clinical"
  | "fast-urgent"
  | "warm-inviting"
  | "modern-bold"
  | "trusted-traditional";

// --- Section layout variants (one key per SLOT) --------------------------------

export type HeroVariant = "fullbleed" | "spotlight" | "minimal";
export type ServicesVariant = "cards" | "rows" | "feature";
export type TrustVariant = "strip" | "stats" | "badges";
export type TestimonialsVariant = "grid" | "quote";
export type CtaVariant = "gradient" | "split";

/** The chosen variant for each section slot of the home page. */
export interface DesignLayout {
  hero: HeroVariant;
  services: ServicesVariant;
  trust: TrustVariant;
  testimonials: TestimonialsVariant;
  cta: CtaVariant;
}

/** The complete presentation genome for one website. */
export interface DesignDNA {
  /** Deterministic seed (the business slug) — regenerates the exact same DNA. */
  seed: string;
  personality: PersonalityKey;
  palette: {
    mode: PaletteMode;
    /** Hex, sourced from lib/branding (respects any business brand override). */
    primaryHex: string;
    accentHex: string;
  };
  typography: { heading: FontKey; body: FontKey; scale: TypeScale };
  radius: RadiusKey;
  density: DensityKey;
  motion: MotionKey;
  layout: DesignLayout;
}
