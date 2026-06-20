/**
 * Image pipeline helpers.
 *
 * Optimization itself is handled by Next.js' built-in image optimizer (see the
 * `images` config in next.config.mjs — AVIF/WebP, responsive srcsets, long-TTL
 * caching). This module adds the small extras that make that pipeline pleasant:
 * a lightweight blur placeholder so large images fade in instead of popping,
 * reusable `sizes` presets, and a builder for Supabase Storage public URLs so
 * tenant-uploaded media flows through the same optimizer.
 */

/**
 * A tiny inline SVG placeholder (an 8×8 slate rectangle), base64-encoded, for
 * `placeholder="blur"`. Inline means no extra request and no per-image blur
 * generation step — ideal for remote images where Next can't auto-generate a
 * blurDataURL. Precomputed as a literal so it's safe to import into client
 * components (no Node `Buffer` in the browser bundle).
 *
 * Decodes to:
 *   <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8">
 *     <rect width="8" height="8" fill="#e2e8f0"/></svg>
 */
export const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4=";

/** Common responsive `sizes` values, so call sites don't hand-roll them. */
export const SIZES = {
  /** Edge-to-edge background / hero image. */
  full: "100vw",
  /** A card in a responsive 1→2→3 column grid. */
  card: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  /** A roughly half-width content image. */
  half: "(min-width: 768px) 50vw, 100vw",
} as const;

/**
 * Build a public URL for an object in a Supabase Storage bucket. Returns null
 * when Supabase isn't configured so callers can fall back gracefully. The host
 * is allow-listed in next.config.mjs, so the result is optimizer-eligible.
 */
export function supabaseImageUrl(bucket: string, path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  const clean = path.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${bucket}/${clean}`;
}
