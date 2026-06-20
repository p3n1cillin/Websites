import type {
  BusinessIntelligence,
  Prospect,
  RevenueLeak,
  WebsiteAudit,
} from "./types";
import { ECONOMICS } from "./lead-intel";

/**
 * Business Intelligence Engine (Agency OS — §4). Turns the website audit + scores +
 * category economics into a STRUCTURED, money-linked weakness profile: SEO/UX/
 * conversion sub-scores, ranked revenue leaks (each with a £/mo impact), a
 * competitor-gap read against nearby same-industry prospects, and a loss range.
 *
 * Pure + deterministic + dependency-free (spec §9: prefer deterministic code over AI
 * reasoning — zero tokens). Every £ figure is an explicit MODEL with stated
 * assumptions, never a measured fact (data-integrity rule).
 */

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** SEO sub-score from audit signals (100 = no SEO gaps found). */
function seoScore(a: WebsiteAudit): number {
  const s = a.signals;
  let score = 100;
  if (!s.hasTitle || s.titleLength < 15) score -= 22;
  if (!s.hasMetaDescription) score -= 16;
  if (!s.hasH1) score -= 14;
  if (!s.hasStructuredData) score -= 16;
  if (!s.hasOpenGraph) score -= 8;
  if (s.wordCount < 250) score -= 16;
  if (s.imageCount > 0 && s.imagesWithoutAlt / s.imageCount > 0.5) score -= 8;
  return clamp(score);
}

/** UX/tech sub-score from audit signals. */
function uxScore(a: WebsiteAudit): number {
  const s = a.signals;
  let score = 100;
  if (!s.hasViewport) score -= 30;
  if (!a.https) score -= 18;
  if (s.builder && /wix|weebly|godaddy/i.test(s.builder)) score -= 14;
  if (s.htmlBytes > 1_500_000) score -= 12;
  if (!s.hasFavicon) score -= 6;
  if (s.imageCount === 0) score -= 8;
  return clamp(score);
}

/** Conversion sub-score from audit signals. */
function conversionScore(a: WebsiteAudit): number {
  const s = a.signals;
  const rep = a.reputation;
  let score = 100;
  if (!s.hasCtaSignal) score -= 28;
  if (!s.hasPhoneLink) score -= 22;
  if (!a.https) score -= 8;
  // Trust signals: reviews exist off-site but aren't surfaced, or none at all.
  if (rep && rep.platforms.length > 0 && !rep.onPageRating && rep.testimonialCount === 0) score -= 14;
  else if (rep && rep.platforms.length === 0 && rep.testimonialCount === 0 && !rep.onPageRating) score -= 18;
  return clamp(score);
}

/** Best available "web strength" for a prospect: audit score, else presence score. */
function webStrength(p: Prospect): number {
  const a = p.analysis?.audit;
  if (a && a.reachable) return a.overall;
  if (p.websiteUrl?.trim()) return p.presenceScore;
  return Math.min(p.presenceScore, 15); // no site → weak by definition
}

/**
 * Build the structured intelligence profile. `peers` are the org's other prospects;
 * the competitor-gap read uses those in the same category + city.
 */
