"use server";

import { redirect } from "next/navigation";
import { createOneOffCheckout, stripeConfigured } from "@/lib/stripe";
import { aiConfigured } from "@/lib/ai/client";
import { SITE_URL } from "@/lib/seo";
import { KIT_PRODUCT_NAME, TIERS, isTier, parseKitInput, toMetadata } from "@/lib/kit/catalog";

export interface OrderState {
  error?: string;
}

/**
 * Validate the order form and send the buyer to Stripe Checkout. Inputs ride in
 * the session metadata; the success URL is the buyer's permanent kit page.
 */
export async function startKitCheckout(_prev: OrderState, form: FormData): Promise<OrderState> {
  if (!stripeConfigured || !aiConfigured) {
    return { error: "Checkout is temporarily unavailable. Please try again shortly." };
  }
  if (form.get("company_site")) return { error: "Something went wrong." }; // honeypot

  const tierRaw = String(form.get("tier") ?? "complete");
  const tier = isTier(tierRaw) ? tierRaw : "complete";
  const raw = Object.fromEntries(form.entries());
  const parsed = parseKitInput(raw);
  if (!parsed.ok || !parsed.input) return { error: parsed.error };

  const email = String(form.get("email") ?? "").trim().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email so we can send your kit." };
  if (form.get("consent") !== "on") {
    return { error: "Please tick the box to confirm instant delivery." };
  }

  const t = TIERS[tier];
  let url: string;
  try {
    const session = await createOneOffCheckout({
      amountPence: t.pricePence,
      productName: `${KIT_PRODUCT_NAME}: ${t.name}`,
      productDescription: `Google Business Profile content kit for ${parsed.input.businessName}, delivered instantly.`,
      metadata: toMetadata(parsed.input, tier),
      customerEmail: email,
      successUrl: `${SITE_URL}/kit/{CHECKOUT_SESSION_ID}`,
      cancelUrl: `${SITE_URL}/map-pack-kit?cancelled=1#order`,
    });
    url = session.url;
  } catch (err) {
    console.error("[kit] checkout failed:", err);
    return { error: "We couldn't start checkout. Please try again." };
  }
  redirect(url);
}
