"use server";

import { requireOrg } from "@/lib/auth";
import {
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getWorkflowRecord,
  type WorkflowStep,
} from "@/lib/workflows";
import {
  executeWorkflowForSeed,
  modeSteps,
  modeWorkflowName,
  prospectEntryStatus,
  standardPipelineSteps,
  AUTOMATION_MODES,
  type AutomationMode,
} from "@/lib/workflow-engine";
import { getProspectsForOrg } from "@/lib/prospects";

/** Create the canonical sell→deploy→optimise pipeline (seeded with a prospect). */
export async function createStandardWorkflowAction(): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  await createWorkflow({
    orgId: org.id,
    name: "Standard pipeline — sell → onboard → grow",
    steps: standardPipelineSteps(),
  });
  return { ok: true };
}

/** Create one of the named automation-mode presets (Research/Demonstration/Growth). */
export async function createModeWorkflowAction(
  mode: AutomationMode
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  if (!AUTOMATION_MODES.includes(mode)) return { ok: false, error: "Unknown mode." };
  await createWorkflow({ orgId: org.id, name: modeWorkflowName(mode), steps: modeSteps(mode) });
  return { ok: true };
}

export async function createWorkflowAction(name: string): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required." };
  await createWorkflow({ orgId: org.id, name: trimmed, steps: [] });
  return { ok: true };
}

async function owned(id: string, orgId: string) {
  const wf = await getWorkflowRecord(id);
  return wf && wf.orgId === orgId ? wf : null;
}

export async function updateWorkflowAction(
  id: string,
  patch: { name?: string; steps?: WorkflowStep[]; enabled?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  if (!(await owned(id, org.id))) return { ok: false, error: "Workflow not found." };
  await updateWorkflow(id, patch);
  return { ok: true };
}

export async function deleteWorkflowAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  if (!(await owned(id, org.id))) return { ok: false, error: "Workflow not found." };
  await deleteWorkflow(id);
  return { ok: true };
}

/** Run a workflow now over a seed (prospect and/or business). Executes inline. */
export async function runWorkflowAction(
  workflowId: string,
  seed: { prospectId?: string; businessId?: string }
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const wf = await owned(workflowId, org.id);
  if (!wf) return { ok: false, error: "Workflow not found." };
  if (wf.steps.length === 0) return { ok: false, error: "Add at least one step first." };

  const context = {
    prospectId: seed.prospectId || undefined,
    businessId: seed.businessId || undefined,
  };
  try {
    await executeWorkflowForSeed(wf, org.id, context, org.ownerUserId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Run failed." };
  }
  return { ok: true };
}

/**
 * Batch-run a workflow over every prospect in the status its first step consumes
 * (e.g. a Growth workflow over all "discovered" prospects). Runs inline, capped to
 * keep it responsive; per-agent autonomy + spend caps still apply to each step.
 */
export async function runWorkflowBatchAction(
  workflowId: string
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const org = await requireOrg();
  const wf = await owned(workflowId, org.id);
  if (!wf) return { ok: false, error: "Workflow not found." };
  if (wf.steps.length === 0) return { ok: false, error: "Add at least one step first." };

  const status = prospectEntryStatus(wf);
  if (!status) {
    return { ok: false, error: "This workflow's first step isn't prospect-based, so it can't batch-run." };
  }

  const eligible = (await getProspectsForOrg(org.id))
    .filter((p) => p.status === status)
    .slice(0, 10); // bound inline work
  if (eligible.length === 0) return { ok: false, error: `No prospects in "${status}" to run over.` };

  let count = 0;
  for (const p of eligible) {
    try {
      await executeWorkflowForSeed(wf, org.id, { prospectId: p.id }, org.ownerUserId);
      count += 1;
    } catch {
      /* keep going — one bad prospect shouldn't halt the batch */
    }
  }
  return { ok: true, count };
}
