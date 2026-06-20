/**
 * Content uniqueness — the "no two sites alike" memory the QA gate (Agent 4) reads.
 *
 * The structural side of uniqueness is already guaranteed by the DNA engine (a
 * seeded layout + palette/type genome). This module guards the *content* side: it
 * fingerprints a business's marketing copy and measures how similar it is to other
 * sites it could be confused with (same category, same city). The QA gate fails any
 * candidate whose copy is a near-duplicate of an existing site so it gets regenerated.
 *
 * Phase C compares against the org's own sibling sites (loaded server-side). The
 * cross-org `content_fingerprints` table sketched in docs/AGENCY_OS.md §4.4 is the
 * later, global generalisation behind the same `similarityAgainst()` signature.
 */

import type { Business } from "@/lib/types";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "from", "that",
  "this", "have", "has", "all", "can", "will", "get", "out", "now", "any",
  "who", "why", "how", "but", "not", "into", "more", "than", "then", "them",
  "they", "their", "his", "her", "its", "was", "were", "been", "being", "a",
]);

/** Normalise text to a stream of lowercase word tokens (stop words removed). */
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/** Word-level trigrams — a phrasing fingerprint less brittle than full sentences. */
function trigrams(text: string): Set<string> {
  const t = tokens(text);
  const grams = new Set<string>();
  for (let i = 0; i + 2 < t.length; i++) grams.add(`${t[i]} ${t[i + 1]} ${t[i + 2]}`);
  // Keep single salient words too, so very short copy still fingerprints.
  for (const w of t) grams.add(w);
  return grams;
}

/** The marketing copy that defines how a site "reads" (what we de-duplicate on). */
export function contentText(business: Business): string {
  return [
    business.tagline,
    business.about,
    ...business.services.map((s) => `${s.name} ${s.description}`),
    ...business.testimonials.map((t) => t.quote),
  ].join("\n");
}

/** A business's content fingerprint (a set of phrasing n-grams). */
export function fingerprint(business: Business): Set<string> {
  return trigrams(contentText(business));
}

/** Jaccard overlap of two fingerprints, 0 (disjoint) … 1 (identical). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const g of a) if (b.has(g)) shared++;
  return shared / (a.size + b.size - shared);
}

export interface SimilarityHit {
  slug: string;
  name: string;
  score: number;
}

/**
 * Highest content similarity of `business` against a set of other sites it could be
 * confused with. Only same-category sites are compared (a dentist and a plumber are
 * never "duplicates"). Returns the worst (closest) match, or null if nothing comparable.
 */
export function similarityAgainst(
  business: Business,
  others: Business[]
): SimilarityHit | null {
  const fp = fingerprint(business);
  let worst: SimilarityHit | null = null;
  for (const other of others) {
    if (other.slug === business.slug) continue;
    if (other.category !== business.category) continue;
    const score = jaccard(fp, fingerprint(other));
    if (!worst || score > worst.score) {
      worst = { slug: other.slug, name: other.name, score };
    }
  }
  return worst;
}