export function buildBusinessIntelligence(
  prospect: Prospect,
  peers: Prospect[] = []
): BusinessIntelligence {
  const audit = prospect.analysis?.audit ?? null;
  const reachable = audit?.reachable ?? false;
  const hasSite = Boolean(prospect.websiteUrl?.trim());
  const econ = ECONOMICS[prospect.category] ?? ECONOMICS.other;

  // Sub-scores. With a live audit they're signal-driven; without one we fall back to
  // the presence score (no site → uniformly weak, the strongest opportunity signal).
  const scores =
    audit && reachable
      ? {
          presence: prospect.presenceScore,
          seo: seoScore(audit),
          ux: uxScore(audit),
          conversion: conversionScore(audit),
        }
      : {
          presence: prospect.presenceScore,
          seo: hasSite ? clamp(prospect.presenceScore * 0.6) : 5,
          ux: hasSite ? clamp(prospect.presenceScore * 0.7) : 8,
          conversion: hasSite ? clamp(prospect.presenceScore * 0.5) : 5,
        };

  // Revenue leaks: each missing element costs a modelled share of monthly potential.
  const monthlyPotentialPence = econ.leads * econ.jobValuePence;
  const leaks: RevenueLeak[] = [];
  const add = (label: string, pct: number, severity: RevenueLeak["severity"]) =>
    leaks.push({ label, impactPence: Math.round(monthlyPotentialPence * pct), severity });

  if (!hasSite) {
    add("No website — invisible to customers searching online", 0.7, "high");
  } else if (audit && !reachable) {
    add("Website doesn't load — every online enquiry is lost right now", 0.6, "high");
  } else if (audit) {
    const s = audit.signals;
    if (!s.hasViewport) add("Not mobile-friendly — most local searches are on phones", 0.25, "high");
    if (!s.hasCtaSignal) add("No clear call-to-action — visitors leave without enquiring", 0.18, "high");
    if (!s.hasPhoneLink) add("No tap-to-call — mobile visitors can't call in one tap", 0.14, "medium");
    if (s.wordCount < 250 || !s.hasStructuredData) add("Weak SEO — not ranking for local service searches", 0.12, "medium");
    if (!audit.https) add("No HTTPS — browsers warn the site is 'not secure'", 0.08, "medium");
    const rep = audit.reputation;
    if (rep && (rep.platforms.length > 0 || rep.testimonialCount === 0))
      add("Reviews not surfaced on-site — hidden trust costs conversions", 0.1, "low");
  } else {
    add("Site not yet analysed — run Analyse to quantify the leaks", 0.5, "medium");
  }
  leaks.sort((a, b) => b.impactPence - a.impactPence);

  // Loss range: a band around the total leak impact (capped at the monthly potential).
  const totalLeakPence = Math.min(monthlyPotentialPence, leaks.reduce((s, l) => s + l.impactPence, 0));
  const revenueLossRange = {
    lowPence: Math.round(totalLeakPence * 0.6),
    highPence: Math.round(Math.min(monthlyPotentialPence, totalLeakPence * 1.15)),
  };
  const estMonthlyLeadLoss = Math.round(
    econ.leads * (totalLeakPence / Math.max(1, monthlyPotentialPence))
  );

  // Competitor gap: same category + city, excluding self.
  const city = prospect.city?.trim().toLowerCase() ?? "";
  const rivals = peers.filter(
    (p) => p.id !== prospect.id && p.category === prospect.category && (p.city?.trim().toLowerCase() ?? "") === city && city !== ""
  );
  let competitorGap: BusinessIntelligence["competitorGap"] = null;
  if (rivals.length > 0) {
    const avgPeerScore = clamp(rivals.reduce((s, p) => s + webStrength(p), 0) / rivals.length);
    const yourScore = clamp(webStrength(prospect));
    const behind = yourScore < avgPeerScore;
    const term = prospect.source?.industry?.trim() || prospect.category.replace("-", " ");
    competitorGap = {
      peers: rivals.length,
      avgPeerScore,
      yourScore,
      behind,
      summary: behind
        ? `${rivals.length} nearby ${term} competitor${rivals.length === 1 ? "" : "s"} average ${avgPeerScore}/100 online vs their ${yourScore}/100 — customers pick the stronger site first.`
        : `Ahead of ${rivals.length} nearby ${term} competitor${rivals.length === 1 ? "" : "s"} (${yourScore}/100 vs ${avgPeerScore}/100) — a sharper site widens the lead.`,
    };
  }

  return {
    prospectId: prospect.id,
    scores,
    revenueLeaks: leaks,
    competitorGap,
    estMonthlyLeadLoss,
    revenueLossRange,
    assumptions: [
      `Modelled on ~${econ.leads} potential web enquiries/month and an average job value of £${Math.round(
        econ.jobValuePence / 100
      )} for a ${prospect.category} (industry estimate, not measured).`,
      "Leak impacts are modelled shares of that potential — directional, not a measured loss.",
    ],
    at: new Date().toISOString(),
  };
}
