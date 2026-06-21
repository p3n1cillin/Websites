import { getProspectsForOrg, updateProspectContact } from "./prospects";
import { enrichContact } from "./audit";
import { findWebsite } from "./web-search";
import type { ProspectSource } from "./types";

/**
 * Bulk contact enrichment — backfills email/phone (+ profile) for prospects that are
 * missing them, by scraping their own website (homepage + contact pages, JSON-LD →
 * microdata → mailto/tel → text). Independent of pipeline stage, so it reaches
 * prospects whose demos were built before scraping existed. Bounded per run (each
 * target is up to a few external fetches). Never fabricates — only saves real data.
 */
export interface EnrichResult {
  scanned: number;
  emailsFound: number;
  phonesFound: number;
  /** Websites discovered via search for prospects that had none on file. */
  websitesFound: number;
  /** Still no website even after a search — only reachable by phone/manual. */
  noWebsite: number;
}

export async function enrichOrgContacts(
  orgId: string,
  max = 12,
  discoverMax = 6,
  budgetMs = 8_000
): Promise<EnrichResult> {
  let prospects = await getProspectsForOrg(orgId); // opportunity desc
  // Stay under the serverless function limit (Vercel Hobby ~10s) by default: do as
  // much as the budget allows, then return cleanly. Each prospect is committed as we
  // go, so the action is fully re-runnable. A CLI script can pass a large budget to
  // process the whole list in one go.
  const deadline = Date.now() + budgetMs;

  // --- Phase 0: find a website for prospects that have none (free web search),
  // so the scraper below has something to read. Bounded (search is heavier). ----
  let websitesFound = 0;
  const websiteless = prospects.filter(
    (p) => p.status !== "won" && p.status !== "lost" && !p.websiteUrl?.trim()
  ).slice(0, discoverMax);
  for (const p of websiteless) {
    if (Date.now() > deadline) break;
    try {
      const site = await findWebsite(p.name, p.city);
      if (site) {
        await updateProspectContact(p.id, { websiteUrl: site });
        websitesFound += 1;
      }
    } catch {
      /* best-effort */
    }
  }
  if (websitesFound > 0) prospects = await getProspectsForOrg(orgId); // refresh with new sites

  const needsContact = prospects.filter(
    (p) => p.status !== "won" && p.status !== "lost" && (!p.email?.trim() || !p.phone?.trim())
  );
  const noWebsite = needsContact.filter((p) => !p.websiteUrl?.trim()).length;
  const targets = needsContact.filter((p) => p.websiteUrl?.trim()).slice(0, max);

  let emailsFound = 0;
  let phonesFound = 0;
  for (const p of targets) {
    if (Date.now() > deadline) break;
    try {
      const e = await enrichContact(p.websiteUrl!);
      const patch: { email?: string; phone?: string; source?: ProspectSource } = {};
      if (!p.email?.trim() && e.email) {
        patch.email = e.email;
        emailsFound += 1;
      }
      if (!p.phone?.trim() && e.phone) {
        patch.phone = e.phone;
        phonesFound += 1;
      }
      if (e.established || e.address) {
        patch.source = {
          ...(p.source ?? { origin: "discovery" as const }),
          profile: {
            ...(p.source?.profile ?? {}),
            ...(e.established ? { established: e.established } : {}),
            ...(e.address ? { address: e.address } : {}),
          },
        };
      }
      if (Object.keys(patch).length > 0) await updateProspectContact(p.id, patch);
    } catch {
      /* one prospect failing must not stop the batch */
    }
  }
  return { scanned: targets.length, emailsFound, phonesFound, websitesFound, noWebsite };
}
