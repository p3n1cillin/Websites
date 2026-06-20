import { revalidatePath } from "next/cache";
import type { ChangeRequest, ChangeRequestSource, ChangeRequestStatus } from "./types";
import { sbSelect, sbInsert, sbUpdate, sbDelete } from "./supabase/client";

/**
 * Change-request data layer (Agency OS — Phase F). Customers raise these from the
 * portal (source 'customer', via the public server action using the service role
 * with the org/business resolved from the portal token); operators triage them
 * from /admin/customers. All service role; org-scoped at the app layer.
 */

interface ChangeRequestRow {
  id: string;
  org_id: string;
  business_id: string;
  title: string;
  detail: string | null;
  status: ChangeRequestStatus;
  source: ChangeRequestSource;
  created_at: string;
  updated_at: string;
}

const CR_COLS = "select=id,org_id,business_id,title,detail,status,source,created_at,updated_at";

function toChangeRequest(row: ChangeRequestRow): ChangeRequest {
  return {
    id: row.id,
    orgId: row.org_id,
    businessId: row.business_id,
    title: row.title,
    detail: row.detail,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateChangeRequestInput {
  orgId: string;
  businessId: string;
  title: string;
  detail?: string | null;
  source?: ChangeRequestSource;
}

export async function createChangeRequest(input: CreateChangeRequestInput): Promise<ChangeRequest> {
  const row = await sbInsert<ChangeRequestRow>("change_requests", {
    org_id: input.orgId,
    business_id: input.businessId,
    title: input.title,
    detail: input.detail ?? null,
    source: input.source ?? "customer",
    status: "open",
  });
  revalidatePath("/admin/customers");
  return toChangeRequest(row);
}

export async function getChangeRequestsForOrg(orgId: string): Promise<ChangeRequest[]> {
  const rows = await sbSelect<ChangeRequestRow>({
    query: `change_requests?${CR_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toChangeRequest);
}

export async function getChangeRequestsForBusiness(businessId: string): Promise<ChangeRequest[]> {
  const rows = await sbSelect<ChangeRequestRow>({
    query: `change_requests?${CR_COLS}&business_id=eq.${encodeURIComponent(businessId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toChangeRequest);
}

export async function getChangeRequestRecord(id: string): Promise<ChangeRequest | null> {
  const rows = await sbSelect<ChangeRequestRow>({
    query: `change_requests?${CR_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toChangeRequest(rows[0]) : null;
}

export async function updateChangeRequestStatus(
  id: string,
  status: ChangeRequestStatus
): Promise<void> {
  await sbUpdate("change_requests", `id=eq.${encodeURIComponent(id)}`, { status });
  revalidatePath("/admin/customers");
}

export async function deleteChangeRequest(id: string): Promise<void> {
  await sbDelete("change_requests", `id=eq.${encodeURIComponent(id)}`);
  revalidatePath("/admin/customers");
}
