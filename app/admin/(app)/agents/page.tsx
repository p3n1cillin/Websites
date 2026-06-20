import { requireOrg } from "@/lib/auth";
import { listAgentDefinitions } from "@/lib/agents/registry";
import { AUTONOMY_LEVELS } from "@/lib/agents/types";
import { getAllAgentSettings, resolveCaps } from "@/lib/agent-settings";
import { getRecentAgentRuns } from "@/lib/agent-runs";
import { getPendingApprovals } from "@/lib/approvals";
import { getCostToday, getCostThisMonth, getCostSeries } from "@/lib/ai/cost";
import { aiConfigured } from "@/lib/ai/client";
import ControlCentre, { type AgentRow, type CostPoint } from "./ControlCentre";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const org = await requireOrg();
  const [settingsList, runs, approvals, costToday, costMonth, series] = await Promise.all([
    getAllAgentSettings(org.id),
    getRecentAgentRuns(org.id, 50),
    getPendingApprovals(org.id),
    getCostToday(org.id),
    getCostThisMonth(org.id),
    getCostSeries(org.id, 14),
  ]);

  const byKind = new Map(settingsList.map((s) => [s.kind, s]));
  const defaultCaps = resolveCaps(null);

  const agents: AgentRow[] = listAgentDefinitions().map((def) => {
    const s = byKind.get(def.kind);
    return {
      kind: def.kind,
      title: def.title,
      description: def.description,
      defaultAutonomy: def.defaultAutonomy,
      autonomy: s?.autonomy ?? def.defaultAutonomy,
      dailyCapPence: s?.dailyCapPence ?? null,
      monthlyCapPence: s?.monthlyCapPence ?? null,
    };
  });

  const points: CostPoint[] = series
    .map((r) => ({ day: r.day, costPence: r.cost_pence ?? 0, runs: r.run_count ?? 0 }))
    .reverse(); // oldest → newest for the chart
  const runs14 = points.reduce((sum, p) => sum + p.runs, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agent Control Centre</h1>
        <p className="mt-1 text-sm text-slate-500">
          The cockpit for all ten agents — autonomy, spend caps, run history, costs and approvals.
          {!aiConfigured && " AI is in STUB mode (no key set): agents run free with clearly-marked placeholder output."}
        </p>
      </div>

      <ControlCentre
        agents={agents}
        runs={runs}
        approvals={approvals}
        autonomyLevels={[...AUTONOMY_LEVELS]}
        stats={{
          costToday,
          costMonth,
          runs14,
          pending: approvals.length,
          dailyCapPence: defaultCaps.dailyCapPence,
          monthlyCapPence: defaultCaps.monthlyCapPence,
        }}
        series={points}
      />
    </div>
  );
}
