/**
 * Discovery agent (Agent 1) — fills the acquisition pipeline.
 *
 * It takes a batch of raw candidate businesses (today: operator-supplied — a
 * manual entry or a pasted/imported list; a licensed data source like Google
 * Places / Overpass slots in behind the same candidate shape later, see
 * docs/AGENCY_OS.md §11.2), normalises them, scores the opportunity
 * deterministically, and — as a side effect on `auto` — persists the new
 * prospects (deduped by name + city so re-running a brief is idempotent).
 *
 * No AI call is needed: discovery is normalisation + scoring, both deterministic
 * and free. The narrative judgement comes later from the Market agent (2). The
 * run still flows through the substrate for audit + autonomy gating.
 */

import { createProspects, normalizeCategory, scoreProspect } from "../prospects";
import type { CreateProspectInput } from "../prospects";
import type { AgentDefinition } from "./types";

/** A raw, unnormalised candidate (e.g. one parsed line of a pasted list). */
export interface DiscoveryCandidate {
  name: string;
  category?: string;
  city?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
}

export interface DiscoveryAgentInput {
  orgId: string;
  candidates: DiscoveryCandidate[];
  /** Free-text note recorded as provenance on each created prospect. */
  note?: string;
}

export interface DiscoveryAgentOutput {
  applied: boolean;
  /** How many candidates were turned into NEW prospects. */
  created: number;
  /** Skipped as duplicates of existing prospects. */
  skipped: number;
  /** Skipped as unusable (e.g. no name). */
  invalid: number;
}

function toInput(
  orgId: string,
  c: DiscoveryCandidate,
  note?: string
): CreateProspectInput | null {
  const name = c.name?.trim();
  if (!name) return null;
  const rawIndustry = c.category?.trim();
  // Map the raw industry to a design bucket (never plumber-by-default), but keep
  // the original text on the prospect so the Industry Profiler can use it.
  const category = normalizeCategory(rawIndustry);
  const websiteUrl = c.websiteUrl?.trim() || null;
  const scores = scoreProspect({ category, websiteUrl });
  return {
    orgId,
    name,
    category,
    city: c.city?.trim() || "",
    phone: c.phone?.trim() || null,
    email: c.email?.trim() || null,
    websiteUrl,
    status: "discovered",
    source: {
      origin: "discovery",
      note,
      industry: rawIndustry || undefined,
      at: new Date().toISOString(),
    },
    ...scores,
  };
}

export const discoveryAgent: AgentDefinition<DiscoveryAgentInput, DiscoveryAgentOutput> = {
  kind: "discovery",
  title: "Discovery",
  description:
    "Normalises and scores candidate businesses into the prospect pipeline (deduped).",
  defaultAutonomy: "suggest",
  sideEffecting: true,
  async handler(input, ctx) {
    const valid: CreateProspectInput[] = [];
    let invalid = 0;
    for (const c of input.candidates ?? []) {
      const mapped = toInput(input.orgId, c, input.note);
      if (mapped) valid.push(mapped);
      else invalid += 1;
    }

    const applied = ctx.autonomy === "auto";
    let created = 0;
    let skipped = 0;
    if (applied) {
      const res = await createProspects(valid);
      created = res.created.length;
      skipped = res.skipped;
    }

    return {
      output: { applied, created, skipped, invalid },
      summary: applied
        ? `Discovered ${created} new prospect${created === 1 ? "" : "s"} (${skipped} dup, ${invalid} invalid).`
        : `Ready to add ${valid.length} prospect${valid.length === 1 ? "" : "s"} (${invalid} invalid).`,
      // The proposed side effect: the prospect drafts to persist.
      action: { orgId: input.orgId, prospects: valid },
    };
  },
};
