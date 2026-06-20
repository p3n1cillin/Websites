/**
 * Approvals — the human-in-the-loop gate (approvals table).
 *
 * When a side-effecting agent runs with autonomy 'approve', its proposed action
 * is parked here until an operator approves or rejects it. Creation is service
 * role (from the runner); listing/deciding from the dashboard uses the authed
 * client (RLS owner policy). The actual *application* of an approved action is
 * the owning agent's concern (added in that agent's phase).
 */

import type { AgentKind } from "./agents/types";
import { sbSelect, sbInsert, sbUpdate, supabaseWritable } from "./supabase/client";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  id: string;
  orgId: string;
  agentRunId?: string | null;
  kind: AgentKind;
  summary: string;
  payload: unknown;
  status: ApprovalStatus;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

interface ApprovalRow {
  id: string;
  org_id: string;
  agent_run_id: string | null;
  kind: string;
  summary: string;
  payload: unknown;
  status: string;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

function toApproval(row: ApprovalRow): Approval {
  return {
    id: row.id,
    orgId: row.org_id,
    agentRunId: row.agent_run_id,
    kind: row.kind as AgentKind,
    summary: row.summary,
    payload: row.payload,
    status: row.status as ApprovalStatus,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

const APPROVAL_COLS =
  "select=id,org_id,agent_run_id,kind,summary,payload,status,decided_by,decided_at,created_at";

/** Park a proposed action for human sign-off. Returns its id (or null, no DB). */
export async function createApproval(input: {
  orgId: string;
  agentRunId?: string | null;
  kind: AgentKind;
  summary: string;
  payload: unknown;
}): Promise<string | null> {
  if (!supabaseWritable) return null;
  const row = await sbInsert<{ id: string }>("approvals", {
    org_id: input.orgId,
    agent_run_id: input.agentRunId ?? null,
    kind: input.kind,
    summary: input.summary,
    payload: input.payload ?? null,
  });
  return row?.id ?? null;
}

/** Pending approvals for an org (service-role read for dashboards/badges). */
export async function getPendingApprovals(orgId: string): Promise<Approval[]> {
  if (!supabaseWritable) return [];
  const rows = await sbSelect<ApprovalRow>({
    query: `approvals?${APPROVAL_COLS}&org_id=eq.${encodeURIComponent(
      orgId
    )}&status=eq.pending&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toApproval);
}

/** Record an operator's decision. Applying the action is the agent's job. */
export async function decideApproval(
  id: string,
  decision: "approved" | "rejected",
  decidedBy: string
): Promise<Approval | null> {
  if (!supabaseWritable) return null;
  const [row] = await sbUpdate<ApprovalRow>("approvals", `id=eq.${encodeURIComponent(id)}`, {
    status: decision,
    decided_by: decidedBy,
    decided_at: new Date().toISOString(),
  });
  return row ? toApproval(row) : null;
}
