import type { BusinessCategory, LeadIntelReport, Prospect, WebsiteAudit } from "./types";

/**
 * Lead Intelligence Report builder (Agency OS — acquisition, Phase 2).
 *
 * Pure + deterministic + dependency-free (runs in the build, the admin client and
 * agents with no AI key). It turns what we already know about a prospect — the
 * website audit, the opportunity scores, and per-category economics — into a
 * concrete pitch: current-site problems, SEO/conversion weaknesses, the upgrade
 * opportunities, and a clearly-modelled ROI estimate.
 *
 * DATA INTEGRITY: every £ figure here is an explicit MODEL with stated assumptions
 * (see `roi.assumptions`) — it is never presented as a measured fact. Findings about
 * their current site come straight from the real audit, not invention.
 */

/** Per-category economics for the ROI model: typical monthly web enquiries + avg job value (pence). */
const ECONOMICS: Record<BusinessCategory, { leads: number; jobValuePence: number }> = {
  dentist: { leads: 30, jobValuePence: 25_000 },
  roofer: { leads: 18, jobValuePence: 250_000 },
  plumber: { leads: 35, jobValuePence: 18_000 },
  electrician: { leads: 30, jobValuePence: 20_000 },
  mechanic: { leads: 40, jobValuePence: 22_000 },
  landscaper: { leads: 20, jobValuePence: 120_000 },
  "beauty-salon": { leads: 45, jobValuePence: 6_000 },
  restaurant: { leads: 60, jobValuePence: 4_500 },
  cleaner: { leads: 30, jobValuePence: 8_000 },
  barber: { leads: 50, jobValuePence: 2_500 },
  retail: { leads: 40, jobValuePence: 4_000 },
  other: { leads: 25, jobValuePence: 9_000 },
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Plain-language SEO weaknesses from the homepage audit signals. */
function seoWeaknessesFrom(audit: WebsiteAudit): string[] {
  const s = audit.signals;
  const out: string[] = [];
  if (!s.hasTitle || s.titleLength < 15) out.push("Weak or missing page title — hurts Google rankings for local searches.");
  if (!s.hasMetaDescription) out.push("No meta description, so search results show no compelling summary.");
  if (!s.hasH1) out.push("No clear H1 heading — search engines can't tell what the page is about.");
  if (!s.hasStructuredData) out.push("No LocalBusiness structured data, so no rich results (stars, hours, map).");
  if (!s.hasOpenGraph) out.push("No social-share preview — links posted to Facebook/WhatsApp look bare.");
  if (s.wordCount < 250) out.push("Very thin content — too little for Google to rank on service keywords.");
  return out;
}

/** Plain-language conversion problems from the audit signals. */
function conversionIssuesFrom(audit: WebsiteAudit): string[] {
  const s = audit.signals;
  const out: string[] = [];
  if (!s.hasViewport) out.push("Not mobile-friendly — most local searches are on phones.");
  if (!s.hasPhoneLink) out.push("No tap-to-call link, so mobile visitors can't call in one tap.");
  if (!s.hasCtaSignal) out.push("No clear call-to-action (book/quote/contact) above the fold.");
  if (!audit.https) out.push("No HTTPS padlock — browsers warn visitors the site is 'not secure'.");
  if (s.builder) out.push(`Built on ${s.builder} — slow, templated and hard to rank.`);
  if (s.imageCount > 0 && s.imagesWithoutAlt / s.imageCount > 0.5) out.push("Most images lack alt text (accessibility + SEO miss).");
  return out;
}

/** Build a prospect-facing lead-intel report from what we already know. Deterministic. */
export function buildLeadIntelReport(prospect: Prospect): LeadIntelReport {
  const audit = prospect.analysis?.audit ?? null;
  const hasSite = Boolean(prospect.websiteUrl?.trim());
  const reachable = audit?.reachable ?? false;
  const econ = ECONOMICS[prospect.category] ?? ECONOMICS.other;

  // How much of the potential they likely capture today.
  //  • no website at all              → ~10%
  //  • site that didn't load          → ~15%
  //  • audited site                   → scales with the audit score
  let capturedPct: number;
  if (!hasSite) capturedPct = 10;
  else if (audit && !reachable) capturedPct = 15;
  else if (audit) capturedPct = clamp(15 + audit.overall * 0.6);
  else capturedPct = 40; // has a site but not audited yet — neutral assumption

  const estMonthlyValuePence = econ.leads * econ.jobValuePence;
  const estMissedValuePence = Math.round(estMonthlyValuePence * (1 - capturedPct / 100));

  const problems: string[] = [];
  if (!hasSite) {
    problems.push("No website found — invisible to customers searching online.");
  } else if (audit && !reachable) {
    problems.push("Their website didn't load when we checked — likely down or broken.");
  } else if (audit) {
    problems.push(...audit.issues.slice(0, 5));
  } else {
    problems.push("Website not yet analysed — run Analyse to audit their current site.");
  }

  const seoWeaknesses = audit && reachable ? seoWeaknessesFrom(audit) : [];
  const conversionIssues = audit && reachable ? conversionIssuesFrom(audit) : [];

  const opportunities: string[] = [];
  const talkingPointsExtra: string[] = [];
  if (!hasSite || !reachable) {
    opportunities.push("A fast, mobile-first site that ranks for local searches from day one.");
    opportunities.push("Tap-to-call and an enquiry form so visitors convert instead of bouncing.");
  } else {
    if (seoWeaknesses.length) opportunities.push("Fix the SEO basics above to climb local search results.");
    if (conversionIssues.length) opportunities.push("Add clear calls-to-action and tap-to-call to convert more visitors.");
    if (audit && (!audit.signals.socials || audit.signals.socials.length === 0)) {
      opportunities.push("No social profiles linked — connect Facebook/Instagram to widen local reach.");
    }
    const rep = audit?.reputation;
    if (rep && rep.platforms.length > 0 && !rep.onPageRating && rep.testimonialCount === 0) {
      opportunities.push(
        `Surface your ${rep.platforms.join("/")} reviews on the site — visible ratings lift conversions.`
      );
    } else if (rep && rep.platforms.length === 0 && rep.testimonialCount === 0 && !rep.onPageRating) {
      opportunities.push("Add real customer reviews — even 3–4 visible testimonials build trust fast.");
    }
  }
  opportunities.push("LocalBusiness structured data for star ratings, hours and a map in Google.");
  opportunities.push("Genuine, on-brand copy and imagery that reflects the business.");

  // Profile enrichment talking points (tech stack + social presence).
  if (audit?.signals.builder) {
    talkingPointsExtra.push(`Their site runs on ${audit.signals.builder} — templated and hard to stand out.`);
  }
  if (audit?.signals.socials?.length) {
    talkingPointsExtra.push(`Active on ${audit.signals.socials.join(", ")} — a new site ties that together.`);
  }
  const rep = audit?.reputation;
  if (rep?.onPageRating?.value) {
    talkingPointsExtra.push(
      `They already advertise ${rep.onPageRating.value}/5${
        rep.onPageRating.count ? ` from ${rep.onPageRating.count} reviews` : ""
      } — we can make that the centrepiece of the new site.`
    );
  } else if (rep?.platforms.length) {
    talkingPointsExtra.push(`Has reviews on ${rep.platforms.join(", ")} that the current site doesn't show.`);
  }

  const searchTerm = prospect.source?.industry?.trim() || prospect.category.replace("-", " ");
  const headline = !hasSite
    ? `${prospect.name} has no website — they're invisible for "${searchTerm}" searches in ${prospect.city || "their area"}.`
    : audit && !reachable
      ? `${prospect.name}'s website isn't loading — they're losing every online enquiry right now.`
      : audit
        ? `${prospect.name}'s site scores ${audit.overall}/100 — concrete, fixable gaps are costing them enquiries.`
        : `${prospect.name} looks like a strong opportunity — analyse their site to quantify it.`;

  const talkingPoints: string[] = [
    !hasSite
      ? "They have no web presence — competitors with a decent site take those customers."
      : `Their current site has clear, demonstrable problems (we can show a before/after).`,
    `A business of this type can realistically see ~${econ.leads} web enquiries a month locally.`,
    `On current form they're likely capturing only ~${capturedPct}% of that.`,
    ...talkingPointsExtra,
  ];

  return {
    prospectId: prospect.id,
    headline,
    currentSite: {
      hasSite,
      reachable,
      score: audit ? audit.overall : null,
      problems,
    },
    seoWeaknesses,
    conversionIssues,
    opportunities: opportunities.slice(0, 5),
    roi: {
      estMonthlyLeads: econ.leads,
      capturedPct,
      estMonthlyValuePence,
      estMissedValuePence,
      assumptions: [
        `Assumes ~${econ.leads} potential web enquiries/month and an average job value of £${Math.round(
          econ.jobValuePence / 100
        )} for a ${prospect.category} (industry estimate, not measured).`,
        `Capture rate (~${capturedPct}%) is modelled from their current web presence${
          audit ? ` (site score ${audit.overall}/100)` : ""
        }.`,
      ],
    },
    talkingPoints,
    ai: false,
    at: new Date().toISOString(),
  };
}
