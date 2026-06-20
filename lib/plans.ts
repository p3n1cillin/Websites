/**
 * Subscription plan catalogue + entitlement logic.
 *
 * Plans are defined here (not in Stripe) so the UI, the paywall and the webhook
 * all agree on what each tier allows. Stripe only holds the *prices*: each paid
 * plan maps to a Stripe Price id supplied via env, so you can change pricing in
 * the Stripe dashboard without a redeploy.
 */

import type { Org, Plan } from "./types";

export interface PlanDef {
  id: Exclude<Plan, "trial">;
  name: string;
  /** Display price, e.g. "£19/mo". */
  price: string;
  /** Max number of businesses (websites) this plan can own. */
  businessLimit: number;
  blurb: string;
  features: string[];
  /** Name of the env var holding this plan's Stripe Price id. */
  priceIdEnv: "STRIPE_PRICE_BASIC" | "STRIPE_PRICE_PRO" | "STRIPE_PRICE_PREMIUM";
}

/** The purchasable plans, in upgrade order. */
export const PAID_PLANS: PlanDef[] = [
  {
    id: "basic",
    name: "Basic",
    price: "£19/mo",
    businessLimit: 1,
    blurb: "One professional site for a single business.",
    features: [
      "1 published website",
      "Lead inbox + email notifications",
      "On-demand content updates",
      "Local SEO schema & sitemap",
    ],
    priceIdEnv: "STRIPE_PRICE_BASIC",
  },
  {
    id: "pro",
    name: "Pro",
    price: "£49/mo",
    businessLimit: 5,
    blurb: "For multi-location operators and small agencies.",
    features: [
      "Up to 5 published websites",
      "Everything in Basic",
      "Priority lead routing",
      "Custom domains",
    ],
    priceIdEnv: "STRIPE_PRICE_PRO",
  },
  {
    id: "premium",
    name: "Premium",
    price: "£149/mo",
    businessLimit: 50,
    blurb: "Agency scale across many towns and cities.",
    features: [
      "Up to 50 published websites",
      "Everything in Pro",
      "Automated SEO blog engine",
      "White-glove onboarding",
    ],
    priceIdEnv: "STRIPE_PRICE_PREMIUM",
  },
];

/** Business limit per plan (trial mirrors Basic). */
export const PLAN_LIMITS: Record<Plan, number> = {
  trial: 1,
  basic: 1,
  pro: 5,
  premium: 50,
};

/**
 * Custom domains are a Pro+ feature (see the plan feature lists). Trial and
 * Basic publish on the platform host only.
 */
export function customDomainsAllowed(plan: Plan): boolean {
  return plan === "pro" || plan === "premium";
}

/** The Stripe Price id configured for a paid plan, or undefined if unset. */
export function priceIdFor(plan: string | null | undefined): string | undefined {
  const def = PAID_PLANS.find((p) => p.id === plan);
  return def ? process.env[def.priceIdEnv] : undefined;
}

/** Reverse lookup: which plan does a Stripe Price id correspond to? */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  const def = PAID_PLANS.find((p) => process.env[p.priceIdEnv] === priceId);
  return def ? def.id : null;
}

export interface Entitlement {
  /** Whether the org may currently create/publish (trial valid or subscription live). */
  active: boolean;
  /** How many businesses the org is allowed. */
  businessLimit: number;
  /** Short human reason when inactive (for paywall copy). */
  reason?: string;
}

/**
 * What an org is currently entitled to. Trials are active until they expire;
 * paid plans are active while Stripe reports `active` or `trialing`.
 */
export function orgEntitlement(org: Org): Entitlement {
  const businessLimit = PLAN_LIMITS[org.plan] ?? 1;

  if (org.plan === "trial") {
    const ends = org.trialEndsAt ? new Date(org.trialEndsAt).getTime() : 0;
    const active = ends > Date.now();
    return {
      active,
      businessLimit,
      reason: active ? undefined : "Your free trial has ended.",
    };
  }

  const active =
    org.subscriptionStatus === "active" || org.subscriptionStatus === "trialing";
  return {
    active,
    businessLimit,
    reason: active ? undefined : "Your subscription is not active.",
  };
}
