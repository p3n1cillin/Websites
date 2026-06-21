import { getProspectsForOrg, updateProspectContact } from "./prospects";
import { enrichContact } from "./audit";
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
  /** Missing contact but no website to scrape — unreachable by this method. */
  noWebsite: number;
}

export async function enrichOrgContacts(orgId: string, max = 12): Promise<EnrichResult> {
  const prospects = await getProspectsForOrg(orgId); // opportunity desc
  const needsContact = prospects.filter(
    (p) => p.status !== "won" && p.status !== "lost" && (!p.email?.trim() || !p.phone?.trim())
  );
  const noWebsite = needsContact.filter((p) => !p.websiteUrl?.trim()).length;
  const targets = needsContact.filter((p) => p.websiteUrl?.trim()).slice(0, max);

  let emailsFound = 0;
  let phonesFound = 0;
  for (const p of targets) {
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
  return { scanned: targets.length, emailsFound, phonesFound, noWebsite };
}
