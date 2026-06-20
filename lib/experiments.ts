import { revalidatePath } from "next/cache";
import type {
  Experiment,
  ExperimentSlot,
  ExperimentStatus,
  ExperimentVariant,
} from "./types";
import { sbSelect, sbInsert, sbUpdate, sbDelete } from "./supabase/client";

/**
 * A/B experiment data layer + pure analysis (Agency OS — Phase G). The Conversion
 * agent (6) creates experiments; the public site reads the running one and the
 * /api/experiments/* routes bump counters. Counters are read-modify-write at the
 * app layer (impressions deduped per visitor client-side); fine at this scale.
 */

// ===========================================================================
// PURE — variant assignment + winner analysis.
// ===========================================================================

/** Minimum impressions on the leader before we call a result (a rough guard). */
export const MIN_IMPRESSIONS_TO_DECIDE = 30;

export interface WinnerAnalysis {
  leaderId: string | null;
  /** Leader conversion rate 0–1. */
  leaderRate: number;
  /** Control conversion rate 0–1, for the lift comparison. */
  controlRate: number;
  /** Relative lift of the leader over control (e.g. 0.25 = +25%). */
  lift: number;
  enoughData: boolean;
  note: string;
}

function rate(v: ExperimentVariant): number {
  return v.impressions > 0 ? v.conversions / v.impressions : 0;
}

/** Deterministic leader pick by conversion rate, with a "enough data?" guard. */
export function analyseExperiment(variants: ExperimentVariant[]): WinnerAnalysis {
  const control = variants.find((v) => v.control) ?? variants[0];
  const controlRate = control ? rate(control) : 0;
  let leader: ExperimentVariant | null = null;
  for (const v of variants) {
    if (!leader || rate(v) > rate(leader)) leader = v;
  }
  const leaderRate = leader ? rate(leader) : 0;
  const lift = controlRate > 0 ? (leaderRate - controlRate) / controlRate : leaderRate > 0 ? 1 : 0;
  const enoughData = Boolean(leader && leader.impressions >= MIN_IMPRESSIONS_TO_DECIDE);

  let note: string;
  if (!leader || variants.every((v) => v.impressions === 0)) {
    note = "No data yet — leave it running to gather impressions.";
  } else if (!enoughData) {
    note = `Only ${leader.impressions} impressions on the leader — keep running (aim for ${MIN_IMPRESSIONS_TO_DECIDE}+).`;
  } else if (leader.control || lift <= 0) {
    note = "The original is still winning — no change recommended.";
  } else {
    note = `"${leader.label}" is converting ${Math.round(lift * 100)}% better than the original.`;
  }

  return { leaderId: leader?.id ?? null, leaderRate, controlRate, lift, enoughData, note };
}

// ===========================================================================
// DATA LAYER (service role — org-scoped at the app layer).
// ===========================================================================

interface ExperimentRow {
  id: string;
  org_id: string;
  business_id: string;
  slot: ExperimentSlot;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  winner: string | null;
  created_at: string;
  updated_at: string;
}

const COLS = "select=id,org_id,business_id,slot,status,variants,winner,created_at,updated_at";

function toExperiment(row: ExperimentRow): Experiment {
  return {
    id: row.id,
    orgId: row.org_id,
    businessId: row.business_id,
    slot: row.slot,
    status: row.status,
    variants: Array.isArray(row.variants) ? row.variants : [],
    winner: row.winner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateExperimentInput {
  orgId: string;
  businessId: string;
  slot: ExperimentSlot;
  variants: ExperimentVariant[];
}

export async function createExperiment(input: CreateExperimentInput): Promise<Experiment> {
  const row = await sbInsert<ExperimentRow>("experiments", {
    org_id: input.orgId,
    business_id: input.businessId,
    slot: input.slot,
    status: "running",
    variants: input.variants,
  });
  revalidatePath("/admin/growth");
  return toExperiment(row);
}

export async function getExperimentsForOrg(orgId: string): Promise<Experiment[]> {
  const rows = await sbSelect<ExperimentRow>({
    query: `experiments?${COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toExperiment);
}

export async function getExperimentsForBusiness(businessId: string): Promise<Experiment[]> {
  const rows = await sbSelect<ExperimentRow>({
    query: `experiments?${COLS}&business_id=eq.${encodeURIComponent(businessId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toExperiment);
}

export async function getExperimentRecord(id: string): Promise<Experiment | null> {
  const rows = await sbSelect<ExperimentRow>({
    query: `experiments?${COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toExperiment(rows[0]) : null;
}

/** The running experiment for a business + slot (the one the live site serves). */
export async function getRunningExperiment(
  businessId: string,
  slot: ExperimentSlot
): Promise<Experiment | null> {
  const rows = await sbSelect<ExperimentRow>({
    query: `experiments?${COLS}&business_id=eq.${encodeURIComponent(businessId)}&slot=eq.${slot}&status=eq.running&order=created_at.desc&limit=1`,
    tier: "service",
  });
  return rows[0] ? toExperiment(rows[0]) : null;
}

export async function updateExperiment(
  id: string,
  patch: { variants?: ExperimentVariant[]; status?: ExperimentStatus; winner?: string | null }
): Promise<Experiment> {
  const fields: Record<string, unknown> = {};
  if (patch.variants !== undefined) fields.variants = patch.variants;
  if (patch.status !== undefined) fields.status = patch.status;
  if (patch.winner !== undefined) fields.winner = patch.winner;
  const [row] = await sbUpdate<ExperimentRow>("experiments", `id=eq.${encodeURIComponent(id)}`, fields);
  if (!row) throw new Error(`Experiment ${id} not found.`);
  revalidatePath("/admin/growth");
  return toExperiment(row);
}

/**
 * Best-effort counter bump (read-modify-write). Used by the public tracking
 * routes; never throws (a lost beacon must not error a pageview or a lead).
 */
export async function incrementMetric(
  experimentId: string,
  variantId: string,
  metric: "impressions" | "conversions"
): Promise<void> {
  try {
    const exp = await getExperimentRecord(experimentId);
    if (!exp || exp.status !== "running") return;
    const variants = exp.variants.map((v) =>
      v.id === variantId ? { ...v, [metric]: (v[metric] ?? 0) + 1 } : v
    );
    await sbUpdate("experiments", `id=eq.${encodeURIComponent(experimentId)}`, { variants });
  } catch {
    /* ignore */
  }
}

export async function deleteExperiment(id: string): Promise<void> {
  await sbDelete("experiments", `id=eq.${encodeURIComponent(id)}`);
  revalidatePath("/admin/growth");
}
