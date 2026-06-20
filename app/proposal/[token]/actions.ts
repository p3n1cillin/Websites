"use server";

import { getProposalByToken, updateProposalStatus, setProposalSession } from "@/lib/proposals";
import { getProspectRecord, updateProspectStatus } from "@/lib/prospects";
import { ensureRetainerForWonDeal } from "@/lib/retainers";
import { stripeConfigured, createProposalCheckout } from "@/lib/stripe";
import { SITE_URL } from "@/lib/seo";

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

/**
 * Start a real Stripe Checkout for the proposal's build fee — money in the bank, not
 * just a click. Returns a URL the client component redirects to. The webhook closes
 * the deal on payment. Returns an error when Stripe isn't configured.
 */
export async function payProposalAction(
  token: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!stripeConfigured) {
    return { ok: false, error: "Card payment isn't enabled yet — use Accept instead." };
  }
  const proposal = await getProposalByToken(token);
  if (!proposal) return { ok: false, error: "Proposal not found." };
  if (proposal.status === "accepted") return { ok: false, error: "Already accepted." };

  const prospect = await getProspectRecord(proposal.prospectId);
  try {
    const session = await createProposalCheckout({
      amountPence: proposal.pricePence,
      productName: proposal.title || "Website build",
      proposalId: proposal.id,
      orgId: proposal.orgId,
      customerEmail: prospect?.email ?? null,
      successUrl: `${SITE_URL}/proposal/${token}/paid?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${SITE_URL}/proposal/${token}`,
    });
    await setProposalSession(proposal.id, session.id);
    return { ok: true, url: session.url };
  } catch {
    return { ok: false, error: "Couldn't start checkout — please try again." };
  }
}
