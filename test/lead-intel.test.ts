import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLeadIntelReport } from "@/lib/lead-intel";
import { makeProspect, makeAudit } from "./_fixtures";

test("no website → low capture, real missed-revenue estimate", () => {
  const r = buildLeadIntelReport(makeProspect({ websiteUrl: null }));
  assert.equal(r.currentSite.hasSite, false);
  assert.ok(r.roi.capturedPct <= 15);
  assert.ok(r.roi.estMissedValuePence > 0);
  assert.ok(/no website/i.test(r.headline));
});

test("a decent audited site captures more than no site", () => {
  const noSite = buildLeadIntelReport(makeProspect({ websiteUrl: null }));
  const good = buildLeadIntelReport(
    makeProspect({
      websiteUrl: "https://good.co.uk",
      analysis: { ai: false, at: "", summary: "", angle: "", audit: makeAudit({ overall: 85 }) } as never,
    })
  );
  assert.ok(good.roi.capturedPct > noSite.roi.capturedPct);
});

test("ROI is an explicit model with stated assumptions", () => {
  const r = buildLeadIntelReport(makeProspect());
  assert.ok(r.roi.assumptions.length > 0);
  assert.equal(r.ai, false);
});
