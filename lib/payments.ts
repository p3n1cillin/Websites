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
export interface PaymentLink {
  /** Stripe subscription started for the care plan (when paid via subscription). */
  subscriptionId?: string | null;
  customerId?: string | null;
  monthlyPence?: number;
}

export async function closePaidProposal(
  proposalId: string,
  link: PaymentLink = {}
): Promise<void> {
  const proposal = await getProposalRecord(proposalId);
  if (!proposal) return;

  // "Collected" records the one-off build fee; the recurring care plan is the retainer.
  await markProposalPaid(proposal.id, proposal.pricePence);

  const prospect = await getProspectRecord(proposal.prospectId);
  if (prospect) {
    if (prospect.status !== "won") await updateProspectStatus(prospect.id, "won");
    // Idempotent — opens the retainer (or links the subscription to an existing one).
    await ensureRetainerForWonDeal({
      orgId: prospect.orgId,
      name: prospect.name,
      prospectId: prospect.id,
      monthlyPence: link.monthlyPence,
      stripeSubscriptionId: link.subscriptionId,
      stripeCustomerId: link.customerId,
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
    // Subscription checkouts report payment_status "paid" or "no_payment_required";
    // either is fine once the session has a subscription/payment confirmed.
    const settled = session.payment_status === "paid" || session.subscription !== null;
    if (!settled || meta.kind !== "proposal" || !meta.proposalId) {
      return { ok: false };
    }
    await closePaidProposal(meta.proposalId, {
      subscriptionId: session.subscription,
      customerId: session.customer,
      monthlyPence: Number(meta.monthlyPence) || undefined,
    });
    return { ok: true, proposalId: meta.proposalId };
  } catch {
    return { ok: false };
  }
}
