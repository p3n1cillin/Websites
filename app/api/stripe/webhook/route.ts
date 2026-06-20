import { verifyStripeEvent, getSubscription } from "@/lib/stripe";
import { planForPriceId } from "@/lib/plans";
import {
  getOrgByStripeCustomerId,
  updateOrgSubscription,
  recordInvoice,
} from "@/lib/orgs";
import { getProposalRecord, markProposalPaid } from "@/lib/proposals";
import { getProspectRecord, updateProspectStatus } from "@/lib/prospects";
import { ensureRetainerForWonDeal } from "@/lib/retainers";

/**
 * Stripe webhook — the source of truth for subscription state.
 *
 * The browser never tells us a payment succeeded; Stripe does, here. We verify
 * the signature against the raw body, then sync `orgs` (plan + status) and mirror
 * invoices. Needs the Node runtime for `crypto` and an unparsed request body.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const payload = await req.text();
  const event = verifyStripeEvent(payload, req.headers.get("stripe-signature"));
  if (!event) {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;

        // Client paying an agency PROPOSAL (our revenue) — close the deal + bank it.
        if (s.metadata?.kind === "proposal" && s.metadata?.proposalId && s.payment_status === "paid") {
          const proposal = await getProposalRecord(s.metadata.proposalId);
          if (proposal) {
            await markProposalPaid(proposal.id, s.amount_total ?? proposal.pricePence);
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
          break; // not an org-subscription event
        }

        const orgId: string | undefined = s.client_reference_id ?? s.metadata?.orgId;
        const customerId: string | undefined = s.customer;
        const subscriptionId: string | undefined = s.subscription;
        if (orgId && customerId) {
          // Resolve the purchased plan straight away so the dashboard updates
          // without waiting for the separate subscription.* event.
          let plan = undefined;
          if (subscriptionId) {
            const sub = await getSubscription(subscriptionId);
            plan = planForPriceId(sub.items.data[0]?.price.id) ?? undefined;
          }
          await updateOrgSubscription(orgId, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId ?? null,
            subscriptionStatus: "active",
            plan,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const org = await getOrgByStripeCustomerId(sub.customer);
        if (org) {
          const plan = planForPriceId(sub.items?.data?.[0]?.price?.id) ?? undefined;
          await updateOrgSubscription(org.id, {
            plan,
            subscriptionStatus: sub.status,
            stripeSubscriptionId: sub.id,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const org = await getOrgByStripeCustomerId(sub.customer);
        if (org) {
          // Keep the plan label for history; status gates access.
          await updateOrgSubscription(org.id, {
            subscriptionStatus: "canceled",
            stripeSubscriptionId: null,
          });
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const org = await getOrgByStripeCustomerId(inv.customer);
        if (org && inv.id) {
          await recordInvoice({
            orgId: org.id,
            stripeInvoiceId: inv.id,
            amountDue: inv.amount_due,
            currency: inv.currency,
            status: inv.status,
            hostedUrl: inv.hosted_invoice_url,
            pdfUrl: inv.invoice_pdf,
          });
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] failed handling ${event.type}:`, err);
    // 500 tells Stripe to retry (transient DB issues, etc.).
    return new Response("Webhook handler error", { status: 500 });
  }

  return Response.json({ received: true });
}
