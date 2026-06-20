import { revalidatePath } from "next/cache";
import { sbSelect, sbInsert, sbUpdate, supabaseWritable } from "./supabase/client";
import type { OppCategory, RevenueOpportunity } from "./empire";

/**
 * Autonomous Opportunity Execution Engine — moves a pursued opportunity through the
 * lifecycle (validation → … → live), always surfacing the single NEXT concrete
 * action and the real-world DEPENDENCIES (human approval / credentials / payment /
 * legal) that block full automation. Opportunities stop being ideas.
 *
 * Lifecycle + dependency logic is deterministic + dependency-free (Cost Control:
 * code before AI — zero tokens). Persistence is best-effort: a missing table just
 * means "no active ventures yet". NEVER fabricates revenue/customers/approvals —
 * it prepares everything and flags what a human must supply.
 */

export type OpportunityStage =
  | "validation"
  | "planning"
  | "asset_creation"
  | "deployment"
  | "monetization"
  | "optimization"
  | "scaling"
  | "live";

export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  "validation",
  "planning",
  "asset_creation",
  "deployment",
  "monetization",
  "optimization",
  "scaling",
  "live",
];

export const STAGE_LABEL: Record<OpportunityStage, string> = {
  validation: "Validation",
  planning: "Planning",
  asset_creation: "Asset creation",
  deployment: "Deployment",
  monetization: "Monetization",
  optimization: "Optimization",
  scaling: "Scaling",
  live: "Live",
};

/** Below this viability score a venture should not advance past validation. */
export const VIABILITY_THRESHOLD = 45;

export interface Venture {
  id: string;
  orgId: string;
  ref: string | null;
  title: string;
  category: OppCategory;
  stage: OpportunityStage;
  viabilityScore: number;
  recurringPotentialPence: number;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
}

export type DependencyKind = "human" | "credential" | "payment" | "legal";

export interface Dependency {
  label: string;
  kind: DependencyKind;
}

/**
 * Validation Engine — viability 0–100 from demand/competition/cost/speed/scale/
 * automation/return, derived from the catalog opportunity's modelled dimensions.
 */
export function scoreViability(o: RevenueOpportunity): number {
  const LVL = { low: 100, medium: 60, high: 25 } as const;
  const demand = Math.min(100, (o.recurringPotentialPence / 200_000) * 100);
  const speed = Math.max(0, 100 - o.timeToRevenueDays / 1.8);
  const cost = Math.max(0, 100 - o.startupCostPence / 5_000);
  return Math.round(
    demand * 0.25 +
      o.scalability * 0.2 +
      o.automation * 0.15 +
      speed * 0.15 +
      LVL[o.competition] * 0.15 +
      cost * 0.1
  );
}

/** The single next concrete action to move a venture toward revenue. */
export function nextActionFor(stage: OpportunityStage, category: OppCategory): string {
  if (stage === "validation")
    return "Confirm demand: check search volume + competitor count, then approve to plan.";
  if (stage === "planning")
    return "Lock scope: define the asset, monetization model + the one metric that proves it works.";
  if (stage === "asset_creation") {
    switch (category) {
      case "leadgen":
        return "Build the directory/landing asset in the factory + wire a lead-capture form.";
      case "service":
        return "Create the productized offer page + intake form; reuse the site factory.";
      case "digital-product":
        return "Package the templates/design system into a sellable bundle + a sales page.";
      case "saas":
        return "Scope the MVP feature set; stand up a waitlist landing page first.";
      case "content":
        return "Set up the newsletter/site + publish the first 3 cornerstone pieces.";
      case "affiliate":
        return "Pick the recurring-commission programs + build the comparison/round-up page.";
      case "acquisition":
        return "Shortlist target sites/domains + draft valuation and outreach.";
    }
  }
  if (stage === "deployment")
    return "Connect domain, hosting, SSL + analytics; submit for search indexing.";
  if (stage === "monetization")
    return "Switch on the monetization path (payments/lead sales/affiliate links) + price it.";
  if (stage === "optimization")
    return "Drive traffic + outreach; watch conversion and fix the biggest bottleneck.";
  if (stage === "scaling")
    return "Replicate into the next market/niche; templatize what worked.";
  return "Operational — monitor revenue + reinvest into the next venture.";
}

/** The monetization model to switch on for this category (Monetization Engine). */
export function monetizationPlanFor(category: OppCategory): { primary: string; channels: string[] } {
  switch (category) {
    case "leadgen":
      return { primary: "Sell qualified leads", channels: ["Lead sales", "Service upsell", "Affiliate"] };
    case "service":
      return { primary: "Productized service + care plan", channels: ["Fixed-scope fee", "Monthly retainer"] };
    case "digital-product":
      return { primary: "One-to-many product sales", channels: ["Direct sales", "Marketplace", "Bundles"] };
    case "saas":
      return { primary: "Subscription seats", channels: ["Monthly/annual plans", "Usage tiers"] };
    case "content":
      return { primary: "Audience monetization", channels: ["Sponsors", "Affiliate", "Service upsell"] };
    case "affiliate":
      return { primary: "Recurring commissions", channels: ["SaaS referrals", "Bundled in care plans"] };
    case "acquisition":
      return { primary: "Acquire + grow existing revenue", channels: ["Existing revenue", "Rebuild uplift"] };
  }
}

