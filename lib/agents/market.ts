/**
 * Market / Competitor agent (Agent 2) — judges a discovered prospect.
 *
 * It refreshes the deterministic opportunity scores and writes a short
 * positioning analysis: the opportunity, the winning angle (what their current
 * presence lacks that a new site would fix) and the recommended design
 * personality for the eventual build. The analysis copy is AI-written when a key
 * is configured (smart tier) and otherwise a clearly-deterministic heuristic
 * (the STUB rule — never pass placeholder off as bespoke).
 *
 * It does NOT crawl the prospect's site; it reasons from the attributes on file.
 * Deep competitor crawling is a later enhancement. Side-effecting: on `auto` it
 * persists the verdict and advances a `discovered` prospect to `analysed`.
 */

import { aiConfigured } from "../ai/client";
import { auditWebsite } from "../audit";
import { getPersonality, personalityForCategory } from "../design/personalities";
import { scoreProspect, updateProspectAnalysis } from "../prospects";
import type { Prospect, ProspectAnalysis, WebsiteAudit } from "../types";
import type { AgentDefinition } from "./types";

export interface MarketAgentInput {
  prospect: Prospect;
}

export interface MarketAgentOutput {
  applied: boolean;
  analysis: ProspectAnalysis;
  opportunityScore: number;
}

function heuristicAnalysis(
  p: Prospect,
  opportunityScore: number,
  personalityLabel: string,
  audit: WebsiteAudit | null
): { summary: string; angle: string; signals: string[] } {
  const hasSite = Boolean(p.websiteUrl?.trim());
  const where = p.city || "the area";

  let summary: string;
  let angle: string;
  if (!hasSite) {
    summary = `${p.name} has no website on file — a strong signal of an under-served ${p.category} in ${where}. High opportunity (${opportunityScore}/100).`;
    angle = "Be their first professional online presence: capture the searches competitors are already winning.";
  } else if (audit && !audit.reachable) {
    summary = `${p.name}'s website didn't load — effectively no working web presence in ${where}. High opportunity (${opportunityScore}/100).`;
    angle = "Replace a broken/offline site with a fast, reliable one before a competitor does.";
  } else if (audit) {
    summary = `${p.name}'s current site scores ${audit.overall}/100 — ${audit.issues.length} concrete weakness${audit.issues.length === 1 ? "" : "es"} to beat in ${where}. Opportunity ${opportunityScore}/100.`;
    angle = audit.issues[0]
      ? `Lead with their biggest gap: ${audit.issues[0].replace(/\.$/, "").toLowerCase()}.`
      : "Out-design and out-convert the incumbent on mobile, speed and clear calls-to-action.";
  } else {
    summary = `${p.name} has a web presence but a modern, conversion-focused ${p.category} site in ${where} could win share — opportunity ${opportunityScore}/100.`;
    angle = "Out-design and out-convert the incumbent: faster load, clearer CTAs, local SEO and trust signals.";
  }

  const signals = [
    audit
      ? audit.reachable
        ? `Current site audited: ${audit.overall}/100`
        : "Existing site is broken / offline"
      : hasSite
        ? "Existing site to benchmark against"
        : "No website found — greenfield",
    ...(audit?.issues.slice(0, 3) ?? []),
    `Recommended look: ${personalityLabel}`,
    `Est. first-year value ~£${Math.round(p.valueEstimate / 100)}`,
  ];
  return { summary, angle, signals };
}

export const marketAgent: AgentDefinition<MarketAgentInput, MarketAgentOutput> = {
  kind: "market",
  title: "Market / Competitor",
  description:
    "Scores a prospect's opportunity and writes the positioning angle for the pitch.",
  defaultAutonomy: "suggest",
  sideEffecting: true,
  async handler(input, ctx) {
    const p = input.prospect;

    // Opportunity Analysis: audit their REAL site (when one's on file) so the score
    // and pitch reflect actual weaknesses, not a has-site-or-not proxy.
    const audit = p.websiteUrl?.trim() ? await auditWebsite(p.websiteUrl) : null;
    const presenceScore = audit ? audit.overall : p.websiteUrl?.trim() ? 55 : 12;
    const scores = scoreProspect({ category: p.category, presenceScore });

    const personalityKey = personalityForCategory(p.category);
    const personality = getPersonality(personalityKey);

    // Deterministic baseline (also the stub value for the AI path).
    const base = heuristicAnalysis(p, scores.opportunityScore, personality.label, audit);
    let analysis: ProspectAnalysis = {
      summary: base.summary,
      angle: base.angle,
      personality: personalityKey,
      signals: base.signals,
      audit,
      ai: false,
      at: new Date().toISOString(),
    };

    if (aiConfigured) {
      const auditLine = audit
        ? audit.reachable
          ? `Their site scored ${audit.overall}/100. Real weaknesses found: ${audit.issues.join("; ") || "none"}.`
          : "Their website did not load (broken or offline)."
        : "No website on file.";
      const { value } = await ctx.ai.completeJson<{ summary: string; angle: string; signals: string[] }>({
        tier: "smart",
        maxTokens: 400,
        system:
          "You are a sharp B2B sales strategist for a web-design agency. Given a prospect and a real audit of their current website, assess the opportunity and the angle to win the deal. Ground every claim in the audit findings provided — do not invent issues. Be concrete, concise and local.",
        prompt: `Prospect: ${p.name}, a ${p.category} in ${p.city || "an unknown town"}. Phone: ${p.phone || "n/a"}. ${auditLine} Opportunity ${scores.opportunityScore}/100, est. first-year value £${Math.round(scores.valueEstimate / 100)}. Recommended design feel: ${personality.label} (${personality.tone}). Return a 1–2 sentence summary, a one-line winning angle that leads with their biggest real weakness, and 2–3 short signals.`,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            angle: { type: "string" },
            signals: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "angle"],
        },
        stubValue: base,
      });
      if (value?.summary && value?.angle) {
        analysis = {
          summary: value.summary,
          angle: value.angle,
          personality: personalityKey,
          signals: value.signals?.length ? value.signals : base.signals,
          audit,
          ai: true,
          at: new Date().toISOString(),
        };
      }
    }

    const applied = ctx.autonomy === "auto";
    if (applied) {
      await updateProspectAnalysis(p.id, {
        analysis,
        presenceScore: scores.presenceScore,
        opportunityScore: scores.opportunityScore,
        valueEstimate: scores.valueEstimate,
        // Advance the pipeline only from the initial state.
        status: p.status === "discovered" ? "analysed" : undefined,
      });
    }

    return {
      output: { applied, analysis, opportunityScore: scores.opportunityScore },
      summary: applied
        ? `Analysed ${p.name} — opportunity ${scores.opportunityScore}/100.`
        : `Proposed analysis for ${p.name} — opportunity ${scores.opportunityScore}/100.`,
      action: { prospectId: p.id, analysis, scores },
    };
  },
};
