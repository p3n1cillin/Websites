import type { ClusterStat } from "./discovery-graph";
import type { ClientRetainer } from "./types";

/**
 * Personal Opportunity & Revenue Empire Engine.
 *
 * The platform's real purpose isn't "run an agency" — it's to build a portfolio of
 * revenue-generating ASSETS. This engine reads the agency's real signals (industry
 * clusters, live retainers, built sites) and derives concrete revenue OPPORTUNITIES
 * beyond just selling websites — leadgen assets, digital products, SaaS, content,
 * affiliate, acquisitions — each scored on profit/recurring/scalability/automation
 * AND on empire synergy (does it reuse what we already own?).
 *
 * Deterministic + dependency-free (Cost Control: code before AI — zero tokens). Money
 * figures are explicit MODELS, never measured facts.
 */

export type OppCategory =
  | "service"
  | "digital-product"
  | "saas"
  | "content"
  | "affiliate"
  | "leadgen"
  | "acquisition";

export const OPP_CATEGORY_LABEL: Record<OppCategory, string> = {
  service: "Service",
  "digital-product": "Digital product",
  saas: "SaaS",
  content: "Content",
  affiliate: "Affiliate",
  leadgen: "Lead-gen asset",
  acquisition: "Acquisition",
};

type Level = "low" | "medium" | "high";

export interface RevenueOpportunity {
  id: string;
  title: string;
  category: OppCategory;
  rationale: string;
  effort: Level;
  startupCostPence: number;
  timeToRevenueDays: number;
  /** Modelled monthly recurring potential at maturity, pence. */
  recurringPotentialPence: number;
  scalability: number; // 0–100
  automation: number; // 0–100
  risk: Level;
  competition: Level;
  /** Profit/recurring/scalability/automation/speed/edge → 0–100. */
  opportunityScore: number;
  /** Strategic value + synergy + knowledge reuse + cross-sell → 0–100. */
  empireScore: number;
  /** The real signal that seeded this opportunity. */
  source: string;
}

export type AssetType =
  | "agency"
  | "website"
  | "lead-database"
  | "content"
  | "saas"
  | "email-list"
  | "brand";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  /** Current monthly revenue, pence (0 = pre-revenue but owned). */
  monthlyRevenuePence: number;
  note: string;
}

export interface EmpirePortfolio {
  opportunities: RevenueOpportunity[];
  assets: Asset[];
  totalMrrPence: number;
  /** Modelled portfolio value = MRR × 24 (a simple recurring-multiple). */
  assetValuePence: number;
  streams: { category: AssetType; count: number; mrrPence: number }[];
  /** % of active MRR opened in the last 30 days, or null if no retainers. */
  growthRatePct: number | null;
}

const LEVEL_NUM: Record<Level, number> = { low: 100, medium: 60, high: 25 };

/** Composite opportunity score from the spec's dimensions. */
function scoreOpportunity(o: Omit<RevenueOpportunity, "opportunityScore" | "empireScore">): number {
  const recurring = Math.min(100, (o.recurringPotentialPence / 200_000) * 100); // £2k/mo ≈ 100
  const speed = Math.max(0, 100 - o.timeToRevenueDays / 1.8); // ~180d → 0
  const cost = Math.max(0, 100 - o.startupCostPence / 5_000); // £250 → ~50
  return Math.round(
    recurring * 0.3 +
      o.scalability * 0.2 +
      o.automation * 0.15 +
      speed * 0.15 +
      LEVEL_NUM[o.competition] * 0.1 +
      cost * 0.1
  );
}

export interface EmpireInputs {
  clusters: ClusterStat[];
  retainers: ClientRetainer[];
  liveSites: number;
  prospectCount: number;
  orgName: string;
}

const gbpP = (pence: number) => pence;

