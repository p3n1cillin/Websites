import { revalidatePath } from "next/cache";
import type { Lead, LeadStatus, LeadType } from "./types";
import { sbSelect, sbInsert, sbUpdate } from "./supabase/client";
import { getBusinessesForOrg } from "./businesses";

/**
 * Leads data layer. Inserts come from the public enquiry endpoint (service
 * role); reads/updates come from the admin inbox, scoped to the caller's org.
 */

interface LeadRow {
  id: string;
  business_id: string;
  type: LeadType;
  name: string;
  email: string | null;
  phone: string;
  service: string | null;
  message: string | null;
  preferred_date: string | null;
  status: LeadStatus;
  source_path: string | null;
  created_at: string;
}

const SELECT_COLS =
  "select=id,business_id,type,name,email,phone,service,message,preferred_date,status,source_path,created_at";

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    businessId: row.business_id,
    type: row.type,
    name: row.name,
    email: row.email,
    phone: row.phone,
    service: row.service,
    message: row.message,
    preferredDate: row.preferred_date,
    status: row.status,
    sourcePath: row.source_path,
    createdAt: row.created_at,
  };
}

export interface CreateLeadInput {
  businessId: string;
  type: LeadType;
  name: string;
  email?: string | null;
  phone: string;
  service?: string | null;
  message?: string | null;
  preferredDate?: string | null;
  sourcePath?: string | null;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const row = await sbInsert<LeadRow>("leads", {
    business_id: input.businessId,
    type: input.type,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone,
    service: input.service ?? null,
    message: input.message ?? null,
    preferred_date: input.preferredDate ?? null,
    source_path: input.sourcePath ?? null,
  });
  return toLead(row);
}

/** All leads for an org's businesses, newest first, with business name/slug. */
export async function getLeadsForOrg(orgId: string): Promise<Lead[]> {
  const businesses = await getBusinessesForOrg(orgId);
  if (businesses.length === 0) return [];

  const byId = new Map(businesses.map((b) => [b.id, b]));
  const ids = businesses.map((b) => b.id).join(",");

  const rows = await sbSelect<LeadRow>({
    query: `leads?${SELECT_COLS}&business_id=in.(${ids})&order=created_at.desc`,
    tier: "service",
  });

  return rows.map((row) => {
    const lead = toLead(row);
    const biz = byId.get(row.business_id);
    return { ...lead, businessName: biz?.data.name, businessSlug: biz?.slug };
  });
}

/** All leads for one business, newest first (used by the customer report/portal). */
export async function getLeadsForBusiness(businessId: string): Promise<Lead[]> {
  const rows = await sbSelect<LeadRow>({
    query: `leads?${SELECT_COLS}&business_id=eq.${encodeURIComponent(businessId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toLead);
}

/** A single lead, for ownership checks. */
export async function getLeadRecord(id: string): Promise<Lead | null> {
  const rows = await sbSelect<LeadRow>({
    query: `leads?${SELECT_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toLead(rows[0]) : null;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  await sbUpdate<LeadRow>("leads", `id=eq.${encodeURIComponent(id)}`, { status });
  revalidatePath("/admin/leads");
}
