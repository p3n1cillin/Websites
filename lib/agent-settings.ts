/**
 * Per-org, per-agent autonomy + spend caps (agent_settings table).
 *
 * Service-role access: the job worker resolves these with no user session. An
 * absent row falls back to the agent definition's default autonomy and the
 * org-wide default caps (env). The Agent Control Centre edits these via the
 * authed client (RLS owner policy) in a later phase.
 */

import type { AgentKind, Autonomy } from "./agents/types";
import { sbSelect, sbInsert, sbUpdate, supabaseWritable } from "./supabase/client";

/** Org-wide default spend caps (pence). 0 / unset = uncapped. */
const DEFAULT_DAILY_CAP = Number(process.env.AI_DAILY_CAP_PENCE ?? 0) || 0;
const DEFAULT_MONTHLY_CAP = Number(process.env.AI_MONTHLY_CAP_PENCE ?? 0) || 0;

export interface AgentSettings {
  orgId: string;
  kind: AgentKind;
  autonomy: Autonomy;
  /** null = inherit the org default. */
  dailyCapPence: number | null;
  monthlyCapPence: number | null;
}

interface SettingsRow {
  org_id: string;
  kind: string;
  autonomy: Autonomy;
  daily_cap_pence: number | null;
  monthly_cap_pence: number | null;
}

function toSettings(row: SettingsRow): AgentSettings {
  return {
    orgId: row.org_id,
    kind: row.kind as AgentKind,
    autonomy: row.autonomy,
    dailyCapPence: row.daily_cap_pence,
    monthlyCapPence: row.monthly_cap_pence,
  };
}

/** Resolved caps for an org (row override, else env default; 0 = uncapped). */
export interface ResolvedCaps {
  dailyCapPence: number;
  monthlyCapPence: number;
}

export function resolveCaps(settings: AgentSettings | null): ResolvedCaps {
  return {
    dailyCapPence: settings?.dailyCapPence ?? DEFAULT_DAILY_CAP,
    monthlyCapPence: settings?.monthlyCapPence ?? DEFAULT_MONTHLY_CAP,
  };
}

/** Look up an org's settings for one agent (null when none stored). */
export async function getAgentSettings(
  orgId: string,
  kind: AgentKind
): Promise<AgentSettings | null> {
  if (!supabaseWritable) return null;
  const rows = await sbSelect<SettingsRow>({
    query: `agent_settings?select=org_id,kind,autonomy,daily_cap_pence,monthly_cap_pence&org_id=eq.${encodeURIComponent(
      orgId
    )}&kind=eq.${encodeURIComponent(kind)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toSettings(rows[0]) : null;
}

/** All stored settings for an org (Agent Control Centre). */
export async function getAllAgentSettings(orgId: string): Promise<AgentSettings[]> {
  if (!supabaseWritable) return [];
  const rows = await sbSelect<SettingsRow>({
    query: `agent_settings?select=org_id,kind,autonomy,daily_cap_pence,monthly_cap_pence&org_id=eq.${encodeURIComponent(
      orgId
    )}`,
    tier: "service",
  });
  return rows.map(toSettings);
}

/** Upsert one agent's settings for an org. */
export async function setAgentSettings(input: {
  orgId: string;
  kind: AgentKind;
  autonomy: Autonomy;
  dailyCapPence?: number | null;
  monthlyCapPence?: number | null;
}): Promise<void> {
  const patch = {
    autonomy: input.autonomy,
    daily_cap_pence: input.dailyCapPence ?? null,
    monthly_cap_pence: input.monthlyCapPence ?? null,
  };
  const existing = await getAgentSettings(input.orgId, input.kind);
  if (existing) {
    await sbUpdate<SettingsRow>(
      "agent_settings",
      `org_id=eq.${encodeURIComponent(input.orgId)}&kind=eq.${encodeURIComponent(input.kind)}`,
      patch
    );
  } else {
    await sbInsert<SettingsRow>("agent_settings", {
      org_id: input.orgId,
      kind: input.kind,
      ...patch,
    });
  }
}