/** Build the full empire portfolio (assets + ranked opportunities) from real signals. */
export function buildEmpirePortfolio(input: EmpireInputs): EmpirePortfolio {
  const { clusters, retainers, liveSites, prospectCount, orgName } = input;
  const active = retainers.filter((r) => r.status === "active");
  const totalMrrPence = active.reduce((s, r) => s + r.monthlyPence, 0);

  // ---- Assets we already own --------------------------------------------------
  const assets: Asset[] = [];
  assets.push({
    id: "asset-agency",
    name: `${orgName} (agency)`,
    type: "agency",
    monthlyRevenuePence: totalMrrPence,
    note: `${active.length} client retainer${active.length === 1 ? "" : "s"} on recurring revenue.`,
  });
  if (liveSites > 0) {
    assets.push({
      id: "asset-sites",
      name: "Managed client websites",
      type: "website",
      monthlyRevenuePence: 0,
      note: `${liveSites} live site${liveSites === 1 ? "" : "s"} under management — recurring care plans + upsell surface.`,
    });
  }
  if (prospectCount > 0) {
    assets.push({
      id: "asset-leads",
      name: "Prospect / lead database",
      type: "lead-database",
      monthlyRevenuePence: 0,
      note: `${prospectCount} scored local businesses — reusable for outreach, lead sales + directories.`,
    });
  }
  assets.push({
    id: "asset-platform",
    name: "Empire Agencies platform",
    type: "saas",
    monthlyRevenuePence: 0,
    note: "The build/discovery/sales engine itself — licensable as SaaS.",
  });

  // ---- Opportunities derived from real signals --------------------------------
  const opps: Omit<RevenueOpportunity, "opportunityScore" | "empireScore">[] = [];
  const topClusters = [...clusters].sort((a, b) => b.dominationScore - a.dominationScore);

  // 1. Lead-gen directory for the strongest whitespace cluster.
  const lead = topClusters.find((c) => c.size >= 3 && c.whitespacePct >= 40);
  if (lead) {
    opps.push({
      id: `opp-leadgen-${lead.key}`,
      title: `Lead-gen directory: ${lead.category} in ${lead.city}`,
      category: "leadgen",
      rationale: `${lead.size} ${lead.category}s here, ${lead.whitespacePct}% with weak/no site — rank a directory + sell the leads to them.`,
      effort: "medium",
      startupCostPence: 5_000,
      timeToRevenueDays: 60,
      recurringPotentialPence: Math.min(150_000, Math.round(lead.addressableValuePence * 0.02)),
      scalability: 80,
      automation: 70,
      risk: "low",
      competition: "medium",
      source: `cluster ${lead.category}·${lead.city} (domination ${lead.dominationScore})`,
    });
  }

  // 2. Productized website service for the highest-value cluster.
  const svc = topClusters.find((c) => c.size >= 2);
  if (svc) {
    opps.push({
      id: `opp-service-${svc.key}`,
      title: `Productized ${svc.category} website package`,
      category: "service",
      rationale: `Repeatable fixed-scope site + care plan for ${svc.category}s — reuse the existing factory + templates.`,
      effort: "low",
      startupCostPence: 0,
      timeToRevenueDays: 14,
      recurringPotentialPence: 39_00 * Math.min(20, svc.size),
      scalability: 65,
      automation: 75,
      risk: "low",
      competition: "high",
      source: `cluster ${svc.category}·${svc.city}`,
    });
  }

  // 3. Digital product — Map Pack Kit (instant self-serve GBP content kits).
  opps.push({
    id: "opp-map-pack-kit",
    title: "Map Pack Kit — Google Business Profile content kits",
    category: "digital-product",
    rationale: "Self-serve £19/£29 instant content kits for trades: 52 weekly posts + review scripts generated on Stripe payment.",
    effort: "low",
    startupCostPence: 0,
    timeToRevenueDays: 1,
    recurringPotentialPence: 80_000,
    scalability: 98,
    automation: 95,
    risk: "low",
    competition: "low",
    source: "Map Pack Kit digital product engine (/map-pack-kit)",
  });

  // 3b. Digital product — sell the design system / templates we already build.
  if (liveSites > 0 || prospectCount > 5) {
    opps.push({
      id: "opp-templates",
      title: "Industry website templates & design system",
      category: "digital-product",
      rationale: "Package the component/design system into sellable templates — build once, sell many.",
      effort: "medium",
      startupCostPence: 0,
      timeToRevenueDays: 45,
      recurringPotentialPence: 40_000,
      scalability: 95,
      automation: 85,
      risk: "low",
      competition: "medium",
      source: "existing design system + component registry",
    });
  }

  // 4. SaaS — license the platform itself. Highest empire synergy.
  opps.push({
    id: "opp-saas",
    title: "License the Empire Agencies platform as SaaS",
    category: "saas",
    rationale: "Sell the discovery→build→sell engine to other agencies — recurring seats, the platform already exists.",
    effort: "high",
    startupCostPence: 20_000,
    timeToRevenueDays: 120,
    recurringPotentialPence: 500_000,
    scalability: 100,
    automation: 80,
    risk: "medium",
    competition: "medium",
    source: "the platform itself (built)",
  });

  // 5. Affiliate — recurring software commissions bundled into client care plans.
  if (totalMrrPence > 0 || liveSites > 0) {
    opps.push({
      id: "opp-affiliate",
      title: "Recurring SaaS affiliate stack in care plans",
      category: "affiliate",
      rationale: "Bundle hosting/booking/review tools into client plans for recurring affiliate commissions — pure synergy.",
      effort: "low",
      startupCostPence: 0,
      timeToRevenueDays: 30,
      recurringPotentialPence: Math.max(15_000, Math.round(totalMrrPence * 0.15)),
      scalability: 70,
      automation: 90,
      risk: "low",
      competition: "low",
      source: `${active.length} active client(s) + ${liveSites} site(s)`,
    });
  }

  // 6. Content — niche industry newsletter/site off the knowledge we accumulate.
  const contentCluster = topClusters[0];
  if (contentCluster) {
    opps.push({
      id: "opp-content",
      title: `Niche newsletter: ${contentCluster.category} owners`,
      category: "content",
      rationale: `Build an audience of ${contentCluster.category} owners — monetize via sponsors, affiliate + service upsell.`,
      effort: "medium",
      startupCostPence: 2_000,
      timeToRevenueDays: 90,
      recurringPotentialPence: 60_000,
      scalability: 90,
      automation: 60,
      risk: "medium",
      competition: "medium",
      source: `industry knowledge: ${contentCluster.category}`,
    });
  }

  // 7. Acquisition — buy + rebuild an underperforming site in a weak cluster.
  const acq = topClusters.find((c) => c.whitespacePct >= 50);
  if (acq) {
    opps.push({
      id: `opp-acq-${acq.key}`,
      title: `Acquire & rebuild a ${acq.category} site`,
      category: "acquisition",
      rationale: `${acq.whitespacePct}% weak presence in ${acq.city} — buy a tired site/domain cheap and rebuild it into a revenue asset.`,
      effort: "high",
      startupCostPence: 150_000,
      timeToRevenueDays: 75,
      recurringPotentialPence: 80_000,
      scalability: 50,
      automation: 40,
      risk: "high",
      competition: "low",
      source: `cluster ${acq.category}·${acq.city} (${acq.whitespacePct}% whitespace)`,
    });
  }

  // Empire score: synergy with what we already own + strategic reuse + cross-sell.
  const SYNERGY: Record<OppCategory, number> = {
    saas: 100,
    affiliate: 90,
    "digital-product": 85,
    leadgen: 80,
    service: 70,
    content: 60,
    acquisition: 45,
  };
  const opportunities: RevenueOpportunity[] = opps
    .map((o) => {
      const opportunityScore = scoreOpportunity(o);
      const recurringPull = Math.min(100, (o.recurringPotentialPence / 300_000) * 100);
      const empireScore = Math.round(SYNERGY[o.category] * 0.5 + recurringPull * 0.3 + o.scalability * 0.2);
      return { ...o, opportunityScore, empireScore };
    })
    .sort((a, b) => b.empireScore - a.empireScore);

  // ---- Streams + growth -------------------------------------------------------
  const streamMap = new Map<AssetType, { count: number; mrrPence: number }>();
  for (const a of assets) {
    const cur = streamMap.get(a.type) ?? { count: 0, mrrPence: 0 };
    cur.count += 1;
    cur.mrrPence += a.monthlyRevenuePence;
    streamMap.set(a.type, cur);
  }
  const streams = [...streamMap.entries()].map(([category, v]) => ({ category, ...v }));

  const now = Date.now();
  const DAY = 86_400_000;
  const newMrr = active
    .filter((r) => now - new Date(r.startedAt).getTime() <= 30 * DAY)
    .reduce((s, r) => s + r.monthlyPence, 0);
  const growthRatePct = active.length > 0 && totalMrrPence > 0 ? Math.round((newMrr / totalMrrPence) * 100) : null;

  return {
    opportunities,
    assets,
    totalMrrPence: gbpP(totalMrrPence),
    assetValuePence: totalMrrPence * 24,
    streams,
    growthRatePct,
  };
}
