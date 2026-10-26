import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClientRetainer, Prospect, ProspectStatus, SitePreview } from "../lib/types";
import {
  DEFAULT_RETAINER_PENCE,
  DEFAULT_RESPOND_RATE,
  DEFAULT_WIN_RATE,
  GOAL_MRR_PENCE,
  MIN_RATE_SAMPLE,
  buildGoalStatus,
  countFunnel,
  deriveTuning,
  estimateRates,
  projectMrr,
  stageWinProbability,
} from "../lib/goal-engine";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let seq = 0;
function prospect(status: ProspectStatus, overrides: Partial<Prospect> = {}): Prospect {
  seq += 1;
  return {
    id: `p${seq}`,
    orgId: "org1",
    name: `Prospect ${seq}`,
    category: "plumber",
    city: "Warrington",
    presenceScore: 40,
    opportunityScore: 60,
    valueEstimate: 300_000,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function retainer(monthlyPence: number, status: ClientRetainer["status"] = "active"): ClientRetainer {
  seq += 1;
  return {
    id: `r${seq}`,
    orgId: "org1",
    name: `Retainer ${seq}`,
    monthlyPence,
    status,
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function preview(prospectId: string, status: SitePreview["status"] = "active") {
  return { prospectId, status };
}

const NO_PREVIEWS: Pick<SitePreview, "prospectId" | "status">[] = [];
const NO_RETAINERS: ClientRetainer[] = [];

// ---------------------------------------------------------------------------
// countFunnel
// ---------------------------------------------------------------------------

test("countFunnel tallies cumulative stages and excludes lost prospects", () => {
  const prospects = [
    prospect("discovered"),
    prospect("analysed"),
    prospect("contacted"),
    prospect("responded"),
    prospect("negotiating"),
    prospect("lost"), // never counted anywhere
  ];
  const previews = [preview(prospects[3].id), preview(prospects[4].id)];
  const retainers = [retainer(25_000)];
  const counts = countFunnel(prospects, previews, retainers);
  // lost excluded → discovered = 5
  assert.equal(counts.discovered, 5);
  // contacted-or-beyond: contacted + responded + negotiating (lost excluded)
  assert.equal(counts.contacted, 3);
  assert.equal(counts.responded, 2);
  assert.equal(counts.negotiating, 1);
  // demos only for ACTIVE previews
  assert.equal(counts.demosBuilt, 2);
  assert.equal(counts.won, 1);
});

test("countFunnel ignores revoked demos and paused/cancelled retainers", () => {
  const p = prospect("contacted");
  const w = prospect("won");
  const counts = countFunnel(
    [p, w],
    [preview(p.id, "revoked"), preview(w.id, "revoked")],
    [retainer(30_000, "paused"), retainer(20_000, "cancelled")]
  );
  assert.equal(counts.demosBuilt, 0);
  assert.equal(counts.won, 0);
});

// ---------------------------------------------------------------------------
// estimateRates — measured where data allows, priors otherwise
// ---------------------------------------------------------------------------

test("estimateRates falls back to conservative priors on thin data and records notes", () => {
  const counts = countFunnel([prospect("discovered")], NO_PREVIEWS, NO_RETAINERS);
  const { rates, notes } = estimateRates(counts, NO_RETAINERS);
  assert.equal(rates.respondRate, DEFAULT_RESPOND_RATE);
  assert.equal(rates.winRate, DEFAULT_WIN_RATE);
  assert.equal(rates.avgRetainerPence, DEFAULT_RETAINER_PENCE);
  // Honesty rule: every substitution must be surfaced.
  assert.equal(notes.length, 3);
});

test("estimateRates measures rates once samples are sufficient", () => {
  const prospects = [
    ...Array.from({ length: MIN_RATE_SAMPLE }, () => prospect("contacted")),
    ...Array.from({ length: 5 }, () => prospect("responded")),
    prospect("won"),
    prospect("won"),
  ];
  const retainers = [retainer(50_000)];
  const counts = countFunnel(prospects, NO_PREVIEWS, retainers);
  const { rates, notes } = estimateRates(counts, retainers);
  // Cumulative counting: contacted-or-beyond = 12, responded-or-beyond = 7.
  assert.ok(Math.abs(rates.respondRate - 7 / 12) < 1e-9);
  // won counts ACTIVE RETAINERS (revenue truth): 1 here.
  assert.ok(Math.abs(rates.winRate - 1 / 7) < 1e-9);
  assert.equal(rates.avgRetainerPence, 50_000);
  assert.equal(notes.length, 0);
});

test("estimateRates clamps respond rate at 1", () => {
  const prospects = [
    prospect("responded"),
    prospect("responded"),
    prospect("responded"),
    prospect("responded"),
    prospect("responded"),
    prospect("contacted"),
  ];
  const counts = countFunnel(prospects, NO_PREVIEWS, NO_RETAINERS);
  // Cumulative counting: contacted-or-beyond = 6, responded-or-beyond = 5.
  const { rates } = estimateRates(counts, NO_RETAINERS);
  assert.ok(Math.abs(rates.respondRate - 5 / 6) < 1e-9);
});


// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

test("stageWinProbability: warm stages ≥ early stages; negotiating doubled", () => {
  const rates = { respondRate: 0.2, winRate: 0.1, avgRetainerPence: 25_000 };
  const early = stageWinProbability("discovered", rates);
  const responded = stageWinProbability("responded", rates);
  const negotiating = stageWinProbability("negotiating", rates);
  assert.ok(responded > early);
  assert.equal(responded, 0.1);
  assert.equal(negotiating, 0.2);
  assert.equal(stageWinProbability("won", rates), 0);
  assert.equal(stageWinProbability("lost", rates), 0);
  // Probability is always capped.
  const hot = { respondRate: 1, winRate: 1, avgRetainerPence: 25_000 };
  assert.ok(stageWinProbability("negotiating", hot) <= 0.5);
});

test("projectMrr values active pipeline only and rewards demos", () => {
  const rates = { respondRate: 0.15, winRate: 0.1, avgRetainerPence: 25_000 };
  const withDemo = prospect("analysed");
  const plain = prospect("analysed");
  const won = prospect("won");
  const lost = prospect("lost");
  const base = projectMrr([plain], NO_PREVIEWS, rates);
  const boosted = projectMrr([withDemo], [preview(withDemo.id)], rates);
  assert.ok(boosted > base, "a built demo should raise projected MRR");
  // Won/lost contribute nothing.
  assert.equal(projectMrr([won, lost], NO_PREVIEWS, rates), 0);
});

// ---------------------------------------------------------------------------
// buildGoalStatus
// ---------------------------------------------------------------------------

test("buildGoalStatus: empty funnel → zero MRR, full gap, honest notes, ranked actions", () => {
  const status = buildGoalStatus([], [], []);
  assert.equal(status.currentMrrPence, 0);
  assert.equal(status.projectedMrrPence, 0);
  assert.equal(status.gapPence, GOAL_MRR_PENCE);
  assert.equal(status.coverageRatio, 0);
  assert.equal(status.notes.length, 3); // all three priors disclosed
  // With nothing in the pipeline only funnel-filling actions can appear…
  assert.ok(status.nextActions.every((a) => a.id !== "work-warm"));
  assert.ok(status.nextActions.every((a) => a.id !== "close"));
});

test("buildGoalStatus uses REAL retainer MRR for current and gap", () => {
  const retainers = [retainer(60_000), retainer(40_000)]; // £1,000/mo total
  const status = buildGoalStatus([prospect("won"), prospect("won")], [], retainers);
  assert.equal(status.currentMrrPence, GOAL_MRR_PENCE);
  assert.equal(status.gapPence, 0);
  assert.equal(status.coverageRatio, 100_000 / GOAL_MRR_PENCE);
  // At goal the top action flips to retention/expansion.
  assert.equal(status.nextActions[0].id, "retain");
});

test("buildGoalStatus recommends working warm leads when they exist", () => {
  const prospects = [
    ...Array.from({ length: 6 }, () => prospect("discovered")),
    prospect("responded"),
    prospect("responded"),
    prospect("negotiating"),
  ];
  const status = buildGoalStatus(prospects, NO_PREVIEWS, NO_RETAINERS);
  const ids = status.nextActions.map((a) => a.id);
  assert.ok(ids.includes("work-warm"));
  assert.ok(ids.includes("close"));
});

test("next actions are ranked by potential MRR per unit of effort", () => {
  const prospects = [
    ...Array.from({ length: 6 }, () => prospect("discovered")),
    prospect("responded"),
    prospect("responded"),
    prospect("responded"),
    prospect("responded"),
  ];
  const status = buildGoalStatus(prospects, NO_PREVIEWS, NO_RETAINERS);
  const score = (a: (typeof status.nextActions)[number]) =>
    a.potentialMrrPence / (a.effort === "low" ? 1 : a.effort === "medium" ? 2.5 : 5);
  const ranked = status.nextActions.map(score);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1] >= ranked[i], "actions must be non-increasing by leverage");
  }
});

// ---------------------------------------------------------------------------
// deriveTuning — closed-loop control, hard-bounded
// ---------------------------------------------------------------------------

test("deriveTuning pushes harder when far from goal, throttles at goal", () => {
  const far = buildGoalStatus(
    Array.from({ length: 10 }, () => prospect("discovered")),
    [],
    []
  );
  const near = buildGoalStatus(
    Array.from({ length: 10 }, () => prospect("discovered")),
    [],
    [retainer(GOAL_MRR_PENCE)]
  );
  const push = deriveTuning(far);
  const cruise = deriveTuning(near);
  assert.ok(push.demosPerRun > cruise.demosPerRun);
  assert.ok(push.outreachMax > cruise.outreachMax);
  // At goal everything throttles down but stays within bounds.
  assert.ok(cruise.demosPerRun >= 1 && cruise.demosPerRun <= 6);
  assert.ok(cruise.outreachMax >= 10 && cruise.outreachMax <= 100);
});

test("deriveTuning output is always hard-bounded even at extreme gaps", () => {
  const status = buildGoalStatus([], [], []); // max possible gap
  const tuning = deriveTuning({ ...status, coverageRatio: null });
  assert.ok(tuning.minActivePipeline >= 10 && tuning.minActivePipeline <= 40);
  assert.ok(tuning.demosPerRun >= 1 && tuning.demosPerRun <= 6);
  assert.ok(tuning.outreachMax >= 10 && tuning.outreachMax <= 100);
});