/**
 * Reality-constraint dependencies for a stage — the things a HUMAN must supply
 * (approval / credentials / payment / legal) before this stage can fully complete.
 * The engine prepares everything else; these are flagged, never fabricated.
 */
export function dependenciesFor(category: OppCategory, stage: OpportunityStage): Dependency[] {
  const deps: Dependency[] = [];
  if (stage === "validation") deps.push({ label: "Owner go-ahead to invest effort", kind: "human" });
  if (stage === "deployment") {
    deps.push({ label: "Domain purchase / ownership", kind: "payment" });
    deps.push({ label: "Hosting + DNS account access", kind: "credential" });
    deps.push({ label: "Analytics / Search Console access", kind: "credential" });
  }
  if (stage === "monetization") {
    deps.push({ label: "Payment processor (Stripe) connected", kind: "payment" });
    if (category === "affiliate") deps.push({ label: "Affiliate program approvals", kind: "legal" });
    if (category === "leadgen") deps.push({ label: "Lead-buyer agreements", kind: "legal" });
    if (category === "saas") deps.push({ label: "Terms of service + data policy", kind: "legal" });
  }
  if (category === "acquisition" && (stage === "planning" || stage === "asset_creation")) {
    deps.push({ label: "Acquisition budget + purchase approval", kind: "payment" });
  }
  return deps;
}

// ---------------------------------------------------------------------------
// Data layer (service role — org-scoped at the app layer).
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  org_id: string;
  ref: string | null;
  title: string;
  category: string;
  stage: OpportunityStage;
  viability_score: number;
  recurring_pence: number;
  next_action: string | null;
  created_at: string;
  updated_at: string;
}

const COLS =
  "select=id,org_id,ref,title,category,stage,viability_score,recurring_pence,next_action,created_at,updated_at";

function toVenture(r: Row): Venture {
  return {
    id: r.id,
    orgId: r.org_id,
    ref: r.ref,
    title: r.title,
    category: r.category as OppCategory,
    stage: r.stage,
    viabilityScore: r.viability_score,
    recurringPotentialPence: r.recurring_pence,
    nextAction: r.next_action ?? nextActionFor(r.stage, r.category as OppCategory),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getOpportunitiesForOrg(orgId: string): Promise<Venture[]> {
  if (!supabaseWritable) return [];
  try {
    const rows = await sbSelect<Row>({
      query: `opportunities?${COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
      tier: "service",
    });
    return rows.map(toVenture);
  } catch {
    return [];
  }
}

export async function getOpportunityRecord(id: string): Promise<Venture | null> {
  try {
    const rows = await sbSelect<Row>({
      query: `opportunities?${COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
      tier: "service",
    });
    return rows[0] ? toVenture(rows[0]) : null;
  } catch {
    return null;
  }
}

/** Pursue a catalog opportunity: validate it + start tracking from validation. Idempotent on ref. */
export async function pursueOpportunity(orgId: string, opp: RevenueOpportunity): Promise<Venture | null> {
  if (!supabaseWritable) return null;
  try {
    const existing = await sbSelect<Row>({
      query: `opportunities?${COLS}&org_id=eq.${encodeURIComponent(orgId)}&ref=eq.${encodeURIComponent(opp.id)}&limit=1`,
      tier: "service",
    });
    if (existing[0]) return toVenture(existing[0]);

    const viability = scoreViability(opp);
    const row = await sbInsert<Row>("opportunities", {
      org_id: orgId,
      ref: opp.id,
      title: opp.title,
      category: opp.category,
      stage: "validation",
      viability_score: viability,
      recurring_pence: opp.recurringPotentialPence,
      next_action: nextActionFor("validation", opp.category),
    });
    revalidatePath("/admin/empire");
    return toVenture(row);
  } catch {
    return null;
  }
}

/** Advance to the next lifecycle stage (gated: can't leave validation if below threshold). */
export async function advanceOpportunity(id: string): Promise<{ ok: boolean; reason?: string }> {
  const v = await getOpportunityRecord(id);
  if (!v) return { ok: false, reason: "Not found." };
  const idx = OPPORTUNITY_STAGES.indexOf(v.stage);
  if (idx >= OPPORTUNITY_STAGES.length - 1) return { ok: false, reason: "Already live." };
  if (v.stage === "validation" && v.viabilityScore < VIABILITY_THRESHOLD) {
    return { ok: false, reason: `Viability ${v.viabilityScore} is below the ${VIABILITY_THRESHOLD} threshold — park it.` };
  }
  const next = OPPORTUNITY_STAGES[idx + 1];
  await setOpportunityStage(id, next, v.category);
  return { ok: true };
}

export async function setOpportunityStage(id: string, stage: OpportunityStage, category: OppCategory): Promise<void> {
  try {
    await sbUpdate("opportunities", `id=eq.${encodeURIComponent(id)}`, {
      stage,
      next_action: nextActionFor(stage, category),
    });
    revalidatePath("/admin/empire");
  } catch {
    /* best-effort */
  }
}
