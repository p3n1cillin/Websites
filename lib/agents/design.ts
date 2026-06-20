/**
 * Design agent (Agent 3) — the Design DNA engine, run inside the agent substrate.
 *
 * The *structural* work (which palette/type/layout a candidate gets) is deterministic
 * and free — see lib/design. This agent's job in the runner is to (a) optionally
 * produce a short art-direction rationale via AI when a key is configured, and (b)
 * persist a chosen DesignDNA onto the business as a side effect.
 *
 * Side-effecting: on `auto` it saves the DNA now; on `approve` the runner parks the
 * DNA (the `action`) in `approvals` for a human; on `suggest` it just records the
 * proposal. This is how "Use this design" in the factory flows through audit + caps.
 */

import { aiConfigured } from "../ai/client";
import { updateBusinessDesign } from "../businesses";
import { getPersonality } from "../design/personalities";
import { TASTE_DESIGN_NOTE } from "../design/taste";
import type { DesignDNA } from "../design/types";
import type { AgentDefinition } from "./types";

export interface DesignAgentInput {
  businessId: string;
  /** Human-readable business name, for the run summary + rationale prompt. */
  businessName: string;
  category: string;
  dna: DesignDNA;
}

export interface DesignAgentOutput {
  applied: boolean;
  /** Short "why this design fits the brief" note (AI when configured, else preset tone). */
  rationale: string;
}

export const designAgent: AgentDefinition<DesignAgentInput, DesignAgentOutput> = {
  kind: "design",
  title: "Design Engine",
  description:
    "Generates and persists a unique Design DNA (palette, type, layout) for a business.",
  defaultAutonomy: "suggest",
  sideEffecting: true,
  async handler(input, ctx) {
    const personality = getPersonality(input.dna.personality);

    // Rationale: real AI copy when configured, otherwise the personality's tone hint
    // (clearly preset, never passed off as bespoke AI output — see the STUB rule).
    let rationale = `${personality.label}: ${personality.tone}`;
    if (aiConfigured) {
      const { value } = await ctx.ai.completeJson<{ rationale: string }>({
        tier: "smart",
        maxTokens: 220,
        system:
          "You are a senior brand designer. In 1–2 sentences, justify a website's design direction for a local business. Be concrete about feel and audience. " +
          TASTE_DESIGN_NOTE,
        prompt: `Business: ${input.businessName} (${input.category}). Design direction: ${personality.label}; palette mode ${input.dna.palette.mode}; ${input.dna.typography.heading}/${input.dna.typography.body} type; ${input.dna.radius} corners; ${input.dna.density} density; ${input.dna.motion} motion; layout ${JSON.stringify(input.dna.layout)}.`,
        schema: {
          type: "object",
          properties: { rationale: { type: "string" } },
          required: ["rationale"],
        },
        stubValue: { rationale },
      });
      if (value?.rationale) rationale = value.rationale;
    }

    // Apply the side effect only when fully autonomous; suggest/approve don't persist.
    const applied = ctx.autonomy === "auto";
    if (applied) {
      await updateBusinessDesign(input.businessId, input.dna);
    }

    return {
      output: { applied, rationale },
      summary: applied
        ? `Applied ${personality.label} design to ${input.businessName}.`
        : `Proposed ${personality.label} design for ${input.businessName}.`,
      // The proposed side effect: the DNA to persist (parked on approve, applied on auto).
      action: { businessId: input.businessId, dna: input.dna },
    };
  },
};
