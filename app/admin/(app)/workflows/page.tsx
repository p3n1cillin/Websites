import { requireOrg } from "@/lib/auth";
import { getWorkflowsForOrg, getRunsForOrg } from "@/lib/workflows";
import { getProspectsForOrg } from "@/lib/prospects";
import { getBusinessesForOrg } from "@/lib/businesses";
import Workflows, { type SeedOption, type AgentOption } from "./Workflows";

export const dynamic = "force-dynamic";

/** Agents selectable as workflow steps, in pipeline order. */
const AGENT_OPTIONS: AgentOption[] = [
  { kind: "discovery", label: "1 · Discovery" },
  { kind: "market", label: "2 · Market analysis" },
  { kind: "design", label: "3 · Design Engine" },
  { kind: "qa", label: "4 · QA Gate" },
  { kind: "seo-growth", label: "5 · SEO Growth" },
  { kind: "conversion", label: "6 · Conversion Optimiser" },
  { kind: "prospecting", label: "7 · Prospecting (demo)" },
  { kind: "sales", label: "8 · Sales (outreach)" },
  { kind: "onboarding", label: "9 · Onboarding" },
  { kind: "success", label: "10 · Customer Success" },
];

export default async function WorkflowsPage() {
  const org = await requireOrg();
  const [workflows, runs, prospects, businesses] = await Promise.all([
    getWorkflowsForOrg(org.id),
    getRunsForOrg(org.id),
    getProspectsForOrg(org.id),
    getBusinessesForOrg(org.id),
  ]);

  const prospectOptions: SeedOption[] = prospects.map((p) => ({ id: p.id, label: p.name }));
  const businessOptions: SeedOption[] = businesses.map((b) => ({ id: b.id, label: b.data.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <p className="mt-1 text-sm text-slate-500">
          Chain the agents into automated pipelines — find → build → sell → onboard → grow. Each step
          runs through the same audit, cost and autonomy controls.
        </p>
      </div>

      <Workflows
        workflows={workflows}
        runs={runs}
        agentOptions={AGENT_OPTIONS}
        prospectOptions={prospectOptions}
        businessOptions={businessOptions}
      />
    </div>
  );
}
