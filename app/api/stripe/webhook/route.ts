import { verifyStripeEvent, getSubscription } from "@/lib/stripe";
import { planForPriceId } from "@/lib/plans";
import {
  getOrgByStripeCustomerId,
  updateOrgSubscription,
  recordInvoice,
} from "@/lib/orgs";
import { closePaidProposal } from "@/lib/payments";
import { getRetainerBySubscriptionId, setRetainerStatus } from "@/lib/retainers";

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

        // Digital product: Map Pack Kit instant purchase
        if (s.metadata?.kind === "map_pack_kit") {
          const { getPaidKitOrder, fulfilSection } = await import("@/lib/kit/order");
          const order = await getPaidKitOrder(s.id);
          if (order) {
            await fulfilSection(order, "profile").catch((err) =>
              console.error("[kit-webhook] profile fulfilment error:", err)
            );
          }
          break;
        }

        // Client paying an agency PROPOSAL (our revenue) — close the deal + bank it.
        // Subscription checkouts settle with a subscription id (payment_status may be
        // "paid" or "no_payment_required"); either closes the deal.
        if (s.metadata?.kind === "proposal" && s.metadata?.proposalId &&
            (s.payment_status === "paid" || s.subscription)) {
          await closePaidProposal(s.metadata.proposalId, {
            subscriptionId: s.subscription ?? null,
            customerId: s.customer ?? null,
            monthlyPence: Number(s.metadata.monthlyPence) || undefined,
          });
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

        // Client CARE-PLAN subscription? Keep the retainer's status (and thus MRR) honest.
        const retainer = await getRetainerBySubscriptionId(sub.id);
        if (retainer) {
          const active = sub.status === "active" || sub.status === "trialing";
          const next = active ? "active" : sub.status === "canceled" ? "cancelled" : "paused";
          if (retainer.status !== next) await setRetainerStatus(retainer.id, next);
          break; // a client retainer, not an org SaaS subscription
        }

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

        // Client care-plan cancelled → cancel the retainer (drops MRR honestly).
        const retainer = await getRetainerBySubscriptionId(sub.id);
        if (retainer) {
          if (retainer.status !== "cancelled") await setRetainerStatus(retainer.id, "cancelled");
          break;
        }

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
