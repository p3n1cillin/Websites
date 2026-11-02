import { revalidateTag } from "next/cache";

/**
 * Centralised Next.js cache-tag names.
 *
 * Reads attach these tags; writes call `safeRevalidateTag(...)` with the same names
 * so a published edit refreshes the live site on demand (~1s) instead of waiting
 * for the old time-based `revalidate: 3600`.
 */

/** The cross-tenant catalogue: homepage directory + sitemap. */
export const CATALOGUE_TAG = "catalogue";

/** A single tenant site (all of its pages). */
export function tenantTag(slug: string): string {
  return `business:${slug}`;
}

/** A single tenant's blog (index + every article). */
export function blogTag(slug: string): string {
  return `blog:${slug}`;
}

/** revalidateTag that never throws (e.g. when called outside a request). */
export function safeRevalidateTag(tag: string): void {
  try {
    revalidateTag(tag, "default");
  } catch {
    /* safe fallback */
  }
}
