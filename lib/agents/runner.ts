/**
 * Agent runner — the audited, cost-tracked, autonomy-gated envelope every agent
 * executes inside. See docs/AGENCY_OS.md §3.2.
 *
 * Flow:
 *   1. resolve the definition (registry) and the org's settings (autonomy + caps)
 *   2. autonomy 'off'      → skip
 *   3. spend cap exceeded  → block (no AI spend incurred)
 *   4. open an agent_run, run the handler with a usage-reporting AI client
 *      (tokens/cost stream to the cost ledger automatically)
 *   5. side-effecting + 'approve' → park the action in approvals (awaiting_approval)
 *   6. finish the run with usage + output
 *
 * Persistence degrades gracefully: with no Supabase the run still executes
 * (no audit row, no caps) so the substrate is usable in pure-local dev.
 */

import { createAiClient, type AiUsage } from "../ai/client";
import { addAiCost, getCostToday, getCostThisMonth } from "../ai/cost";
import { getAgentSettings, resolveCaps } from "../agent-settings";
import { createAgentRun, finishAgentRun } from "../agent-runs";
import { createApproval } from "../approvals";
import { getAgentDefinition } from "./registry";
import type {
  AgentContext,
  Autonomy,
  RunAgentInput,
  RunAgentResult,
} from "./types";

export async function runAgent<O = unknown>(input: RunAgentInput): Promise<RunAgentResult<O>> {
  const def = getAgentDefinition(input.kind);
  if (!def) {
    return { runId: null, status: "failed", costPence: 0, error: `Unknown agent: ${input.kind}` };
  }

  // 1. Resolve autonomy: explicit override > stored setting > definition default.
  const settings = await getAgentSettings(input.orgId, input.kind);
  const autonomy: Autonomy = input.autonomyOverride ?? settings?.autonomy ?? def.defaultAutonomy;

  if (autonomy === "off") {
    return { runId: null, status: "skipped", costPence: 0, summary: "Agent is disabled (autonomy: off)." };
  }

  // 2. Spend caps (skip the run entirely if already over — costs nothing).
  const caps = resolveCaps(settings);
  if (caps.dailyCapPence > 0 || caps.monthlyCapPence > 0) {
    const [today, month] = await Promise.all([
      getCostToday(input.orgId),
      getCostThisMonth(input.orgId),
    ]);
    const overDaily = caps.dailyCapPence > 0 && today >= caps.dailyCapPence;
    const overMonthly = caps.monthlyCapPence > 0 && month >= caps.monthlyCapPence;
    if (overDaily || overMonthly) {
      const runId = await createAgentRun({
        orgId: input.orgId,
        kind: input.kind,
        autonomy,
        input: input.input,
        actorUserId: input.actorUserId,
      });
      const summary = overDaily
        ? `Daily AI spend cap reached (${today}/${caps.dailyCapPence}p).`
        : `Monthly AI spend cap reached (${month}/${caps.monthlyCapPence}p).`;
      if (runId) await finishAgentRun(runId, { status: "blocked", summary });
      return { runId, status: "blocked", costPence: 0, summary };
    }
  }

  // 3. Open the run + wire up usage accumulation.
  const runId = await createAgentRun({
    orgId: input.orgId,
    kind: input.kind,
    autonomy,
    input: input.input,
    actorUserId: input.actorUserId,
  });

  const totals = { inputTokens: 0, outputTokens: 0, costPence: 0, runs: 0, model: null as string | null };
  const ai = createAiClient(async (usage: AiUsage) => {
    totals.inputTokens += usage.inputTokens;
    totals.outputTokens += usage.outputTokens;
    totals.costPence += usage.costPence;
    totals.runs += 1;
    totals.model = usage.model;
    await addAiCost(input.orgId, usage.costPence, 1);
  });

  const ctx: AgentContext = {
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    autonomy,
    ai,
  };

  // 4. Execute the handler.
  try {
    const result = await def.handler(input.input, ctx);

    // 5. Side-effecting + 'approve' ⇒ park the action; don't apply it.
    const needsApproval =
      def.sideEffecting && autonomy === "approve" && result.action !== undefined;

    if (needsApproval) {
      const approvalId = await createApproval({
        orgId: input.orgId,
        agentRunId: runId,
        kind: input.kind,
        summary: result.summary,
        payload: result.action,
      });
      if (runId) {
        await finishAgentRun(runId, {
          status: "awaiting_approval",
          output: result.output,
          summary: result.summary,
          model: totals.model,
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          costPence: totals.costPence,
        });
      }
      return {
        runId,
        status: "awaiting_approval",
        output: result.output as O,
        summary: result.summary,
        costPence: totals.costPence,
        approvalId,
      };
    }

    if (runId) {
      await finishAgentRun(runId, {
        status: "completed",
        output: result.output,
        summary: result.summary,
        model: totals.model,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        costPence: totals.costPence,
      });
    }

    return {
      runId,
      status: "completed",
      output: result.output as O,
      summary: result.summary,
      costPence: totals.costPence,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await finishAgentRun(runId, {
        status: "failed",
        error: message,
        model: totals.model,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        costPence: totals.costPence,
      });
    }
    return { runId, status: "failed", costPence: totals.costPence, error: message };
  }
}
