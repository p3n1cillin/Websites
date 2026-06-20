import { revalidatePath } from "next/cache";
import type { ClientRetainer, RetainerStatus } from "./types";
import { sbSelect, sbInsert, sbUpdate, supabaseWritable } from "./supabase/client";

/**
 * Client-retainers data layer (Agency OS — revenue-truth layer). A retainer is the
 * real, agreed monthly recurring fee for a WON client. The Command Center sums
 * ACTIVE retainers as true MRR (not "won count × £39"), so the £1,000/mo goal
 * reflects what's actually live and drops on churn.
 *
 * EVERYTHING here is best-effort and NEVER throws: a missing `client_retainers`
 * table (before migration 0012) or any transient failure degrades to "no
 * retainers" so the dashboard falls back to its projection — nothing breaks.
 */

/** Default monthly fee when a deal is won without an explicit agreed amount. */
export const DEFAULT_RETAINER_PENCE = 3900; // £39/mo care plan

interface Row {
  id: string;
  org_id: string;
  prospect_id: string | null;
  business_id: string | null;
  name: string;
  monthly_pence: number;
  status: RetainerStatus;
  note: string | null;
  started_at: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLS =
  "select=id,org_id,prospect_id,business_id,name,monthly_pence,status,note,started_at,cancelled_at,created_at,updated_at";

function toRetainer(row: Row): ClientRetainer {
  return {
    id: row.id,
    orgId: row.org_id,
    prospectId: row.prospect_id,
    businessId: row.business_id,
    name: row.name,
    monthlyPence: row.monthly_pence,
    status: row.status,
    note: row.note,
    startedAt: row.started_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Sum of ACTIVE retainer fees, pence — the true MRR. Pure + dependency-free. */
export function activeMrrPence(retainers: ClientRetainer[]): number {
  return retainers
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + r.monthlyPence, 0);
}

/** All retainers for an org (newest first). Returns [] on any failure. */
export async function getRetainersForOrg(orgId: string): Promise<ClientRetainer[]> {
  if (!supabaseWritable) return [];
  try {
    const rows = await sbSelect<Row>({
      query: `client_retainers?${COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
      tier: "service",
    });
    return rows.map(toRetainer);
  } catch {
    return [];
  }
}

export async function getRetainerRecord(id: string): Promise<ClientRetainer | null> {
  try {
    const rows = await sbSelect<Row>({
      query: `client_retainers?${COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
      tier: "service",
    });
    return rows[0] ? toRetainer(rows[0]) : null;
  } catch {
    return null;
  }
}

async function getRetainerForProspect(prospectId: string): Promise<ClientRetainer | null> {
  try {
    const rows = await sbSelect<Row>({
      query: `client_retainers?${COLS}&prospect_id=eq.${encodeURIComponent(prospectId)}&limit=1`,
      tier: "service",
    });
    return rows[0] ? toRetainer(rows[0]) : null;
  } catch {
    return null;
  }
}

export interface EnsureRetainerInput {
  orgId: string;
  name: string;
  prospectId?: string | null;
  businessId?: string | null;
  monthlyPence?: number;
}

/**
 * Idempotent: open a retainer for a won deal, or return the existing one for that
 * prospect. Called from every "deal won" path — best-effort, never blocks the win.
 */
export async function ensureRetainerForWonDeal(
  input: EnsureRetainerInput
): Promise<ClientRetainer | null> {
  if (!supabaseWritable) return null;
  try {
    if (input.prospectId) {
      const existing = await getRetainerForProspect(input.prospectId);
      if (existing) return existing;
    }
    const row = await sbInsert<Row>("client_retainers", {
      org_id: input.orgId,
      prospect_id: input.prospectId ?? null,
      business_id: input.businessId ?? null,
      name: input.name,
      monthly_pence: Math.max(0, Math.round(input.monthlyPence ?? DEFAULT_RETAINER_PENCE)),
      status: "active",
    });
    revalidatePath("/admin/customers");
    revalidatePath("/admin");
    return toRetainer(row);
  } catch {
    return null;
  }
}

export async function setRetainerStatus(id: string, status: RetainerStatus): Promise<void> {
  try {
    await sbUpdate("client_retainers", `id=eq.${encodeURIComponent(id)}`, {
      status,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
    });
    revalidatePath("/admin/customers");
    revalidatePath("/admin");
  } catch {
    /* best-effort */
  }
}

export async function setRetainerAmount(id: string, monthlyPence: number): Promise<void> {
  try {
    await sbUpdate("client_retainers", `id=eq.${encodeURIComponent(id)}`, {
      monthly_pence: Math.max(0, Math.round(monthlyPence)),
    });
    revalidatePath("/admin/customers");
    revalidatePath("/admin");
  } catch {
    /* best-effort */
  }
}
