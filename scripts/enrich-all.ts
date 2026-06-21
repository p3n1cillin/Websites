/**
 * One-off: run the FULL contact enrichment over every prospect in the org, against
 * the live Supabase (service role from .env.local). No serverless time limit, so it
 * works the whole list in one pass (web-search for missing sites, then scrape
 * email/phone/profile). Re-runnable + idempotent; only saves real data.
 *
 *   node --import tsx scripts/enrich-all.ts
 */
import { readFileSync } from "node:fs";

async function main() {
  // Load .env.local into process.env BEFORE importing libs (the supabase client
  // reads env at import time).
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env.local — rely on ambient env */
  }

  const { sbSelect } = await import("../lib/supabase/client");
  const { enrichOrgContacts } = await import("../lib/contact-enrichment");

  const orgs = await sbSelect<{ id: string; name: string }>({
    query: "orgs?select=id,name&order=created_at.asc",
    tier: "service",
  });
  if (orgs.length === 0) {
    console.error("No orgs found.");
    process.exit(1);
  }

  for (const org of orgs) {
    console.log(`\nEnriching contacts for org: ${org.name} (${org.id})`);
    const res = await enrichOrgContacts(org.id, 500, 500, 9_000_000);
    console.log(
      `  websites found: ${res.websitesFound} · scanned: ${res.scanned} · emails: ${res.emailsFound} · phones: ${res.phonesFound} · still no web: ${res.noWebsite}`
    );
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
