/**
 * Diagnostic agent. Proves the substrate end-to-end: it runs through the runner,
 * exercises the AI client (real call if configured, stub otherwise), and records
 * an agent_run with usage/cost. It has no side effects.
 *
 * Use it to verify wiring before the real agents land (Phase B onward) and as a
 * health probe from the Agent Control Centre.
 */

import type { AgentDefinition } from "./types";

interface PingInput {
  message?: string;
}

interface PingOutput {
  reply: string;
  aiEcho: string;
}

export const pingAgent: AgentDefinition<PingInput, PingOutput> = {
  kind: "ping",
  title: "Diagnostic Ping",
  description: "Health check that exercises the AI client and records a run. No side effects.",
  defaultAutonomy: "suggest",
  sideEffecting: false,
  async handler(input, ctx) {
    const message = input?.message?.trim() || "ping";
    const { text } = await ctx.ai.complete({
      tier: "fast",
      maxTokens: 64,
      system: "You are a health-check probe. Reply with a single short sentence confirming you are operational.",
      messages: [{ role: "user", content: message }],
    });
    return {
      output: { reply: "pong", aiEcho: text },
      summary: `Ping ok (org ${ctx.orgId}).`,
    };
  },
};
