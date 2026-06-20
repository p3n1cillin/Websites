"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth";
import { getBusinessRecord, getBusinessesForOrg } from "@/lib/businesses";
import { buildDna } from "@/lib/design/dna";
import type { DesignLayout } from "@/lib/design/types";
import type { QaReport } from "@/lib/design/qa";
import { runAgent } from "@/lib/agents/runner";

/** One candidate design as the factory client describes it (seed + resolved slots). */
export interface CandidateSpec {
  seed: string;
  layout: DesignLayout;
}

/** Ownership guard — service-role writes bypass RLS, so confirm org ownership first. */
async function ownedRecord(id: string, orgId: string) {
  const record = await getBusinessRecord(id);
  if (!record || record.orgId !== orgId) throw new Error("Not found.");
  return record;
}

/**
 * Run the QA gate (Agent 4) on a candidate. Read-only: scores completeness, content,
 * design coherence and content uniqueness vs the org's other sites, then returns the
 * report for the factory panel.
 */
export async function runQaAction(
  businessId: string,
  spec: CandidateSpec
): Promise<QaReport> {
  const org = await requireOrg();
  const record = await ownedRecord(businessId, org.id);
  const business = record.data;
  const dna = buildDna(business, { seed: spec.seed || business.slug, overrides: spec.layout });

  const siblings = (await getBusinessesForOrg(org.id))
    .filter((r) => r.id !== businessId)
    .map((r) => r.data);

  const result = await runAgent<QaReport>({
    kind: "qa",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    input: { business, dna, siblings },
  });
  if (!result.output) {
    throw new Error(result.error || "QA failed to produce a report.");
  }
  return result.output;
}

/**
 * Persist a chosen candidate as the business's Design DNA, via the Design agent
 * (Agent 3) on `auto`. Runs through the audited, cost-capped runner. Revalidates the
 * business so the new look ships on its next render.
 */
export async function saveDesignAction(
  businessId: string,
  spec: CandidateSpec
): Promise<{ ok: boolean; applied: boolean; error?: string }> {
  const org = await requireOrg();
  const record = await ownedRecord(businessId, org.id);
  const business = record.data;
  const dna = buildDna(business, { seed: spec.seed || business.slug, overrides: spec.layout });

  const result = await runAgent<{ applied: boolean; rationale: string }>({
    kind: "design",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto",
    input: {
      businessId,
      businessName: business.name,
      category: business.category,
      dna,
    },
  });

  if (result.status !== "completed") {
    return { ok: false, applied: false, error: result.error || result.summary || "Save failed." };
  }

  revalidatePath(`/${business.slug}`);
  revalidatePath(`/admin/businesses/${businessId}`);
  return { ok: true, applied: Boolean(result.output?.applied) };
}
