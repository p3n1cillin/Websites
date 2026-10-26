import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checklistComplete,
  getSetupChecklist,
  type SetupChecklistInput,
} from "../lib/setup-checklist";

const DONE: SetupChecklistInput = {
  supabaseConfigured: true,
  supabaseWritable: true,
  loopStateTableReadable: true,
  resendConfigured: true,
  stripeConfigured: true,
  cronSecretSet: true,
  inboundSecretSet: true,
  operatorEmailSet: true,
  prospectCount: 25,
};

test("a fully-configured deployment reports every task done", () => {
  const tasks = getSetupChecklist(DONE);
  assert.ok(tasks.length > 0);
  assert.ok(checklistComplete(tasks));
  assert.ok(tasks.every((t) => t.done));
});

test("a fresh deployment reports nothing done, with exact fixes attached", () => {
  const tasks = getSetupChecklist({
    ...DONE,
    supabaseConfigured: false,
    supabaseWritable: false,
    loopStateTableReadable: false,
    resendConfigured: false,
    stripeConfigured: false,
    cronSecretSet: false,
    inboundSecretSet: false,
    operatorEmailSet: false,
    prospectCount: 0,
  });
  assert.ok(!checklistComplete(tasks));
  assert.ok(tasks.every((t) => !t.done));
  // Every open task tells the operator exactly what to do (no vague advice).
  assert.ok(tasks.every((t) => t.how.length > 20));
  assert.ok(tasks.every((t) => t.minutes > 0));
});

test("unreadable loop_state table counts as migrations NOT applied", () => {
  const unknown = getSetupChecklist({ ...DONE, loopStateTableReadable: null });
  const migrations = unknown.find((t) => t.id === "migrations");
  assert.ok(migrations && !migrations.done);
});

test("each task maps to its briefing group and ids are unique", () => {
  const tasks = getSetupChecklist(DONE);
  const groups = new Set(["database", "email", "billing", "automation"]);
  assert.ok(tasks.every((t) => groups.has(t.group)));
  assert.equal(new Set(tasks.map((t) => t.id)).size, tasks.length);
});

test("seeding is only done once the pipeline has prospects", () => {
  assert.ok(getSetupChecklist({ ...DONE, prospectCount: 0 }).find((t) => t.id === "seed-pipeline")?.done === false);
  assert.ok(getSetupChecklist({ ...DONE, prospectCount: 1 }).find((t) => t.id === "seed-pipeline")?.done === true);
});
