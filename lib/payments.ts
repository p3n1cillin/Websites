import { getCheckoutSession } from "./stripe";
import { getProposalRecord, markProposalPaid } from "./proposals";
import { getProspectRecord, updateProspectStatus } from "./prospects";
import { ensureRetainerForWonDeal } from "./retainers";

/**
 * Proposal payment completion — the one place that turns a real Stripe payment into
 * a closed deal: mark the proposal PAID, win the prospect, activate the recurring
 * retainer. Idempotent (safe to call from BOTH the success redirect and the webhook).
 * Never fabricates payment — callers only invoke this once Stripe confirms `paid`.
 */
export async function closePaidProposal(proposalId: string, amountPence: number): Promise<void> {
  const proposal = await getProposalRecord(proposalId);
  if (!proposal) return;

  await markProposalPaid(proposal.id, amountPence || proposal.pricePence);

  const prospect = await getProspectRecord(proposal.prospectId);
  if (prospect && prospect.status !== "won") {
    await updateProspectStatus(prospect.id, "won");
    await ensureRetainerForWonDeal({
      orgId: prospect.orgId,
      name: prospect.name,
      prospectId: prospect.id,
    });
  }
}

/**
 * Confirm a proposal payment from a Checkout session id (the success-redirect path —
 * works on localhost with no public webhook). Retrieves the session, verifies it's a
 * PAID proposal session, then closes the deal. Returns the proposal id on success.
 */
export async function confirmProposalPaymentBySession(
  sessionId: string
): Promise<{ ok: boolean; proposalId?: string }> {
  try {
    const session = await getCheckoutSession(sessionId);
    const meta = session.metadata ?? {};
    if (session.payment_status !== "paid" || meta.kind !== "proposal" || !meta.proposalId) {
      return { ok: false };
    }
    await closePaidProposal(meta.proposalId, session.amount_total ?? 0);
    return { ok: true, proposalId: meta.proposalId };
  } catch {
    return { ok: false };
  }
}
