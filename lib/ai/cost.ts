/**
 * AI cost ledger — the source of truth for spend caps and the cost view in the
 * Agent Control Centre. A daily rollup per org (ai_cost_ledger), incremented
 * atomically after every AI call via the add_ai_cost() SQL function (0002).
 *
 * All access is service role: the job worker and webhook callers have no user
 * session. Degrades gracefully when Supabase isn't writable (no persistence;
 * caps simply aren't enforced — matching the rest of the app's optional-DB model).
 */

import { sbSelect, supabaseWritable } from "../supabase/client";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Record spend for an org against today's rollup (atomic upsert via RPC). */
export async function addAiCost(orgId: string, costPence: number, runs = 0): Promise<void> {
  if (!supabaseWritable || !URL || !SERVICE) return;
  if (costPence <= 0 && runs <= 0) return;
  const res = await fetch(`${URL}/rest/v1/rpc/add_ai_cost`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_org: orgId, p_cost: Math.ceil(costPence), p_runs: runs }),
    cache: "no-store",
  });
  // Best-effort: a failed ledger write must not break the agent run itself.
  if (!res.ok && process.env.NODE_ENV !== "production") {
    console.warn(`add_ai_cost failed (${res.status}): ${await res.text().catch(() => "")}`);
  }
}

interface LedgerRow {
  day: string;
  cost_pence: number;
  run_count: number;
}

/** Today's spend (pence) for an org. */
export async function getCostToday(orgId: string): Promise<number> {
  if (!supabaseWritable) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const rows = await sbSelect<LedgerRow>({
    query: `ai_cost_ledger?select=cost_pence&org_id=eq.${encodeURIComponent(orgId)}&day=eq.${today}&limit=1`,
    tier: "service",
  });
  return rows[0]?.cost_pence ?? 0;
}

/** Rolling 30-day spend (pence) for an org. */
export async function getCostThisMonth(orgId: string): Promise<number> {
  if (!supabaseWritable) return 0;
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const rows = await sbSelect<LedgerRow>({
    query: `ai_cost_ledger?select=cost_pence&org_id=eq.${encodeURIComponent(orgId)}&day=gte.${since}`,
    tier: "service",
  });
  return rows.reduce((sum, r) => sum + (r.cost_pence ?? 0), 0);
}

/** Per-day spend series for charts (most recent first). */
export async function getCostSeries(orgId: string, days = 30): Promise<LedgerRow[]> {
  if (!supabaseWritable) return [];
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return sbSelect<LedgerRow>({
    query: `ai_cost_ledger?select=day,cost_pence,run_count&org_id=eq.${encodeURIComponent(orgId)}&day=gte.${since}&order=day.desc`,
    tier: "service",
  });
}
