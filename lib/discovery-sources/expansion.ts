import type { Prospect } from "@/lib/types";
import type { CampaignBrief } from "./campaign";

/**
 * Competitor expansion (Agency OS — §2.2/§2.3, "competitor expansion graph").
 *
 * Discovery shouldn't only find NEW markets — it should expand the ones we're
 * already in. This derives a campaign brief from the org's existing prospects:
 * take the (city, industry) pairs we already have a foothold in, prioritise the
 * highest-opportunity ones, and re-sweep them to surface the competitors we
 * haven't captured yet. The resulting brief flows through the normal campaign →
 * Discovery-agent pipeline, whose dedup means re-finding the seeds is harmless.
 *
 * Pure + deterministic — no network, no deps. Bounds the query grid so a big
 * pipeline can't fan out into thousands of queries in one run.
 */

export interface ExpansionOptions {
  /** Only seed from prospects scoring at least this (0–100). Default 50. */
  minOpportunity?: number;
  /** Cap distinct towns swept. Default 8. */
  maxAreas?: number;
  /** Cap distinct services targeted. Default 6. */
  maxCategories?: number;
}

/** The human search term for a prospect (raw industry label beats the enum). */
function keywordFor(p: Prospect): string {
  const raw = p.source?.industry?.trim();
  if (raw) return raw.toLowerCase();
  if (p.category === "other") return ""; // no usable keyword
  return p.category.replace(/-/g, " ");
}

/**
 * Build a competitor-expansion campaign brief from existing prospects. Picks the
 * cities + services with the strongest opportunity footholds, capped for safety.
 */
export function buildExpansionBrief(
  prospects: Prospect[],
  opts: ExpansionOptions = {}
): CampaignBrief {
  const minOpportunity = opts.minOpportunity ?? 50;
  const maxAreas = Math.min(Math.max(opts.maxAreas ?? 8, 1), 20);
  const maxCategories = Math.min(Math.max(opts.maxCategories ?? 6, 1), 12);

  const seeds = prospects.filter(
    (p) =>
      p.opportunityScore >= minOpportunity &&
      p.status !== "won" &&
      p.status !== "lost" &&
      (p.city ?? "").trim()
  );

  // Rank cities + keywords by the best opportunity score seen for each.
  const bestArea = new Map<string, number>();
  const bestKeyword = new Map<string, number>();
  for (const p of seeds) {
    const area = p.city!.trim();
    bestArea.set(area, Math.max(bestArea.get(area) ?? 0, p.opportunityScore));
    const kw = keywordFor(p);
    if (kw) bestKeyword.set(kw, Math.max(bestKeyword.get(kw) ?? 0, p.opportunityScore));
  }

  const areas = [...bestArea.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxAreas)
    .map(([area]) => area);
  const categories = [...bestKeyword.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCategories)
    .map(([kw]) => kw);

  return { areas, categories, perQueryLimit: 30, maxTotal: 600 };
}
