import type { Business, BusinessCategory } from "./types";
import { ECONOMICS } from "./lead-intel";

/**
 * Retention Engine (MASTER_OS — "identify opportunities for SEO, CRO, automation,
 * content, additional services… the goal is recurring revenue and long-term client
 * value").
 *
 * Deterministic + dependency-free (Cost Control: code before AI — zero tokens). For
 * a LIVE client site it proposes the next growth services to sell, each conditioned
 * on what the built site actually has/lacks, with a modelled monthly uplift and a
 * suggested add-on retainer. Drives expansion revenue on top of the base retainer.
 *
 * Every £ is an explicit MODEL (see each rec's `note`), never a measured fact.
 */

export type GrowthService =
  | "seo_content"
  | "cro_testing"
  | "reviews"
  | "local_seo"
  | "lead_automation"
  | "gbp_optimisation";

export interface RetentionRec {
  service: GrowthService;
  title: string;
  rationale: string;
  /** Suggested monthly add-on retainer, pence. */
  addonPence: number;
  /** Modelled extra revenue/mo this could unlock for the client, pence. */
  estUpliftPence: number;
  priority: "high" | "medium" | "low";
}

export interface RetentionPlan {
  businessId: string;
  recs: RetentionRec[];
  /** Sum of suggested add-on retainers, pence (the expansion-revenue opportunity). */
  totalAddonPence: number;
  note: string;
}

/** A modest fraction of the category's monthly web potential, as an uplift anchor. */
function monthlyPotentialPence(category: BusinessCategory): number {
  const econ = ECONOMICS[category] ?? ECONOMICS.other;
  return econ.leads * econ.jobValuePence;
}

/**
 * Build a retention/upsell plan for a live client site. `hasExperiment` / `hasBlog`
 * let the caller fold in real growth-system state when known (defaults: none).
 */
export function buildRetentionPlan(
  business: Business,
  opts: { businessId: string; hasExperiment?: boolean; hasBlog?: boolean } = { businessId: "" }
): RetentionPlan {
  const pot = monthlyPotentialPence(business.category);
  const recs: RetentionRec[] = [];

  // SEO content — recurring content keeps rankings climbing. High if no blog yet.
  recs.push({
    service: "seo_content",
    title: "Monthly SEO content plan",
    rationale: opts.hasBlog
      ? "Keep publishing local service articles to hold and grow rankings."
      : "No ongoing content yet — monthly local articles compound local rankings.",
    addonPence: 14_900,
    estUpliftPence: Math.round(pot * 0.12),
    priority: opts.hasBlog ? "medium" : "high",
  });

  // CRO — conversion testing. High if no live experiment.
  recs.push({
    service: "cro_testing",
    title: "Conversion optimisation (A/B testing)",
    rationale: opts.hasExperiment
      ? "Keep testing headlines, CTAs and layout to lift conversion rate."
      : "No A/B test running — testing the hero + CTA typically lifts enquiries.",
    addonPence: 9_900,
    estUpliftPence: Math.round(pot * 0.08),
    priority: opts.hasExperiment ? "low" : "high",
  });

  // Reviews — trust drives conversion. High when the site shows few/no reviews.
  const reviewCount = business.testimonials?.length ?? 0;
  if (reviewCount < 3) {
    recs.push({
      service: "reviews",
      title: "Review generation campaign",
      rationale: `Only ${reviewCount} review${reviewCount === 1 ? "" : "s"} on site — automated review requests build trust fast.`,
      addonPence: 7_900,
      estUpliftPence: Math.round(pot * 0.07),
      priority: "high",
    });
  }

  // Local SEO expansion — capture nearby towns. High when serving few areas.
  const areaCount = business.serviceAreas?.length ?? 0;
  recs.push({
    service: "local_seo",
    title: "Local SEO expansion to nearby towns",
    rationale:
      areaCount > 3
        ? "Add location pages for more nearby towns to widen the catchment."
        : "Targeting few areas — location pages for nearby towns widen the catchment.",
    addonPence: 11_900,
    estUpliftPence: Math.round(pot * 0.1),
    priority: areaCount > 3 ? "low" : "medium",
  });

  // Lead automation — never miss an enquiry. Recurring value.
  recs.push({
    service: "lead_automation",
    title: "Automated lead follow-up",
    rationale: "Instant reply + follow-up sequences so no enquiry goes cold.",
    addonPence: 6_900,
    estUpliftPence: Math.round(pot * 0.06),
    priority: "medium",
  });

  // Google Business Profile — the local-pack workhorse.
  recs.push({
    service: "gbp_optimisation",
    title: "Google Business Profile management",
    rationale: "Ongoing posts, photos and Q&A to win the Google local pack.",
    addonPence: 5_900,
    estUpliftPence: Math.round(pot * 0.06),
    priority: "medium",
  });

  const rank = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => rank[a.priority] - rank[b.priority] || b.estUpliftPence - a.estUpliftPence);

  return {
    businessId: opts.businessId,
    recs,
    totalAddonPence: recs.reduce((s, r) => s + r.addonPence, 0),
    note: "Add-on prices are suggested retainers; uplift figures are modelled estimates from category economics, not measured.",
  };
}
