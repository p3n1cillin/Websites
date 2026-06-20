import type { Business, BusinessCategory } from "./types";

/**
 * Deterministic brand-colour generation.
 *
 * If a business supplies brand colours they win; otherwise we derive a stable,
 * pleasant palette from the business name + category so every auto-generated
 * site looks distinct without manual design work.
 */

const CATEGORY_HUES: Record<BusinessCategory, number> = {
  plumber: 212,
  electrician: 38,
  barber: 222,
  restaurant: 12,
  cleaner: 190,
  landscaper: 140,
  dentist: 196,
  mechanic: 0,
  "beauty-salon": 322,
  roofer: 24,
  retail: 268,
  other: 212,
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function shift(
  [r, g, b]: [number, number, number],
  amount: number
): [number, number, number] {
  const adj = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + amount)));
  return [adj(r), adj(g), adj(b)];
}

export interface BrandPalette {
  /** "r g b" triplets for use in CSS variables (Tailwind alpha-aware). */
  brand: string;
  brandFg: string;
  brandDark: string;
  brandLight: string;
  accent: string;
  /** Original hex values (used for things like theme-color meta). */
  primaryHex: string;
  accentHex: string;
}

function rgbVar([r, g, b]: [number, number, number]): string {
  return `${r} ${g} ${b}`;
}

function readableForeground(
  [r, g, b]: [number, number, number]
): [number, number, number] {
  // YIQ contrast — choose near-white or near-black for text on the brand colour.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? [17, 24, 39] : [255, 255, 255];
}

export function getPalette(business: Business): BrandPalette {
  let primary: [number, number, number];
  let accent: [number, number, number];

  if (business.brand?.primary) {
    primary = hexToRgb(business.brand.primary);
  } else {
    const hue = CATEGORY_HUES[business.category] ?? 212;
    const variance = (hashString(business.name) % 24) - 12; // ±12° per business
    primary = hslToRgb((hue + variance + 360) % 360, 68, 46);
  }

  if (business.brand?.accent) {
    accent = hexToRgb(business.brand.accent);
  } else {
    // Complementary-ish accent for CTAs.
    const hue = CATEGORY_HUES[business.category] ?? 212;
    accent = hslToRgb((hue + 150) % 360, 80, 52);
  }

  const toHex = ([r, g, b]: [number, number, number]) =>
    "#" +
    [r, g, b]
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("");

  return {
    brand: rgbVar(primary),
    brandFg: rgbVar(readableForeground(primary)),
    brandDark: rgbVar(shift(primary, -42)),
    brandLight: rgbVar(shift(primary, 150)),
    accent: rgbVar(accent),
    primaryHex: toHex(primary),
    accentHex: toHex(accent),
  };
}

/** Inline CSS-variable style object applied to the business layout wrapper. */
export function brandStyle(business: Business): React.CSSProperties {
  const p = getPalette(business);
  return {
    ["--brand" as string]: p.brand,
    ["--brand-fg" as string]: p.brandFg,
    ["--brand-dark" as string]: p.brandDark,
    ["--brand-light" as string]: p.brandLight,
    ["--accent" as string]: p.accent,
  };
}
