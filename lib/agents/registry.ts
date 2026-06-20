/**
 * Agent registry — the single map from AgentKind → definition.
 *
 * Each phase of the roadmap adds its agents here; the runner and the Agent
 * Control Centre iterate this map and need no other changes. Phase A ships only
 * the diagnostic `ping`; the ten production agents arrive in Phases B–G.
 */

import type { AgentDefinition, AgentKind } from "./types";
import { pingAgent } from "./ping";
import { designAgent } from "./design";
import { qaAgent } from "./qa";
import { discoveryAgent } from "./discovery";
import { marketAgent } from "./market";
import { prospectingAgent } from "./prospecting";
import { salesAgent } from "./sales";
import { onboardingAgent } from "./onboarding";
import { successAgent } from "./success";
import { seoGrowthAgent } from "./seo-growth";
import { conversionAgent } from "./conversion";

const REGISTRY: Partial<Record<AgentKind, AgentDefinition<any, any>>> = {
  ping: pingAgent,
  discovery: discoveryAgent, // 1 (Phase D)
  market: marketAgent, // 2 (Phase D)
  design: designAgent, // 3 (Phase C)
  qa: qaAgent, // 4 (Phase C)
  prospecting: prospectingAgent, // 7 (Phase E)
  sales: salesAgent, // 8 (Phase E)
  onboarding: onboardingAgent, // 9 (Phase F)
  success: successAgent, // 10 (Phase F)
  "seo-growth": seoGrowthAgent, // 5 (Phase G)
  conversion: conversionAgent, // 6 (Phase G)
  // All 10 production agents now registered.
};

export function getAgentDefinition(kind: AgentKind): AgentDefinition<any, any> | undefined {
  return REGISTRY[kind];
}

/** All registered agents (for the Agent Control Centre listing). */
export function listAgentDefinitions(): AgentDefinition<any, any>[] {
  return Object.values(REGISTRY).filter(Boolean) as AgentDefinition<any, any>[];
}

export function isAgentRegistered(kind: AgentKind): boolean {
  return Boolean(REGISTRY[kind]);
}
