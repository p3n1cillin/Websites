/**
 * Service-role org + invoice access.
 *
 * The Stripe webhook runs with no user session, so it can't use the cookie-bound
 * authed client in lib/auth.ts (which is RLS-scoped to the signed-in user).
 * These helpers use the service-role PostgREST client to read/update any org by
 * its Stripe identifiers and to mirror invoices for the billing dashboard.
 */

import type { Invoice, Org, Plan } from "./types";
import { sbSelect, sbUpdate, sbInsert } from "./supabase/client";

interface OrgRow {
  id: string;
  name: string;
  owner_user_id: string;
  plan: Plan;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
}

function toOrg(row: OrgRow): Org {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    subscriptionStatus: row.subscription_status,
  };
}

const ORG_COLS =
  "select=id,name,owner_user_id,plan,trial_ends_at,stripe_customer_id,stripe_subscription_id,subscription_status";

export async function getOrgById(id: string): Promise<Org | null> {
  const rows = await sbSelect<OrgRow>({
    query: `orgs?${ORG_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toOrg(rows[0]) : null;
}

export async function getOrgByStripeCustomerId(customerId: string): Promise<Org | null> {
  const rows = await sbSelect<OrgRow>({
    query: `orgs?${ORG_COLS}&stripe_customer_id=eq.${encodeURIComponent(customerId)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toOrg(rows[0]) : null;
}

/** Link an org to its Stripe customer (set once, before the first checkout). */
export async function setOrgStripeCustomer(orgId: string, customerId: string): Promise<void> {
  await sbUpdate<OrgRow>("orgs", `id=eq.${encodeURIComponent(orgId)}`, {
    stripe_customer_id: customerId,
  });
}

/** Sync subscription state from Stripe onto the org (webhook-driven). */
export async function updateOrgSubscription(
  orgId: string,
  patch: {
    plan?: Plan;
    subscriptionStatus?: string;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string;
  }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.plan !== undefined) row.plan = patch.plan;
  if (patch.subscriptionStatus !== undefined) row.subscription_status = patch.subscriptionStatus;
  if (patch.stripeSubscriptionId !== undefined) row.stripe_subscription_id = patch.stripeSubscriptionId;
  if (patch.stripeCustomerId !== undefined) row.stripe_customer_id = patch.stripeCustomerId;
  if (Object.keys(row).length === 0) return;
  await sbUpdate<OrgRow>("orgs", `id=eq.${encodeURIComponent(orgId)}`, row);
}

// ---------------------------------------------------------------------------
// Invoices (mirrored from Stripe for the billing dashboard).
// ---------------------------------------------------------------------------
interface InvoiceRow {
  id: string;
  org_id: string;
  stripe_invoice_id: string | null;
  amount_due: number | null;
  currency: string;
  status: string | null;
  hosted_url: string | null;
  pdf_url: string | null;
  created_at: string;
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    orgId: row.org_id,
    stripeInvoiceId: row.stripe_invoice_id,
    amountDue: row.amount_due,
    currency: row.currency,
    status: row.status,
    hostedUrl: row.hosted_url,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at,
  };
}

const INVOICE_COLS =
  "select=id,org_id,stripe_invoice_id,amount_due,currency,status,hosted_url,pdf_url,created_at";

export async function getInvoicesForOrg(orgId: string): Promise<Invoice[]> {
  const rows = await sbSelect<InvoiceRow>({
    query: `invoices?${INVOICE_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc&limit=24`,
    tier: "service",
  });
  return rows.map(toInvoice);
}

interface RecordInvoiceInput {
  orgId: string;
  stripeInvoiceId: string;
  amountDue?: number | null;
  currency?: string;
  status?: string | null;
  hostedUrl?: string | null;
  pdfUrl?: string | null;
}

/** Upsert an invoice by its Stripe id (webhook may fire more than once). */
export async function recordInvoice(input: RecordInvoiceInput): Promise<void> {
  const patch = {
    org_id: input.orgId,
    amount_due: input.amountDue ?? null,
    currency: input.currency ?? "gbp",
    status: input.status ?? null,
    hosted_url: input.hostedUrl ?? null,
    pdf_url: input.pdfUrl ?? null,
  };

  const existing = await sbSelect<InvoiceRow>({
    query: `invoices?select=id&stripe_invoice_id=eq.${encodeURIComponent(input.stripeInvoiceId)}&limit=1`,
    tier: "service",
  });

  if (existing[0]) {
    await sbUpdate<InvoiceRow>(
      "invoices",
      `stripe_invoice_id=eq.${encodeURIComponent(input.stripeInvoiceId)}`,
      patch
    );
  } else {
    await sbInsert<InvoiceRow>("invoices", {
      ...patch,
      stripe_invoice_id: input.stripeInvoiceId,
    });
  }
}
