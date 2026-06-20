import type { WebsiteAudit } from "./types";

/**
 * Before/After demonstration (Agent 5's closer — "show, don't tell").
 *
 * Turns a prospect's real website audit (their CURRENT site) plus the generated
 * demo's QA score (their NEW site) into a plain-English side-by-side a business
 * owner instantly gets: two scores and a checklist of the wins. Pure + dependency-
 * free. It only asserts a "before" gap where the audit actually measured one, so
 * it never overclaims about their existing site.
 */

export interface ComparisonItem {
  area: "Mobile" | "Security" | "SEO" | "Conversion" | "Speed";
  label: string;
  /** Does their CURRENT site have this? */
  before: boolean;
  /** Does the NEW site have this? (true by construction of our generated sites.) */
  after: boolean;
}

export interface SiteComparison {
  hasCurrentSite: boolean;
  currentReachable: boolean;
  /** 0–100 quality of their current site (0 when none / offline). */
  beforeScore: number;
  /** 0–100 QA score of the generated demo. */
  afterScore: number;
  items: ComparisonItem[];
  /** Count of things the new site adds that the current one lacks. */
  wins: number;
}

/**
 * Build the comparison. `afterScore` is the demo's QA overall. Our generated sites
 * are mobile-first, HTTPS-served, SEO-complete (meta + JSON-LD), with clear CTAs
 * and tap-to-call — so `after` is true for each checked item; `before` comes from
 * the audit signals (all false when there's no site, or it didn't load).
 */
export function buildSiteComparison(
  audit: WebsiteAudit | null,
  afterScore: number
): SiteComparison {
  const reachable = audit?.reachable ?? false;
  const s = audit?.signals;
  const had = (v: boolean | undefined) => Boolean(reachable && v);

  const items: ComparisonItem[] = [
    { area: "Mobile", label: "Looks great on phones", before: had(s?.hasViewport), after: true },
    { area: "Security", label: "Secure padlock (HTTPS)", before: had(audit?.https), after: true },
    {
      area: "SEO",
      label: "Built to be found on Google",
      before: had(s?.hasMetaDescription && s?.hasStructuredData),
      after: true,
    },
    { area: "Conversion", label: "Clear “get in touch” buttons", before: had(s?.hasCtaSignal), after: true },
    { area: "Conversion", label: "Tap-to-call on mobile", before: had(s?.hasPhoneLink), after: true },
    { area: "Speed", label: "Fast, modern build", before: had(s ? s.htmlBytes < 1_500_000 : false), after: true },
  ];

  return {
    hasCurrentSite: audit !== null,
    currentReachable: reachable,
    beforeScore: reachable ? (audit?.overall ?? 0) : 0,
    afterScore: Math.round(afterScore),
    items,
    wins: items.filter((i) => !i.before && i.after).length,
  };
}
