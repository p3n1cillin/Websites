import type { Business, CustomerReport, Lead } from "./types";
import { getDesignDNA } from "./design/dna";
import { scoreSite } from "./design/qa";

/**
 * Deterministic customer report (Agency OS — Phase F). Pure + dependency-free so
 * it runs identically in the build, the portal and the Success agent with no AI
 * key: it counts the live site's leads, re-scores it through the QA gate, and
 * derives concrete suggestions. The Success agent (10) wraps this and may add an
 * AI narrative on top — but this baseline is always real, never placeholder.
 */
export function buildCustomerReport(
  businessId: string,
  business: Business,
  leads: Lead[]
): CustomerReport {
  const total = leads.length;
  const won = leads.filter((l) => l.status === "won").length;
  const fresh = leads.filter((l) => l.status === "new").length;

  const dna = getDesignDNA(business);
  const qa = scoreSite(business, dna);

  const suggestions: string[] = [];
  if (fresh > 0) suggestions.push(`${fresh} new enquir${fresh === 1 ? "y" : "ies"} awaiting a reply — respond quickly to win the work.`);
  if (business.testimonials.length < 3) suggestions.push("Add another recent customer review to build trust.");
  if (business.services.length < 4) suggestions.push("List one or two more services to capture extra searches.");
  if (!business.heroImage) suggestions.push("Add a real photo of your work for the homepage hero.");
  if (qa.notes.length && qa.notes[0] !== "No issues found.") suggestions.push(qa.notes[0]);
  if (suggestions.length === 0) suggestions.push("Everything looks healthy — keep the content fresh and reply to enquiries fast.");

  const summary =
    total === 0
      ? `Your ${business.primaryService.toLowerCase()} site is live and looking great. No enquiries yet — sharing it locally and replying fast will get the first ones in.`
      : `Your site has captured ${total} enquir${total === 1 ? "y" : "ies"} so far${won ? `, ${won} of which you've won` : ""}. Site health is ${qa.overall}/100.`;

  return {
    businessId,
    leads: { total, new: fresh, won },
    qaScore: qa.overall,
    qaPass: qa.pass,
    summary,
    suggestions: suggestions.slice(0, 4),
    ai: false,
    at: new Date().toISOString(),
  };
}
