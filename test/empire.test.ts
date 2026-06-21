import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEmpirePortfolio } from "@/lib/empire";
import { makeRetainer, makeCluster } from "./_fixtures";

test("MRR = sum of ACTIVE retainers only; portfolio value = 24x MRR", () => {
  const p = buildEmpirePortfolio({
    clusters: [makeCluster()],
    retainers: [
      makeRetainer({ id: "a", monthlyPence: 3900, status: "active" }),
      makeRetainer({ id: "b", monthlyPence: 3900, status: "active" }),
      makeRetainer({ id: "c", monthlyPence: 9900, status: "cancelled" }),
    ],
    liveSites: 2,
    prospectCount: 10,
    orgName: "Empire Agencies",
  });
  assert.equal(p.totalMrrPence, 7800); // cancelled excluded
  assert.equal(p.assetValuePence, 7800 * 24);
});

test("always owns the agency + platform assets", () => {
  const p = buildEmpirePortfolio({
    clusters: [],
    retainers: [],
    liveSites: 0,
    prospectCount: 0,
    orgName: "Empire Agencies",
  });
  const types = p.assets.map((a) => a.type);
  assert.ok(types.includes("agency"));
  assert.ok(types.includes("saas"));
});

test("opportunities are ranked by empire score (desc) and non-empty", () => {
  const p = buildEmpirePortfolio({
    clusters: [makeCluster()],
    retainers: [makeRetainer()],
    liveSites: 1,
    prospectCount: 8,
    orgName: "Empire Agencies",
  });
  assert.ok(p.opportunities.length > 0);
  for (let i = 1; i < p.opportunities.length; i++) {
    assert.ok(p.opportunities[i - 1].empireScore >= p.opportunities[i].empireScore);
  }
  // Every opportunity carries both scores in range.
  for (const o of p.opportunities) {
    assert.ok(o.empireScore >= 0 && o.empireScore <= 100);
    assert.ok(o.opportunityScore >= 0 && o.opportunityScore <= 100);
  }
});
