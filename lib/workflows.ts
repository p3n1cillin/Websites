import { revalidatePath } from "next/cache";
import type { AgentKind, Autonomy } from "./agents/types";
import type { ExperimentSlot } from "./types";
import { sbSelect, sbInsert, sbUpdate, sbDelete } from "./supabase/client";

/**
 * Workflow data layer + types (Agency OS — Phase H). A workflow is an ordered list
 * of agent steps; a workflow_run is one execution. The engine (lib/workflow-engine)
 * does the actual running; this module is storage only. Service role throughout.
 */

export interface WorkflowStep {
  /** Stable id within the workflow. */
  id: string;
  kind: AgentKind;
  /** Autonomy to run this step with (defaults to the agent's own default). */
  autonomy: Autonomy;
  /** Per-step config — e.g. the slot for a conversion test. */
  config?: { slot?: ExperimentSlot };
}

export interface Workflow {
  id: string;
  orgId: string;
  name: string;
  steps: WorkflowStep[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowRunStatus = "running" | "completed" | "failed" | "paused";

export interface WorkflowStepLog {
  index: number;
  kind: AgentKind;
  status: string;
  summary?: string;
  error?: string;
  costPence: number;
}

/** The entity references + accumulated outputs threaded through a run. */
export interface WorkflowContext {
  prospectId?: string;
  businessId?: string;
  candidates?: unknown[];
  note?: string;
}

export interface WorkflowRun {
  id: string;
  orgId: string;
  workflowId: string;
  status: WorkflowRunStatus;
  step: number;
  context: WorkflowContext;
  log: WorkflowStepLog[];
  error?: string | null;
  createdAt: string;
  finishedAt?: string | null;
}

// ===========================================================================
// Workflows
// ===========================================================================

interface WorkflowRow {
  id: string;
  org_id: string;
  name: string;
  steps: WorkflowStep[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const WF_COLS = "select=id,org_id,name,steps,enabled,created_at,updated_at";

function toWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    steps: Array.isArray(row.steps) ? row.steps : [],
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createWorkflow(input: {
  orgId: string;
  name: string;
  steps: WorkflowStep[];
}): Promise<Workflow> {
  const row = await sbInsert<WorkflowRow>("workflows", {
    org_id: input.orgId,
    name: input.name,
    steps: input.steps,
  });
  revalidatePath("/admin/workflows");
  return toWorkflow(row);
}

export async function getWorkflowsForOrg(orgId: string): Promise<Workflow[]> {
  const rows = await sbSelect<WorkflowRow>({
    query: `workflows?${WF_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toWorkflow);
}

/** All enabled workflows across every org — for the unattended automation tick. */
export async function listEnabledWorkflowsAllOrgs(): Promise<Workflow[]> {
  const rows = await sbSelect<WorkflowRow>({
    query: `workflows?${WF_COLS}&enabled=eq.true&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toWorkflow);
}

export async function getWorkflowRecord(id: string): Promise<Workflow | null> {
  const rows = await sbSelect<WorkflowRow>({
    query: `workflows?${WF_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toWorkflow(rows[0]) : null;
}

export async function updateWorkflow(
  id: string,
  patch: { name?: string; steps?: WorkflowStep[]; enabled?: boolean }
): Promise<Workflow> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.steps !== undefined) fields.steps = patch.steps;
  if (patch.enabled !== undefined) fields.enabled = patch.enabled;
  const [row] = await sbUpdate<WorkflowRow>("workflows", `id=eq.${encodeURIComponent(id)}`, fields);
  if (!row) throw new Error(`Workflow ${id} not found.`);
  revalidatePath("/admin/workflows");
  return toWorkflow(row);
}

export async function deleteWorkflow(id: string): Promise<void> {
  await sbDelete("workflows", `id=eq.${encodeURIComponent(id)}`);
  revalidatePath("/admin/workflows");
}

// ===========================================================================
// Workflow runs
// ===========================================================================

interface WorkflowRunRow {
  id: string;
  org_id: string;
  workflow_id: string;
  status: WorkflowRunStatus;
  step: number;
  context: WorkflowContext;
  log: WorkflowStepLog[];
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

const WR_COLS =
  "select=id,org_id,workflow_id,status,step,context,log,error,created_at,finished_at";

function toRun(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    orgId: row.org_id,
    workflowId: row.workflow_id,
    status: row.status,
    step: row.step,
    context: row.context ?? {},
    log: Array.isArray(row.log) ? row.log : [],
    error: row.error,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

export async function createWorkflowRun(input: {
  orgId: string;
  workflowId: string;
  context: WorkflowContext;
}): Promise<WorkflowRun> {
  const row = await sbInsert<WorkflowRunRow>("workflow_runs", {
    org_id: input.orgId,
    workflow_id: input.workflowId,
    status: "running",
    step: 0,
    context: input.context,
    log: [],
  });
  return toRun(row);
}

export async function updateWorkflowRun(
  id: string,
  patch: {
    status?: WorkflowRunStatus;
    step?: number;
    context?: WorkflowContext;
    log?: WorkflowStepLog[];
    error?: string | null;
    finishedAt?: string | null;
  }
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.step !== undefined) fields.step = patch.step;
  if (patch.context !== undefined) fields.context = patch.context;
  if (patch.log !== undefined) fields.log = patch.log;
  if (patch.error !== undefined) fields.error = patch.error;
  if (patch.finishedAt !== undefined) fields.finished_at = patch.finishedAt;
  await sbUpdate("workflow_runs", `id=eq.${encodeURIComponent(id)}`, fields);
  revalidatePath("/admin/workflows");
}

export async function getRunsForOrg(orgId: string, limit = 25): Promise<WorkflowRun[]> {
  const rows = await sbSelect<WorkflowRunRow>({
    query: `workflow_runs?${WR_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc&limit=${limit}`,
    tier: "service",
  });
  return rows.map(toRun);
}
