import type { BusinessCategory, Prospect } from "./types";

/**
 * Business graph + opportunity clustering.
 *
 * The growth spec's "competitor expansion graph" and "niche domination" come down
 * to one actionable question: which (industry × town) pockets are big AND weak, so
 * we can own them? This derives that purely from the prospect table — no new
 * storage, degrades to [] with no data. A CLUSTER is a category+city group; its
 * dominationScore blends how much opportunity it holds, how much digital whitespace
 * (no/weak websites) is up for grabs, and how many businesses are in play.
 */

const WEAK_PRESENCE = 40; // presenceScore below this counts as weak/whitespace

export interface ClusterStat {
  key: string;
  category: BusinessCategory;
  city: string;
  size: number;
  /** Businesses with no website at all. */
  noWebsite: number;
  /** Share (0–100) with no website OR a weak presence — the addressable whitespace. */
  whitespacePct: number;
  avgOpportunity: number;
  avgPresence: number;
  /** Sum of first-year value estimates across the cluster, pence. */
  addressableValuePence: number;
  /** 0–100 — pursue-this-cluster-first ranking. */
  dominationScore: number;
  /** Highest-opportunity prospect ids in the cluster (for quick drill-in). */
  topProspectIds: string[];
}

export interface BusinessGraph {
  clusters: ClusterStat[];
  totalNodes: number;
  /** Competitor edges = within-cluster pairs (same category + city). */
  totalCompetitorEdges: number;
}

const round = (n: number) => Math.round(n);

export function buildBusinessGraph(prospects: Prospect[]): BusinessGraph {
  const groups = new Map<string, Prospect[]>();
  for (const p of prospects) {
    const city = (p.city || "Unknown").trim();
    const key = `${p.category}|${city.toLowerCase()}`;
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  let totalCompetitorEdges = 0;
  const clusters: ClusterStat[] = [];

  for (const [key, members] of groups) {
    const size = members.length;
    totalCompetitorEdges += (size * (size - 1)) / 2;

    const noWebsite = members.filter((m) => !m.websiteUrl).length;
    const weak = members.filter((m) => !m.websiteUrl || m.presenceScore < WEAK_PRESENCE).length;
    const whitespacePct = round((weak / size) * 100);
    const avgOpportunity = round(members.reduce((s, m) => s + m.opportunityScore, 0) / size);
    const avgPresence = round(members.reduce((s, m) => s + m.presenceScore, 0) / size);
    const addressableValuePence = members.reduce((s, m) => s + m.valueEstimate, 0);

    // Domination: mostly opportunity + whitespace, with a bounded size kicker so a
    // huge weak cluster outranks a tiny one without size dominating outright.
    const sizeFactor = (Math.min(size, 20) / 20) * 100;
    const dominationScore = round(avgOpportunity * 0.5 + whitespacePct * 0.3 + sizeFactor * 0.2);

    const topProspectIds = [...members]
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 5)
      .map((m) => m.id);

    clusters.push({
      key,
      category: members[0].category,
      city: members[0].city || "Unknown",
      size,
      noWebsite,
      whitespacePct,
      avgOpportunity,
      avgPresence,
      addressableValuePence,
      dominationScore,
      topProspectIds,
    });
  }

  clusters.sort((a, b) => b.dominationScore - a.dominationScore);
  return { clusters, totalNodes: prospects.length, totalCompetitorEdges };
}
