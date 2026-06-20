/**
 * Workflow engine (Agency OS — Phase H). Executes a workflow's ordered agent steps
 * over an evolving context, threading each agent's output into the next, recording
 * a per-step log. Every step still goes through the audited/cost-tracked/autonomy-
 * gated agent runner — the engine only orchestrates and resolves I/O.
 *
 * Execution is inline + sequential (a manual "Run now"). A step that fails or hits a
 * spend cap fails the run; a step that parks for approval pauses it (resume-after-
 * approval is a later enhancement). Cron/event triggers are deferred — the existing
 * job queue can enqueue a workflow start behind the same runWorkflow() later.
 */

import { runAgent } from "./agents/runner";
import type { AgentKind, Autonomy } from "./agents/types";
import { getProspectRecord } from "./prospects";
import { getBusinessRecord } from "./businesses";
import { getPreviewsForOrg } from "./previews";
import { generateDesignDNA } from "./design/dna";
import { SITE_URL } from "./seo";
import type { ProspectStatus } from "./types";
import {
  createWorkflowRun,
  updateWorkflowRun,
  type Workflow,
  type WorkflowContext,
  type WorkflowRun,
  type WorkflowStep,
  type WorkflowStepLog,
} from "./workflows";

/** The canonical sell→deploy→optimise loop (seeded with a prospect). */
export function standardPipelineSteps(): WorkflowStep[] {
  const step = (kind: AgentKind, autonomy: Autonomy = "auto"): WorkflowStep => ({
    id: `${kind}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    autonomy,
  });
  return [
    step("market"),
    step("prospecting"),
    step("sales"),
    step("onboarding"),
    step("seo-growth"),
    { ...step("conversion"), config: { slot: "headline" } },
    step("success"),
  ];
}

const mkStep = (kind: AgentKind, autonomy: Autonomy = "auto"): WorkflowStep => ({
  id: `${kind}-${Math.random().toString(36).slice(2, 8)}`,
  kind,
  autonomy,
});

/**
 * Automation modes — named pipeline presets (the vision's Research / Demonstration
 * / Growth modes), each just a workflow step list seeded from a prospect.
 *   research      — audit + score only (find the opportunities).
 *   demonstration — + build the tokenised demo (show, don't tell).
 *   growth        — the full sell → onboard → grow loop.
 */
export const AUTOMATION_MODES = ["research", "demonstration", "growth"] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

export function modeSteps(mode: AutomationMode): WorkflowStep[] {
  switch (mode) {
    case "research":
      return [mkStep("market")];
    case "demonstration":
      return [mkStep("market"), mkStep("prospecting")];
    case "growth":
      return standardPipelineSteps();
  }
}

export function modeWorkflowName(mode: AutomationMode): string {
  return {
    research: "Research mode — find & score opportunities",
    demonstration: "Demonstration mode — score & build demos",
    growth: "Growth mode — full sell → onboard → grow",
  }[mode];
}

/**
 * The prospect status a workflow consumes, derived from its first step — used to
 * pick eligible prospects for batch + scheduled runs. Pipeline steps advance the
 * status, so a prospect won't re-match on the next tick. Business-oriented first
 * steps (no prospect entry) return null and aren't batch/schedule-eligible.
 */
export function prospectEntryStatus(workflow: Workflow): ProspectStatus | null {
  const first = workflow.steps[0]?.kind;
  switch (first) {
    case "market":
      return "discovered";
    case "prospecting":
      return "analysed";
    case "sales":
      return "previewed";
    case "onboarding":
      return "won";
    default:
      return null;
  }
}

/** Create a run for one seed and execute it inline. Shared by manual/batch/cron. */
export async function executeWorkflowForSeed(
  workflow: Workflow,
  orgId: string,
  context: WorkflowContext,
  actorUserId?: string | null
): Promise<void> {
  const run = await createWorkflowRun({ orgId, workflowId: workflow.id, context });
  await runWorkflow(workflow, run, orgId, actorUserId);
}

// ---------------------------------------------------------------------------
// I/O resolution — build each agent's input from the run context.
// ---------------------------------------------------------------------------

async function resolveInput(
  kind: AgentKind,
  context: WorkflowContext,
  orgId: string,
  config?: WorkflowStep["config"]
): Promise<unknown> {
  switch (kind) {
    case "ping":
      return { note: "workflow ping" };

    case "discovery":
      return { orgId, candidates: context.candidates ?? [], note: context.note };

    case "market":
    case "prospecting":
    case "onboarding": {
      const prospect = await requireProspect(context);
      return { prospect };
    }

    case "sales": {
      const prospect = await requireProspect(context);
      const previews = await getPreviewsForOrg(orgId);
      const preview = previews.find((p) => p.prospectId === prospect.id && p.status === "active");
      const previewUrl = preview ? `${SITE_URL}/preview/${preview.token}` : null;
      return { prospect, previewUrl };
    }

    case "design": {
      const record = await requireBusiness(context, orgId);
      return {
        businessId: record.id,
        businessName: record.data.name,
        category: record.data.category,
        dna: generateDesignDNA(record.data),
      };
    }

    case "qa": {
      const record = await requireBusiness(context, orgId);
      return { business: record.data, dna: generateDesignDNA(record.data) };
    }

    case "conversion": {
      const record = await requireBusiness(context, orgId);
      return {
        business: record.data,
        businessId: record.id,
        slot: config?.slot ?? "headline",
        mode: "propose",
      };
    }

    case "seo-growth":
    case "success": {
      const record = await requireBusiness(context, orgId);
      return { businessId: record.id };
    }

    default:
      throw new Error(`No input resolver for agent "${kind}".`);
  }
}

async function requireProspect(context: WorkflowContext) {
  if (!context.prospectId) throw new Error("This step needs a prospect — seed the run with one.");
  const prospect = await getProspectRecord(context.prospectId);
  if (!prospect) throw new Error("Seed prospect no longer exists.");
  return prospect;
}

async function requireBusiness(context: WorkflowContext, orgId: string) {
  if (!context.businessId) {
    throw new Error("This step needs a business — onboard the prospect earlier in the workflow.");
  }
  const record = await getBusinessRecord(context.businessId);
  if (!record || record.orgId !== orgId) throw new Error("Business not found for this org.");
  return record;
}

/** Thread an agent's output back into the shared context for downstream steps. */
function mergeOutput(kind: AgentKind, output: unknown, context: WorkflowContext): WorkflowContext {
  if (kind === "onboarding") {
    const businessId = (output as { businessId?: string } | undefined)?.businessId;
    if (businessId) return { ...context, businessId };
  }
  return context;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function runWorkflow(
  workflow: Workflow,
  run: WorkflowRun,
  orgId: string,
  actorUserId?: string | null
): Promise<void> {
  let context: WorkflowContext = { ...run.context };
  const log: WorkflowStepLog[] = [...run.log];
  const now = () => new Date().toISOString();

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    await updateWorkflowRun(run.id, { step: i });

    let input: unknown;
    try {
      input = await resolveInput(step.kind, context, orgId, step.config);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log.push({ index: i, kind: step.kind, status: "failed", error, costPence: 0 });
      await updateWorkflowRun(run.id, { status: "failed", log, error, finishedAt: now() });
      return;
    }

    const res = await runAgent({
      kind: step.kind,
      input,
      orgId,
      actorUserId,
      autonomyOverride: step.autonomy,
    });

    log.push({
      index: i,
      kind: step.kind,
      status: res.status,
      summary: res.summary,
      error: res.error,
      costPence: res.costPence,
    });

    if (res.status === "failed" || res.status === "blocked") {
      await updateWorkflowRun(run.id, {
        status: "failed",
        log,
        error: res.error || res.summary || "Step failed.",
        finishedAt: now(),
      });
      return;
    }
    if (res.status === "awaiting_approval") {
      // Step parked for a human; pause here (resume-after-approval is future work).
      await updateWorkflowRun(run.id, { status: "paused", log, context, finishedAt: now() });
      return;
    }

    // "skipped" (autonomy off) just falls through to the next step.
    context = mergeOutput(step.kind, res.output, context);
    await updateWorkflowRun(run.id, { context, log });
  }

  await updateWorkflowRun(run.id, {
    status: "completed",
    log,
    context,
    step: Math.max(0, workflow.steps.length - 1),
    finishedAt: now(),
  });
}
