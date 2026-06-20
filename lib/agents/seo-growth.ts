/**
 * SEO Growth agent (Agent 5) — keeps live customer sites growing in search.
 *
 * Wraps the existing SEO-automation engine (lib/blog.runSeoGeneration) in the agent
 * substrate so generating the next batch of locally-targeted articles for ONE
 * business is audited, autonomy-gated and cost-tracked like every other agent —
 * upgrading the nightly-cron-only engine into an on-demand, governed action.
 *
 * The generator is deterministic (template-planned articles, no AI), so it runs
 * with no AI key. Side-effecting: it publishes posts, so it only runs on `auto`.
 */

import { runSeoGeneration } from "../blog";
import { getBusinessRecord } from "../businesses";
import type { AgentDefinition } from "./types";

export interface SeoGrowthAgentInput {
  businessId: string;
  /** Max new articles to publish this run. */
  limit?: number;
}

export interface SeoGrowthAgentOutput {
  applied: boolean;
  created: number;
}

export const seoGrowthAgent: AgentDefinition<SeoGrowthAgentInput, SeoGrowthAgentOutput> = {
  kind: "seo-growth",
  title: "SEO Growth",
  description: "Publishes the next batch of locally-targeted articles for a customer site.",
  defaultAutonomy: "approve",
  sideEffecting: true,
  async handler(input, ctx) {
    const record = await getBusinessRecord(input.businessId);
    if (!record || record.orgId !== ctx.orgId) throw new Error("Business not found for this org.");
    if (record.status !== "published") {
      throw new Error("Publish the site before generating SEO articles.");
    }

    const applied = ctx.autonomy === "auto";
    let created = 0;
    if (applied) {
      ({ created } = await runSeoGeneration([record], input.limit ?? 3));
    }

    return {
      output: { applied, created },
      summary: applied
        ? `Published ${created} new article${created === 1 ? "" : "s"} for ${record.data.name}.`
        : `Ready to generate articles for ${record.data.name}.`,
      action: { businessId: record.id, limit: input.limit ?? 3 },
    };
  },
};
