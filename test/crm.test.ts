import { test } from "node:test";
import assert from "node:assert/strict";
import { crmStateFor, needsAttention } from "@/lib/crm";
import { makeProspect } from "./_fixtures";

const DAY = 86_400_000;

test("a discovered prospect's next action is to analyse", () => {
  const s = crmStateFor(makeProspect({ status: "discovered" }));
  assert.equal(s.nextActionKind, "analyse");
});

test("won but not onboarded → onboard (high urgency); onboarded → nurture", () => {
  const won = makeProspect({ status: "won" });
  assert.equal(crmStateFor(won, { onboarded: false }).nextActionKind, "onboard");
  assert.equal(crmStateFor(won, { onboarded: true }).nextActionKind, "nurture");
});

test("responded with no proposal → send proposal; with proposal → chase", () => {
  const p = makeProspect({ status: "responded" });
  assert.equal(crmStateFor(p).nextActionKind, "send_proposal");
  const withProposal = crmStateFor(p, {
    proposal: { id: "pr1", status: "sent" } as never,
  });
  assert.equal(withProposal.nextActionKind, "chase_proposal");
  assert.equal(withProposal.urgency, "high");
});

test("a stage left untouched past its limit goes stale", () => {
  const old = new Date(Date.now() - 10 * DAY).toISOString();
  const s = crmStateFor(makeProspect({ status: "discovered", updatedAt: old, createdAt: old }));
  assert.equal(s.stale, true);
  assert.ok(s.daysSinceActivity >= 9);
});

test("lost prospects need no action", () => {
  const s = crmStateFor(makeProspect({ status: "lost" }));
  assert.equal(s.nextActionKind, "none");
});

test("needsAttention surfaces high-urgency/stale, worst first", () => {
  const states = [
    crmStateFor(makeProspect({ id: "a", status: "discovered" })), // low, fresh
    crmStateFor(makeProspect({ id: "b", status: "responded" })), // high
  ];
  const out = needsAttention(states);
  assert.ok(out.length >= 1);
  assert.equal(out[0].urgency, "high");
});
