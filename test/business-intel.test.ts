import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBusinessIntelligence } from "@/lib/business-intel";
import { makeProspect } from "./_fixtures";

test("no website → weak sub-scores + a high-severity revenue leak + loss range", () => {
  const bi = buildBusinessIntelligence(makeProspect({ websiteUrl: null }));
  assert.ok(bi.scores.seo <= 15);
  assert.ok(bi.scores.conversion <= 15);
  assert.ok(bi.revenueLeaks.length > 0);
  assert.equal(bi.revenueLeaks[0].severity, "high");
  assert.ok(bi.revenueLossRange.highPence > 0);
  assert.ok(bi.estMonthlyLeadLoss > 0);
});

test("competitor gap appears when same category+city peers exist", () => {
  const subject = makeProspect({ id: "s", city: "Warrington", category: "plumber", presenceScore: 20 });
  const peers = [
    makeProspect({ id: "x", city: "Warrington", category: "plumber", presenceScore: 80 }),
    makeProspect({ id: "y", city: "Warrington", category: "plumber", presenceScore: 75 }),
  ];
  const bi = buildBusinessIntelligence(subject, peers);
  assert.notEqual(bi.competitorGap, null);
  assert.equal(bi.competitorGap!.peers, 2);
});

test("money figures are modelled, never claimed measured (assumptions stated)", () => {
  const bi = buildBusinessIntelligence(makeProspect());
  assert.ok(bi.assumptions.length > 0);
});
