/**
 * Minimal Stripe access over `fetch` — no `stripe` npm package, matching the
 * project's zero-dependency philosophy.
 *
 *  - The REST API is form-encoded (application/x-www-form-urlencoded). `toForm`
 *    flattens nested objects/arrays into Stripe's `a[b][0][c]` bracket syntax.
 *  - Webhook signatures are verified with Node's `crypto` (HMAC-SHA256 +
 *    constant-time compare), the same scheme the official SDK uses.
 *
 * Everything degrades gracefully: with no STRIPE_SECRET_KEY the billing UI shows
 * a "not configured" notice and the rest of the app is unaffected.
 */

import crypto from "node:crypto";

const SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const API = "https://api.stripe.com/v1";

/** Stripe is usable (secret key present). */
export const stripeConfigured = Boolean(SECRET);

// ---------------------------------------------------------------------------
// Form encoding (Stripe expects bracketed keys for nested params).
// ---------------------------------------------------------------------------
function toForm(obj: Record<string, unknown>): URLSearchParams {
  const sp = new URLSearchParams();
  const walk = (val: unknown, key: string): void => {
    if (val === undefined || val === null) return;
    if (Array.isArray(val)) {
      val.forEach((v, i) => walk(v, `${key}[${i}]`));
    } else if (typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        walk(v, key ? `${key}[${k}]` : k);
      }
    } else {
      sp.append(key, String(val));
    }
  };
  walk(obj, "");
  return sp;
}

async function stripeRequest<T>(
  path: string,
  params?: Record<string, unknown>,
  method: "GET" | "POST" = "POST"
): Promise<T> {
  if (!SECRET) throw new Error("STRIPE_SECRET_KEY is not set.");
  const isGet = method === "GET";
  const body = !isGet && params ? toForm(params).toString() : undefined;
  const url = isGet && params ? `${API}${path}?${toForm(params).toString()}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Stripe ${method} ${path} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// API calls used by the billing flow.
// ---------------------------------------------------------------------------
export async function createCustomer(input: {
  email: string;
  name?: string;
  orgId: string;
}): Promise<{ id: string }> {
  return stripeRequest("/customers", {
    email: input.email,
    name: input.name,
    metadata: { orgId: input.orgId },
  });
}

export async function createCheckoutSession(input: {
  customerId: string;
  priceId: string;
  orgId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  return stripeRequest("/checkout/sessions", {
    mode: "subscription",
    customer: input.customerId,
    client_reference_id: input.orgId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    subscription_data: { metadata: { orgId: input.orgId } },
    allow_promotion_codes: true,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
}

/**
 * Combined Checkout for a CLIENT accepting a proposal: starts a recurring monthly
 * care-plan SUBSCRIPTION and charges the one-off build fee on the first invoice —
 * one payment, money now + recurring after. Inline price_data (no pre-created
 * prices). Metadata lets the webhook + success route close the deal and link the sub.
 */
export async function createRetainerCheckout(input: {
  buildFeePence: number;
  monthlyPence: number;
  productName: string;
  proposalId: string;
  orgId: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const lineItems: Record<string, unknown>[] = [
    {
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: input.monthlyPence,
        recurring: { interval: "month" },
        product_data: { name: `${input.productName} — care plan` },
      },
    },
  ];
  // Build fee as a one-time line item on the first invoice (skip if zero).
  if (input.buildFeePence > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: input.buildFeePence,
        product_data: { name: `${input.productName} — build` },
      },
    });
  }
  return stripeRequest("/checkout/sessions", {
    mode: "subscription",
    customer_email: input.customerEmail || undefined,
    client_reference_id: input.orgId,
    line_items: lineItems,
    subscription_data: {
      metadata: { kind: "retainer", proposalId: input.proposalId, orgId: input.orgId },
    },
    metadata: {
      kind: "proposal",
      proposalId: input.proposalId,
      orgId: input.orgId,
      monthlyPence: String(input.monthlyPence),
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<{ url: string }> {
  return stripeRequest("/billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function getSubscription(id: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(`/subscriptions/${id}`, undefined, "GET");
}

/** Retrieve a Checkout session — used to confirm payment on the success redirect. */
export async function getCheckoutSession(id: string): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(`/checkout/sessions/${id}`, undefined, "GET");
}

// ---------------------------------------------------------------------------
// Webhook signature verification.
// ---------------------------------------------------------------------------
const SIGNATURE_TOLERANCE_S = 5 * 60;

/**
 * Verify a Stripe webhook signature and return the parsed event, or null if the
 * signature is missing/invalid. Mirrors Stripe's `constructEvent`.
 */
export function verifyStripeEvent(
  payload: string,
  signatureHeader: string | null
): StripeEvent | null {
  if (!WEBHOOK_SECRET || !signatureHeader) return null;

  const parts: Record<string, string> = {};
  for (const item of signatureHeader.split(",")) {
    const [k, v] = item.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return null;

  // Reject stale signatures (replay protection).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_S) return null;

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(payload) as StripeEvent;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Narrow types for the events/objects we actually read.
// ---------------------------------------------------------------------------
export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, any> };
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  items: { data: Array<{ price: { id: string } }> };
}

export interface StripeCheckoutSession {
  id: string;
  payment_status: string;
  amount_total: number | null;
  metadata: Record<string, string> | null;
  subscription: string | null;
  customer: string | null;
}
