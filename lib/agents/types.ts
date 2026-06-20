/**
 * Agent substrate types. See docs/AGENCY_OS.md §3.
 *
 * An agent is a small module exposing a `definition` (metadata + handler). The
 * runner (lib/agents/runner.ts) executes it inside an audited, cost-tracked,
 * autonomy-gated envelope. Adding the real agents in later phases = adding more
 * definitions to the registry; the runner never changes.
 */

import type { AiClient } from "../ai/client";

/** The ten agents of the OS, plus a diagnostic. Extended phase by phase. */
export type AgentKind =
  | "ping" // diagnostic: proves the substrate end-to-end (Phase A)
  | "discovery" // 1
  | "market" // 2
  | "design" // 3
  | "qa" // 4
  | "seo-growth" // 5
  | "conversion" // 6
  | "prospecting" // 7
  | "sales" // 8
  | "onboarding" // 9
  | "success"; // 10

/**
 * How much rope an agent gets, per org:
 *  - off      : never runs.
 *  - suggest  : runs, records output, takes NO side effects (default).
 *  - approve  : runs, parks side-effecting output in `approvals` for a human.
 *  - auto     : runs and applies side effects immediately.
 */
export type Autonomy = "off" | "suggest" | "approve" | "auto";

export const AUTONOMY_LEVELS: Autonomy[] = ["off", "suggest", "approve", "auto"];

/** Status lifecycle of an agent_run row. */
export type AgentRunStatus =
  | "running"
  | "completed"
  | "awaiting_approval"
  | "blocked" // spend cap hit
  | "skipped" // autonomy off
  | "failed";

export interface AgentContext {
  orgId: string;
  actorUserId?: string | null;
  /** Resolved autonomy for this run (org setting or definition default). */
  autonomy: Autonomy;
  /** AI client bound to this run's usage sink (cost attribution is automatic). */
  ai: AiClient;
}

export interface AgentHandlerResult<O = unknown> {
  output: O;
  /** Short human-readable summary for the audit trail + approval cards. */
  summary: string;
  /**
   * The proposed side effect to apply, present only for side-effecting agents.
   * On `auto` the runner (or the agent's own apply step) acts on it now; on
   * `approve` it is parked in `approvals.payload` until a human signs off.
   */
  action?: unknown;
}

export interface AgentDefinition<I = unknown, O = unknown> {
  kind: AgentKind;
  title: string;
  description: string;
  /** Autonomy used when the org has no explicit setting. */
  defaultAutonomy: Autonomy;
  /**
   * Whether a run can change the outside world (send email, publish a site).
   * Side-effecting + `approve` ⇒ park in approvals. Read-only agents ignore the
   * approve/auto distinction.
   */
  sideEffecting: boolean;
  handler(input: I, ctx: AgentContext): Promise<AgentHandlerResult<O>>;
}

export interface RunAgentInput {
  kind: AgentKind;
  input: unknown;
  orgId: string;
  actorUserId?: string | null;
  /** Force an autonomy level (e.g. an interactive "run once"); else use settings. */
  autonomyOverride?: Autonomy;
}

export interface RunAgentResult<O = unknown> {
  runId: string | null;
  status: AgentRunStatus;
  output?: O;
  summary?: string;
  costPence: number;
  /** Set when status === "awaiting_approval". */
  approvalId?: string | null;
  error?: string;
}
