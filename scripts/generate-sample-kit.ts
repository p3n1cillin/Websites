/**
 * Generates the public SAMPLE Map Pack Kit (lib/kit/sample-kit.json) through the
 * exact production pipeline — real proof of output quality for the sales page.
 *
 *   node --import tsx scripts/generate-sample-kit.ts
 *
 * Loads .env.local itself (needs ANTHROPIC_API_KEY). Costs a few pence.
 */
import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync(path.resolve(".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.trim();
}

async function main() {
  const { generateSection } = await import("../lib/kit/content");
  const { TIERS } = await import("../lib/kit/catalog");
  const input = {
    businessName: "Hartley Plumbing & Heating",
    trade: "Plumber and heating engineer",
    town: "Warrington",
    areas: "Lymm, Stockton Heath, Great Sankey, Birchwood, Culcheth",
    services: "Boiler servicing, boiler repairs, new boiler installation, leak repairs, bathroom installation, radiator installation, power flushing",
    usp: "Family-run, no call-out charge, fixed written quote before any work starts, tidy and respectful in your home",
    phone: "",
    website: "",
    reviewLink: "",
    tone: "friendly" as const,
  };
  const orderDate = new Date();
  const sections: Record<string, unknown> = {};
  let cost = 0;
  const ids = TIERS.complete.sections;
  await Promise.all(
    ids.map(async (id) => {
      const t0 = Date.now();
      const { content, usage } = await generateSection(id, input, orderDate);
      cost += usage.costPence;
      sections[id] = { id, generatedAt: new Date().toISOString(), model: usage.model, costPence: usage.costPence, regens: 0, content };
      console.log(`${id}: ${((Date.now() - t0) / 1000).toFixed(1)}s, ${usage.outputTokens} out tok, ${usage.costPence}p`);
    })
  );
  const out = { input, tier: "complete", orderDate: orderDate.toISOString(), sections };
  fs.writeFileSync(path.resolve("lib/kit/sample-kit.json"), JSON.stringify(out, null, 2));
  console.log(`Done. Total ~${cost}p`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
