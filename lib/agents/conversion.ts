/**
 * Conversion Optimiser agent (Agent 6) — A/B tests headlines/CTAs on live sites.
 *
 * Two modes:
 *  - "propose"  (default): generates candidate copy for a slot (AI smart tier, else
 *               clearly-deterministic heuristic alternatives) and, on `auto`, opens
 *               a running `experiment` with the control + candidates.
 *  - "analyse": picks the leader from the gathered impressions/conversions
 *               (deterministic) and, on `auto`, records the winner + marks the
 *               experiment applied — writing the winning headline back to the
 *               Business so the whole site adopts it.
 *
 * Side-effecting: persists only on `auto`. Analysis itself never invents data.
 */

import { aiConfigured } from "../ai/client";
import { updateBusiness } from "../businesses";
import { getWinningPatterns, recordWinningPattern } from "../knowledge";
import {
  analyseExperiment,
  createExperiment,
  updateExperiment,
  type WinnerAnalysis,
} from "../experiments";
import type {
  Business,
  Experiment,
  ExperimentSlot,
  ExperimentVariant,
} from "../types";
import type { AgentDefinition } from "./types";

export interface ConversionAgentInput {
  business: Business;
  businessId: string;
  slot: ExperimentSlot;
  mode?: "propose" | "analyse";
  /** Required for mode "analyse". */
  experiment?: Experiment;
}

export interface ConversionAgentOutput {
  applied: boolean;
  mode: "propose" | "analyse";
  experimentId?: string;
  analysis?: WinnerAnalysis;
}

/** The current live copy for a slot (the control arm). */
export function controlTextFor(business: Business, slot: ExperimentSlot): string {
  if (slot === "cta") return "Get your free quote";
  return business.tagline;
}

function heuristicCandidates(business: Business, slot: ExperimentSlot): string[] {
  const city = business.address.city;
  const svc = business.primaryService.toLowerCase();
  if (slot === "cta") {
    return ["Get a fast quote today", "Book your free callback"];
  }
  return [
    `Need a ${svc} in ${city}? Fast, friendly and fully guaranteed.`,
    `${business.primaryService} in ${city} you can trust — free quotes, no call-out fee.`,
  ];
}

export const conversionAgent: AgentDefinition<ConversionAgentInput, ConversionAgentOutput> = {
  kind: "conversion",
  title: "Conversion Optimiser",
  description: "Proposes and decides A/B tests for headlines and CTAs on live sites.",
  defaultAutonomy: "approve",
  sideEffecting: true,
  async handler(input, ctx) {
    const mode = input.mode ?? "propose";
    const industry = input.business.industryLabel || input.business.category;

    // -------------------------------------------------------------------
    // ANALYSE — pick the leader; on auto record the winner + apply it.
    // -------------------------------------------------------------------
    if (mode === "analyse") {
      const exp = input.experiment;
      if (!exp) throw new Error("analyse mode requires an experiment.");
      const analysis = analyseExperiment(exp.variants);
      const winner = exp.variants.find((v) => v.id === analysis.leaderId);
      // Only conclude when there's a clear, sufficiently-evidenced, non-control win.
      const decided =
        analysis.enoughData && Boolean(winner) && !winner!.control && analysis.lift > 0;
      const applied = ctx.autonomy === "auto" && decided;

      if (applied && winner) {
        await updateExperiment(exp.id, { winner: winner.id, status: "applied" });
        // Adopt a winning headline site-wide (the Business is the source of truth).
        if (exp.slot === "headline") {
          await updateBusiness(input.businessId, { ...input.business, tagline: winner.text });
        }
        // Learning loop B: remember the winning copy for this industry + slot.
        await recordWinningPattern(ctx.orgId, industry, exp.slot, winner.text);
      }

      return {
        output: { applied, mode, experimentId: exp.id, analysis },
        summary: applied
          ? `Applied winner "${winner!.label}" — ${analysis.note}`
          : `Analysis: ${analysis.note}`,
        action: { experimentId: exp.id, winner: analysis.leaderId, slot: exp.slot },
      };
    }

    // -------------------------------------------------------------------
    // PROPOSE — generate candidate copy + (on auto) open the experiment.
    // -------------------------------------------------------------------
    const control = controlTextFor(input.business, input.slot);
    let candidates = heuristicCandidates(input.business, input.slot);

    // Learning loop B (read): copy that has won this slot for this industry before.
    const priorWinners = await getWinningPatterns(ctx.orgId, industry, input.slot);

    if (aiConfigured) {
      const proven = priorWinners.length
        ? ` Phrasings that have WON A/B tests for similar ${industry} businesses: ${priorWinners.join(" | ")}. Build on what's proven to work.`
        : "";
      const { value } = await ctx.ai.completeJson<{ candidates: string[] }>({
        tier: "smart",
        maxTokens: 300,
        system:
          "You are a conversion-rate optimisation expert for local-business websites. Given the current copy, propose two sharper alternatives to A/B test. Keep each under 120 characters, concrete and local, no hype or fake claims.",
        prompt: `Business: ${input.business.name}, a ${input.business.categoryLabel} in ${input.business.address.city}. Slot: ${input.slot}. Current copy: "${control}". Return two alternative versions.${proven}`,
        schema: {
          type: "object",
          properties: { candidates: { type: "array", items: { type: "string" } } },
          required: ["candidates"],
        },
        stubValue: { candidates },
      });
      if (value?.candidates?.length) candidates = value.candidates.slice(0, 3);
    } else if (priorWinners.length) {
      // No AI: still seed a proven winner as a candidate (deduped against control).
      candidates = [priorWinners[0], ...candidates].filter((t) => t !== control).slice(0, 2);
    }

    const variants: ExperimentVariant[] = [
      { id: "v0", label: "Original", text: control, impressions: 0, conversions: 0, control: true },
      ...candidates.map((text, i) => ({
        id: `v${i + 1}`,
        label: `Variant ${String.fromCharCode(65 + i)}`,
        text,
        impressions: 0,
        conversions: 0,
      })),
    ];

    const applied = ctx.autonomy === "auto";
    let experiment: Experiment | null = null;
    if (applied) {
      experiment = await createExperiment({
        orgId: ctx.orgId,
        businessId: input.businessId,
        slot: input.slot,
        variants,
      });
    }

    return {
      output: { applied, mode, experimentId: experiment?.id },
      summary: applied
        ? `Started a ${input.slot} A/B test for ${input.business.name} (${variants.length} variants).`
        : `Proposed a ${input.slot} A/B test for ${input.business.name}.`,
      action: { businessId: input.businessId, slot: input.slot, variants },
    };
  },
};
