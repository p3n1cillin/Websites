/**
 * Success agent (Agent 10) — read-only customer health + reporting.
 *
 * Produces a plain-language report on a live customer site: enquiries captured,
 * a QA re-score, and concrete next-step suggestions. The deterministic baseline
 * (lib/reports.buildCustomerReport) runs with no AI key; when one is configured
 * the agent refines the summary + suggestions into warmer, customer-ready copy
 * (the heuristic report is the stub). Read-only — it changes nothing.
 */

import { aiConfigured } from "../ai/client";
import { getBusinessRecord } from "../businesses";
import { getLeadsForBusiness } from "../leads";
import { buildCustomerReport } from "../reports";
import type { CustomerReport } from "../types";
import type { AgentDefinition } from "./types";

export interface SuccessAgentInput {
  businessId: string;
}

export const successAgent: AgentDefinition<SuccessAgentInput, CustomerReport> = {
  kind: "success",
  title: "Customer Success",
  description: "Reports on a live customer site's enquiries, health and next steps.",
  defaultAutonomy: "suggest",
  sideEffecting: false,
  async handler(input, ctx) {
    const record = await getBusinessRecord(input.businessId);
    if (!record || record.orgId !== ctx.orgId) {
      throw new Error("Business not found for this org.");
    }

    const leads = await getLeadsForBusiness(record.id);
    const report = buildCustomerReport(record.id, record.data, leads);

    if (aiConfigured) {
      const { value } = await ctx.ai.completeJson<{ summary: string; suggestions: string[] }>({
        tier: "smart",
        maxTokens: 350,
        system:
          "You write warm, encouraging performance updates for a local-business owner about their website. Be specific and practical; never invent metrics beyond those given. Return a short summary (2–3 sentences) and 2–4 concrete suggestions.",
        prompt: `Business: ${record.data.name}, a ${record.data.categoryLabel}. Enquiries: ${report.leads.total} total, ${report.leads.new} new, ${report.leads.won} won. Site QA score: ${report.qaScore}/100. Baseline suggestions: ${report.suggestions.join("; ")}. Write the summary and suggestions.`,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            suggestions: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "suggestions"],
        },
        stubValue: { summary: report.summary, suggestions: report.suggestions },
      });
      if (value?.summary) {
        report.summary = value.summary;
        if (value.suggestions?.length) report.suggestions = value.suggestions.slice(0, 4);
        report.ai = true;
      }
    }

    return {
      output: report,
      summary: `Report for ${record.data.name}: ${report.leads.total} enquiries, health ${report.qaScore}/100.`,
    };
  },
};
