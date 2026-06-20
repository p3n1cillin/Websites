import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { CustomerPortal, CustomerPortalStatus } from "./types";
import { sbSelect, sbInsert, sbUpdate } from "./supabase/client";

/**
 * Customer-portal data layer (Agency OS — Phase F). A `customer_portal` is the
 * tokenised, capability-based door for an onboarded customer to view their site
 * and submit change requests at /portal/[token] — no login, the opaque token IS
 * the authorization (read server-side with the service role, like site_previews).
 * One portal per business; the Onboarding agent (9) opens it on a won deal.
 */

/** An opaque, unguessable URL-safe portal token. */
export function generatePortalToken(): string {
  return randomBytes(24).toString("base64url");
}

interface PortalRow {
  id: string;
  org_id: string;
  business_id: string;
  prospect_id: string | null;
  portal_token: string;
  status: CustomerPortalStatus;
  created_at: string;
  updated_at: string;
}

const PORTAL_COLS =
  "select=id,org_id,business_id,prospect_id,portal_token,status,created_at,updated_at";

function toPortal(row: PortalRow): CustomerPortal {
  return {
    id: row.id,
    orgId: row.org_id,
    businessId: row.business_id,
    prospectId: row.prospect_id,
    token: row.portal_token,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPortalForBusiness(businessId: string): Promise<CustomerPortal | null> {
  const rows = await sbSelect<PortalRow>({
    query: `customer_portals?${PORTAL_COLS}&business_id=eq.${encodeURIComponent(businessId)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toPortal(rows[0]) : null;
}

export interface CreatePortalInput {
  orgId: string;
  businessId: string;
  prospectId?: string | null;
}

/** Idempotent: returns the existing portal for the business, or opens a new one. */
export async function ensureCustomerPortal(input: CreatePortalInput): Promise<CustomerPortal> {
  const existing = await getPortalForBusiness(input.businessId);
  if (existing) return existing;
  const row = await sbInsert<PortalRow>("customer_portals", {
    org_id: input.orgId,
    business_id: input.businessId,
    prospect_id: input.prospectId ?? null,
    portal_token: generatePortalToken(),
    status: "active",
  });
  revalidatePath("/admin/customers");
  return toPortal(row);
}

/** The portal opened from a given prospect, if it's already been onboarded. */
export async function getPortalForProspect(prospectId: string): Promise<CustomerPortal | null> {
  const rows = await sbSelect<PortalRow>({
    query: `customer_portals?${PORTAL_COLS}&prospect_id=eq.${encodeURIComponent(prospectId)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toPortal(rows[0]) : null;
}

export async function getPortalsForOrg(orgId: string): Promise<CustomerPortal[]> {
  const rows = await sbSelect<PortalRow>({
    query: `customer_portals?${PORTAL_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toPortal);
}

export async function getPortalRecord(id: string): Promise<CustomerPortal | null> {
  const rows = await sbSelect<PortalRow>({
    query: `customer_portals?${PORTAL_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toPortal(rows[0]) : null;
}

/** Public capability read for /portal/[token]; null unless active. */
export async function getActivePortalByToken(token: string): Promise<CustomerPortal | null> {
  if (!token) return null;
  // Public route: degrade to "not found" (not a 500) when Supabase isn't
  // configured or the read fails — an unverifiable token has no portal.
  try {
    const rows = await sbSelect<PortalRow>({
      query: `customer_portals?${PORTAL_COLS}&portal_token=eq.${encodeURIComponent(token)}&status=eq.active&limit=1`,
      tier: "service",
    });
    return rows[0] ? toPortal(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function setPortalStatus(id: string, status: CustomerPortalStatus): Promise<void> {
  await sbUpdate("customer_portals", `id=eq.${encodeURIComponent(id)}`, { status });
  revalidatePath("/admin/customers");
}
