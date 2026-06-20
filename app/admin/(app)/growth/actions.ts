"use server";

import { requireOrg } from "@/lib/auth";
import { runAgent } from "@/lib/agents/runner";
import type { ConversionAgentInput, ConversionAgentOutput } from "@/lib/agents/conversion";
import type { SeoGrowthAgentInput, SeoGrowthAgentOutput } from "@/lib/agents/seo-growth";
import { getBusinessRecord } from "@/lib/businesses";
import {
  getExperimentRecord,
  updateExperiment,
  deleteExperiment,
  type WinnerAnalysis,
} from "@/lib/experiments";
import { EXPERIMENT_SLOTS, type ExperimentSlot } from "@/lib/types";

/** Propose + start an A/B test for a business slot (Conversion agent, propose). */
export async function createExperimentAction(
  businessId: string,
  slot: ExperimentSlot
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  if (!EXPERIMENT_SLOTS.includes(slot)) return { ok: false, error: "Invalid slot." };
  const record = await getBusinessRecord(businessId);
  if (!record || record.orgId !== org.id) return { ok: false, error: "Business not found." };

  const input: ConversionAgentInput = {
    business: record.data,
    businessId: record.id,
    slot,
    mode: "propose",
  };
  const res = await runAgent({
    kind: "conversion",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto",
    input,
  });
  if (res.status === "failed") return { ok: false, error: res.error || "Could not start test." };
  if (res.status === "blocked") return { ok: false, error: res.summary || "Spend cap reached." };
  return { ok: true };
}

/** Decide an experiment — applies a clear winner, else reports it's not ready. */
export async function analyseExperimentAction(
  experimentId: string
): Promise<{ ok: boolean; analysis?: WinnerAnalysis; applied?: boolean; error?: string }> {
  const org = await requireOrg();
  const exp = await getExperimentRecord(experimentId);
  if (!exp || exp.orgId !== org.id) return { ok: false, error: "Experiment not found." };
  const record = await getBusinessRecord(exp.businessId);
  if (!record) return { ok: false, error: "Business not found." };

  const input: ConversionAgentInput = {
    business: record.data,
    businessId: record.id,
    slot: exp.slot,
    mode: "analyse",
    experiment: exp,
  };
  const res = await runAgent<ConversionAgentOutput>({
    kind: "conversion",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto",
    input,
  });
  if (res.status === "failed") return { ok: false, error: res.error || "Analysis failed." };
  if (res.status === "blocked") return { ok: false, error: res.summary || "Spend cap reached." };
  return { ok: true, analysis: res.output?.analysis, applied: res.output?.applied };
}

export async function stopExperimentAction(
  experimentId: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const exp = await getExperimentRecord(experimentId);
  if (!exp || exp.orgId !== org.id) return { ok: false, error: "Experiment not found." };
  await updateExperiment(experimentId, { status: "stopped" });
  return { ok: true };
}

export async function deleteExperimentAction(
  experimentId: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const exp = await getExperimentRecord(experimentId);
  if (!exp || exp.orgId !== org.id) return { ok: false, error: "Experiment not found." };
  await deleteExperiment(experimentId);
  return { ok: true };
}

/** Publish the next batch of SEO articles for a business (SEO Growth agent). */
export async function generateArticlesAction(
  businessId: string
): Promise<{ ok: boolean; created?: number; error?: string }> {
  const org = await requireOrg();
  const record = await getBusinessRecord(businessId);
  if (!record || record.orgId !== org.id) return { ok: false, error: "Business not found." };

  const input: SeoGrowthAgentInput = { businessId: record.id, limit: 3 };
  const res = await runAgent<SeoGrowthAgentOutput>({
    kind: "seo-growth",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto",
    input,
  });
  if (res.status === "failed") return { ok: false, error: res.error || "Generation failed." };
  if (res.status === "blocked") return { ok: false, error: res.summary || "Spend cap reached." };
  return { ok: true, created: res.output?.created };
}
