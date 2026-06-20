/**
 * Sales agent (Agent 8) — drafts the outreach SEQUENCE that opens a conversation.
 *
 * Given a prospect (and ideally the demo preview URL), it writes a 3-step,
 * low-pressure follow-up sequence: an initial touch that leads with the Market
 * agent's angle + the free demo, a gentle follow-up, and a final check-in. AI-
 * written when a key is configured (smart tier); otherwise clearly-deterministic
 * templates (the STUB rule). On `auto` it persists each step as a DRAFT — it does
 * NOT send. No email provider ships (zero-dep), so sending stays a deliberate human
 * step ("mark sent"), which is also the outbound-action gate.
 */

import { aiConfigured } from "../ai/client";
import { createOutreachSequence } from "../outreach";
import { getWinningPatterns } from "../knowledge";
import type { OutreachChannel, OutreachIntent, Prospect } from "../types";
import type { AgentDefinition } from "./types";

export interface SalesAgentInput {
  prospect: Prospect;
  /** The demo URL to link (from the Prospecting agent), if one exists. */
  previewUrl?: string | null;
  channel?: OutreachChannel;
}

interface SequenceStep {
  intent: OutreachIntent;
  subject: string;
  body: string;
}

export interface SalesAgentOutput {
  applied: boolean;
  steps: number;
  ai: boolean;
}

const SIGNOFF = "\n\nBest,\n[Your name]";

function heuristicSequence(p: Prospect, previewUrl?: string | null): SequenceStep[] {
  const town = p.city?.trim() || "your area";
  const angle =
    p.analysis?.angle?.trim() ||
    "A fast, modern website would help more local customers find and choose you.";
  const demoLine = previewUrl
    ? `\n\nI built you a free demo so you can see exactly what I mean — no obligation:\n${previewUrl}`
    : "";
  return [
    {
      intent: "initial",
      subject: `A quick idea for ${p.name}`,
      body: `Hi ${p.name} team,\n\nI'm a local web designer working with ${p.category}s around ${town}. ${angle}${demoLine}\n\nIf you like it, I'd love a quick chat about getting it live.${SIGNOFF}`,
    },
    {
      intent: "follow_up",
      subject: `Re: a quick idea for ${p.name}`,
      body: `Hi again,\n\nJust floating this back to the top of your inbox${previewUrl ? " — the free demo's still here:\n" + previewUrl : "."}\n\nHappy to tweak anything you'd want changed; no pressure either way.${SIGNOFF}`,
    },
    {
      intent: "final",
      subject: `Last one from me, ${p.name}`,
      body: `Hi,\n\nI'll leave it here so I'm not a nuisance! If a better website for ${town} is ever on your list, just reply and we'll pick it up.\n\nWishing you a great month regardless.${SIGNOFF}`,
    },
  ];
}

export const salesAgent: AgentDefinition<SalesAgentInput, SalesAgentOutput> = {
  kind: "sales",
  title: "Sales",
  description: "Drafts a personalised follow-up sequence leading with the angle and the demo.",
  defaultAutonomy: "approve",
  sideEffecting: true,
  async handler(input, ctx) {
    const p = input.prospect;
    const channel = input.channel ?? "email";
    let steps = heuristicSequence(p, input.previewUrl);
    let ai = false;

    if (aiConfigured) {
      // Self-improving loop (read side): openers that have won deals in this
      // industry, fed back as guidance so outreach sharpens with every close.
      const industry = p.source?.industry?.trim() || p.category;
      const winners = await getWinningPatterns(ctx.orgId, industry, "outreach_initial");
      const winGuidance = winners.length
        ? ` Openers that have WON deals with ${industry}s before — adapt the angle, write fresh (never copy verbatim): "${winners.slice(0, 2).join('" || "')}".`
        : "";
      const { value } = await ctx.ai.completeJson<{
        steps: { intent: OutreachIntent; subject: string; body: string }[];
      }>({
        tier: "smart",
        maxTokens: 800,
        system:
          "You are a friendly, low-pressure B2B salesperson for a local web-design agency. Write a 3-message email FOLLOW-UP SEQUENCE to a small business: (1) intent 'initial' — lead with a concrete benefit and the free demo link if provided; (2) intent 'follow_up' — a short, warm nudge; (3) intent 'final' — a graceful last check-in that leaves the door open. Each under 110 words, sign off '[Your name]'. No hype, no fake urgency, no invented facts.",
        prompt: `Prospect: ${p.name}, a ${p.category} in ${p.city || "an unknown town"}. Winning angle: ${
          p.analysis?.angle || "modern, conversion-focused website"
        }. ${input.previewUrl ? `Free demo link: ${input.previewUrl}` : "No demo link available."}${winGuidance} Return the 3 messages in order.`,
        schema: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  intent: { type: "string", enum: ["initial", "follow_up", "final"] },
                  subject: { type: "string" },
                  body: { type: "string" },
                },
                required: ["intent", "subject", "body"],
              },
            },
          },
          required: ["steps"],
        },
        stubValue: { steps },
      });
      if (value?.steps?.length) {
        steps = value.steps.slice(0, 3);
        ai = true;
      }
    }

    const applied = ctx.autonomy === "auto";
    if (applied) {
      await createOutreachSequence(
        steps.map((s, i) => ({
          orgId: ctx.orgId,
          prospectId: p.id,
          channel,
          direction: "outbound" as const,
          subject: s.subject,
          body: s.body,
          status: "draft" as const,
          intent: s.intent,
          step: i,
          ai,
        }))
      );
    }

    return {
      output: { applied, steps: steps.length, ai },
      summary: applied
        ? `Drafted a ${steps.length}-step ${channel} sequence for ${p.name}${ai ? "" : " (template)"}.`
        : `Proposed a ${steps.length}-step sequence for ${p.name}.`,
      action: { prospectId: p.id, channel, steps },
    };
  },
};
