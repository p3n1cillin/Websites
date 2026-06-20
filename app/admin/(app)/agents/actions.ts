"use server";

import { requireOrg } from "@/lib/auth";
import { setAgentSettings } from "@/lib/agent-settings";
import { decideApproval, getPendingApprovals } from "@/lib/approvals";
import { isAgentRegistered } from "@/lib/agents/registry";
import { AUTONOMY_LEVELS, type AgentKind, type Autonomy } from "@/lib/agents/types";

/** Update one agent's autonomy + spend caps for the org. */
export async function setAgentSettingsAction(
  kind: AgentKind,
  autonomy: Autonomy,
  dailyCapPence: number | null,
  monthlyCapPence: number | null
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  if (!isAgentRegistered(kind)) return { ok: false, error: "Unknown agent." };
  if (!AUTONOMY_LEVELS.includes(autonomy)) return { ok: false, error: "Invalid autonomy." };
  const clean = (n: number | null) => (n != null && n > 0 ? Math.round(n) : null);
  try {
    await setAgentSettings({
      orgId: org.id,
      kind,
      autonomy,
      dailyCapPence: clean(dailyCapPence),
      monthlyCapPence: clean(monthlyCapPence),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
  return { ok: true };
}

/** Approve or reject a parked action (records the decision; ownership-checked). */
export async function decideApprovalAction(
  id: string,
  decision: "approved" | "rejected"
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const pending = await getPendingApprovals(org.id);
  if (!pending.some((a) => a.id === id)) return { ok: false, error: "Approval not found." };
  await decideApproval(id, decision, org.ownerUserId);
  return { ok: true };
}
