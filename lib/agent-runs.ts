/**
 * agent_runs persistence — the audit + cost trail for every agent execution.
 *
 * Writes are service role (the runner has no user session during cron/worker
 * execution). Reads for the Agent Control Centre use the authed client elsewhere
 * via RLS; the service-role reads here power server-side summaries.
 */

import type { AgentKind, AgentRunStatus, Autonomy } from "./agents/types";
import { sbSelect, sbInsert, sbUpdate, supabaseWritable } from "./supabase/client";

export interface AgentRun {
  id: string;
  orgId: string;
  kind: AgentKind;
  status: AgentRunStatus;
  autonomy: Autonomy;
  summary?: string | null;
  model?: string | null;
  inputTokens: number;
  outputTokens: number;
  costPence: number;
  error?: string | null;
  createdAt: string;
  finishedAt?: string | null;
}

interface RunRow {
  id: string;
  org_id: string;
  kind: string;
  status: string;
  autonomy: string;
  summary: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_pence: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

function toRun(row: RunRow): AgentRun {
  return {
    id: row.id,
    orgId: row.org_id,
    kind: row.kind as AgentKind,
    status: row.status as AgentRunStatus,
    autonomy: row.autonomy as Autonomy,
    summary: row.summary,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costPence: row.cost_pence,
    error: row.error,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

const RUN_COLS =
  "select=id,org_id,kind,status,autonomy,summary,model,input_tokens,output_tokens,cost_pence,error,created_at,finished_at";

/** Create a 'running' row. Returns its id, or null when Supabase isn't writable. */
export async function createAgentRun(input: {
  orgId: string;
  kind: AgentKind;
  autonomy: Autonomy;
  input: unknown;
  actorUserId?: string | null;
}): Promise<string | null> {
  if (!supabaseWritable) return null;
  const row = await sbInsert<{ id: string }>("agent_runs", {
    org_id: input.orgId,
    kind: input.kind,
    status: "running",
    autonomy: input.autonomy,
    input: input.input ?? null,
    actor_user_id: input.actorUserId ?? null,
  });
  return row?.id ?? null;
}

/** Patch a run to its terminal state with usage + output. */
export async function finishAgentRun(
  id: string,
  patch: {
    status: AgentRunStatus;
    output?: unknown;
    summary?: string;
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    costPence?: number;
    error?: string;
  }
): Promise<void> {
  if (!supabaseWritable) return;
  await sbUpdate<RunRow>("agent_runs", `id=eq.${encodeURIComponent(id)}`, {
    status: patch.status,
    output: patch.output ?? null,
    summary: patch.summary ?? null,
    model: patch.model ?? null,
    input_tokens: patch.inputTokens ?? 0,
    output_tokens: patch.outputTokens ?? 0,
    cost_pence: patch.costPence ?? 0,
    error: patch.error ?? null,
    finished_at: new Date().toISOString(),
  });
}

/** Recent runs for an org (Agent Control Centre, service-role summary). */
export async function getRecentAgentRuns(orgId: string, limit = 50): Promise<AgentRun[]> {
  if (!supabaseWritable) return [];
  const rows = await sbSelect<RunRow>({
    query: `agent_runs?${RUN_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc&limit=${limit}`,
    tier: "service",
  });
  return rows.map(toRun);
}
