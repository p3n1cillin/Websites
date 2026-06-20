"use server";

import { getProposalByToken, updateProposalStatus } from "@/lib/proposals";
import { getProspectRecord, updateProspectStatus } from "@/lib/prospects";
import { ensureRetainerForWonDeal } from "@/lib/retainers";

/**
 * Public accept action for /proposal/[token]. Capability-by-token: the prospect
 * who has the link can accept it — no login. Resolves the proposal by its opaque
 * token, marks it accepted, and closes the deal (prospect → won). Never throws.
 */
export async function acceptProposalAction(
  token: string
): Promise<{ ok: boolean; error?: string }> {
  const proposal = await getProposalByToken(token);
  if (!proposal) return { ok: false, error: "Proposal not found." };
  if (proposal.status === "accepted") return { ok: true };

  await updateProposalStatus(proposal.id, "accepted");

  // Close the deal — the proposal token already proves ownership of this prospect.
  const prospect = await getProspectRecord(proposal.prospectId);
  if (prospect && prospect.status !== "won") {
    await updateProspectStatus(prospect.id, "won");
    // Revenue truth: open a real recurring retainer for the won client (idempotent).
    await ensureRetainerForWonDeal({
      orgId: prospect.orgId,
      name: prospect.name,
      prospectId: prospect.id,
    });
  }
  return { ok: true };
}
