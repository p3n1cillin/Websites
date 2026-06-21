/**
 * DesignDNA → CSS custom properties.
 *
 * The whole design system is expressed as CSS variables on the site root, so a
 * single static build serves every business with its own look. This is a strict
 * superset of lib/branding's `brandStyle` (it still emits --brand* and --accent so
 * existing components keep working) plus surface/ink, radius, spacing-density and
 * font tokens that the components/site variant library reads.
 */

import type { Business } from "@/lib/types";
import { getPalette } from "@/lib/branding";
import type {
  DensityKey,
  DesignDNA,
  FontKey,
  PaletteMode,
  RadiusKey,
  TypeScale,
} from "./types";

/** Resolved web-safe / system font stacks (no network webfonts). */
const FONT_STACKS: Record<FontKey, string> = {
  inter: "var(--font-sans), system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  system: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  // grotesk / garamond / slab are real self-hosted faces loaded in the [business]
  // layout (next/font), exposed as --font-* vars; fall back to web-safe stacks.
  grotesk: "var(--font-grotesk), 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  georgia: "Georgia, Cambria, 'Times New Roman', Times, serif",
  garamond: "var(--font-garamond), 'Hoefler Text', Garamond, Georgia, serif",
  slab: "var(--font-slab), Rockwell, 'Roboto Slab', Georgia, serif",
};

/** Surface + ink palette per mode, as alpha-aware "r g b" triplets. */
const MODE_TOKENS: Record<
  PaletteMode,
  {
    surface: string;
    surfaceMuted: string;
    ink: string;
    inkMuted: string;
    border: string;
  }
> = {
  light: {
    surface: "255 255 255",
    surfaceMuted: "249 250 251",
    ink: "17 24 39",
    inkMuted: "75 85 99",
    border: "229 231 235",
  },
  warm: {
    surface: "254 251 246",
    surfaceMuted: "250 244 235",
    ink: "41 37 36",
    inkMuted: "87 83 78",
    border: "231 224 213",
  },
  dark: {
    surface: "15 23 42",
    surfaceMuted: "30 41 59",
    ink: "248 250 252",
    inkMuted: "148 163 184",
    border: "51 65 85",
  },
};

/** Corner radii (sm / md / lg) plus the "pill" radius for rounded buttons. */
const RADIUS_TOKENS: Record<RadiusKey, { sm: string; md: string; lg: string; pill: string }> = {
  sharp: { sm: "2px", md: "4px", lg: "8px", pill: "8px" },
  soft: { sm: "8px", md: "14px", lg: "22px", pill: "9999px" },
  pill: { sm: "12px", md: "20px", lg: "32px", pill: "9999px" },
};

/** Vertical section padding + grid gap by density. */
const DENSITY_TOKENS: Record<DensityKey, { sectionY: string; gap: string }> = {
  airy: { sectionY: "5.5rem", gap: "1.75rem" },
  compact: { sectionY: "3.5rem", gap: "1.1rem" },
};

/** Base body font size by type scale. */
const SCALE_TOKENS: Record<TypeScale, { base: string; lead: string }> = {
  tight: { base: "1rem", lead: "1.125rem" },
  editorial: { base: "1.0625rem", lead: "1.25rem" },
};

/**
 * Build the inline style object (CSS variables) for a site root. Apply on the
 * business layout wrapper; every page + variant component below it inherits the
 * tokens. Body font + page surface/ink are set directly so the look is coherent
 * even on pages that don't (yet) consume the variant library.
 */
export function designTokens(business: Business, dna: DesignDNA): React.CSSProperties {
  const palette = getPalette(business);
  const mode = MODE_TOKENS[dna.palette.mode];
  const radius = RADIUS_TOKENS[dna.radius];
  const density = DENSITY_TOKENS[dna.density];
  const scale = SCALE_TOKENS[dna.typography.scale];

  const vars: Record<string, string> = {
    // Brand palette (superset of lib/branding brandStyle — keeps existing classes working).
    "--brand": palette.brand,
    "--brand-fg": palette.brandFg,
    "--brand-dark": palette.brandDark,
    "--brand-light": palette.brandLight,
    "--accent": palette.accent,
    // Surface + ink for the active mode.
    "--surface": mode.surface,
    "--surface-muted": mode.surfaceMuted,
    "--ink": mode.ink,
    "--ink-muted": mode.inkMuted,
    "--border": mode.border,
    // Geometry.
    "--radius-sm": radius.sm,
    "--radius": radius.md,
    "--radius-lg": radius.lg,
    "--radius-pill": radius.pill,
    // Rhythm.
    "--section-y": density.sectionY,
    "--gap": density.gap,
    // Type.
    "--font-heading": FONT_STACKS[dna.typography.heading],
    "--font-body": FONT_STACKS[dna.typography.body],
    "--text-base": scale.base,
    "--text-lead": scale.lead,
  };

  return {
    ...(vars as React.CSSProperties),
    backgroundColor: "rgb(var(--surface))",
    color: "rgb(var(--ink))",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-base)",
  };
}
