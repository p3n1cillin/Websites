/**
 * Autonomous cold outreach runner for Map Pack Kit.
 *
 * Scans all trade prospects in Supabase, drafts personalized outreach offering
 * the free Google Profile Description tool and pitching the £29 Map Pack Kit.
 *
 * Usage:
 *   # Dry-run (prints message drafts and stats, sends nothing):
 *   node --import tsx scripts/launch-outreach.ts
 *
 *   # Live dispatch (sends via Resend when configured):
 *   node --import tsx scripts/launch-outreach.ts --send
 */
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {
  /* ambient env */
}

async function main() {
  const isSend = process.argv.includes("--send");
  const { sbSelect, sbInsert, sbUpdate } = await import("../lib/supabase/client");
  const { findTradeForCategory } = await import("../lib/kit/seo-trades");
  const { SITE_URL } = await import("../lib/seo");
  const { emailConfigured, sendTransactionalEmail } = await import("../lib/email");

  console.log("=== MAP PACK KIT OUTREACH ENGINE ===");
  console.log(`Mode: ${isSend ? "LIVE SEND" : "DRY RUN / PREVIEW"}`);
  console.log(`Resend Email Configured: ${emailConfigured ? "YES" : "NO"}`);
  console.log(`Site URL: ${SITE_URL}\n`);

  const orgs = await sbSelect<{ id: string; name: string }>({
    query: "orgs?select=id,name&order=created_at.asc&limit=1",
    tier: "service",
  });

  if (orgs.length === 0) {
    console.log("No organization found in database. Exiting.");
    return;
  }

  const org = orgs[0];
  console.log(`Organization: ${org.name} (${org.id})`);

  const prospects = await sbSelect<any>({
    query: `prospects?org_id=eq.${org.id}&order=opportunity_score.desc`,
    tier: "service",
  });

  console.log(`Total prospects in CRM: ${prospects.length}`);

  let targets = 0;
  let sent = 0;
  let skippedNoEmail = 0;

  for (const p of prospects) {
    const tradeDef = findTradeForCategory(p.category) || findTradeForCategory(p.source?.industry);
    const tradeName = tradeDef ? tradeDef.singular : p.category;
    const tradeSlug = tradeDef ? tradeDef.slug : "plumbers";
    const town = p.city?.trim() || "your area";

    if (!p.email) {
      skippedNoEmail++;
      continue;
    }

    targets++;

    const subject = `Quick Google Maps question for ${p.name}`;
    const body = [
      `Hi ${p.name} team,`,
      ``,
      `I was looking at Google Maps searches for ${tradeName}s in ${town} and noticed your Google Business Profile is missing a few key search terms and regular post updates.`,
      ``,
      `We created a 100% free tool that writes an optimised 750-character Google description for local ${tradeName}s in 60 seconds:`,
      `${SITE_URL}/free-tools/google-business-description`,
      ``,
      `Or if you'd rather have the whole year planned out with 52 weekly posts and review responses ready to copy-paste, take a look at our complete Map Pack Kit:`,
      `${SITE_URL}/map-pack-kit/${tradeSlug}`,
      ``,
      `No catch — hope the free tool helps your rankings in ${town}!`,
      ``,
      `Best regards,`,
      `Empire Agencies`,
    ].join("\n");

    if (!isSend) {
      console.log(`\n--- [DRAFT #${targets}] To: ${p.name} <${p.email}> (${tradeName} in ${town}) ---`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${body.slice(0, 180)}...\n`);
    } else {
      if (emailConfigured) {
        try {
          await sendTransactionalEmail({
            to: p.email,
            subject,
            text: body,
          });
          sent++;
          await sbUpdate("prospects", p.id, { status: "contacted" });
          console.log(`✓ Sent to ${p.name} <${p.email}>`);
        } catch (err) {
          console.error(`✗ Failed to send to ${p.email}:`, err);
        }
      } else {
        console.log(`[SIMULATED SEND] ${p.name} <${p.email}> (Resend API key required for live dispatch)`);
        sent++;
      }
    }
  }

  console.log("\n=== OUTREACH SUMMARY ===");
  console.log(`Total Targets with Email: ${targets}`);
  console.log(`Skipped (No Email): ${skippedNoEmail}`);
  console.log(`Dispatched: ${sent}`);
  if (!isSend) {
    console.log(`\nTo send these emails live, run:\n  node --import tsx scripts/launch-outreach.ts --send`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
