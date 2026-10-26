"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, requireOrg } from "@/lib/auth";
import { priceIdFor } from "@/lib/plans";
import {
  stripeConfigured,
  createCustomer,
  createCheckoutSession,
  createPortalSession,
} from "@/lib/stripe";
import { setOrgStripeCustomer } from "@/lib/orgs";

/** Absolute base URL for Stripe redirect targets. */
async function baseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Start a Stripe Checkout session for the chosen plan and redirect to it. */
export async function startCheckout(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const plan = formData.get("plan") as string;
  const priceId = priceIdFor(plan);

  if (!stripeConfigured || !priceId) {
    redirect("/admin/billing?error=stripe");
  }

  // Ensure the org has a Stripe customer.
  let customerId = org.stripeCustomerId ?? undefined;
  let url: string;
  try {
    if (!customerId) {
      const user = await getCurrentUser();
      const customer = await createCustomer({
        email: user?.email ?? "",
        name: org.name,
        orgId: org.id,
      });
      customerId = customer.id;
      await setOrgStripeCustomer(org.id, customerId);
    }

    const base = await baseUrl();
    const session = await createCheckoutSession({
      customerId,
      priceId: priceId!,
      orgId: org.id,
      successUrl: `${base}/admin/billing?success=1`,
      cancelUrl: `${base}/admin/billing?canceled=1`,
    });
    url = session.url;
  } catch (err) {
    console.error("[billing] checkout failed:", err);
    redirect("/admin/billing?error=checkout");
  }

  redirect(url);
}

/** Open the Stripe Customer Portal (manage/cancel/update payment method). */
export async function openPortal(): Promise<void> {
  const org = await requireOrg();
  if (!stripeConfigured || !org.stripeCustomerId) {
    redirect("/admin/billing?error=portal");
  }

  let url: string;
  try {
    const base = await baseUrl();
    const session = await createPortalSession(org.stripeCustomerId!, `${base}/admin/billing`);
    url = session.url;
  } catch (err) {
    console.error("[billing] portal failed:", err);
    redirect("/admin/billing?error=portal");
  }

  redirect(url);
}
