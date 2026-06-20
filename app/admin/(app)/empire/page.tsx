import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { getProspectsForOrg } from "@/lib/prospects";
import { getRetainersForOrg } from "@/lib/retainers";
import { getBusinessesForOrg } from "@/lib/businesses";
import { buildBusinessGraph } from "@/lib/discovery-graph";
import { buildEmpirePortfolio } from "@/lib/empire";
import {
  getOpportunitiesForOrg,
  dependenciesFor,
  monetizationPlanFor,
  OPPORTUNITY_STAGES,
  STAGE_LABEL,
  VIABILITY_THRESHOLD,
} from "@/lib/opportunities";
import Ventures, { type VentureView, type CatalogOpp } from "./Ventures";

/**
 * Empire Dashboard — the owner's whole economic ecosystem in one place: assets
 * owned, revenue streams, MRR, and a ranked opportunity pipeline (not just "build
 * websites"). All derived from real agency signals via lib/empire (deterministic).
 */
export const dynamic = "force-dynamic";

const gbp = (pence: number) => `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

export default async function EmpirePage() {
  const org = await requireOrg();
  const [prospects, retainers, businesses, ventures] = await Promise.all([
    getProspectsForOrg(org.id),
    getRetainersForOrg(org.id),
    getBusinessesForOrg(org.id),
    getOpportunitiesForOrg(org.id),
  ]);

  const graph = buildBusinessGraph(prospects);
  const portfolio = buildEmpirePortfolio({
    clusters: graph.clusters,
    retainers,
    liveSites: businesses.filter((b) => b.status === "published").length,
    prospectCount: prospects.length,
    orgName: org.name,
  });

  const pursuedRefs = new Set(ventures.map((v) => v.ref).filter(Boolean));
  const catalog: CatalogOpp[] = portfolio.opportunities.map((o) => ({
    ...o,
    pursued: pursuedRefs.has(o.id),
  }));
  const ventureViews: VentureView[] = ventures.map((v) => ({
    id: v.id,
    title: v.title,
    category: v.category,
    stage: v.stage,
    stageIndex: OPPORTUNITY_STAGES.indexOf(v.stage),
    viabilityScore: v.viabilityScore,
    recurringPotentialPence: v.recurringPotentialPence,
    nextAction: v.nextAction,
    dependencies: dependenciesFor(v.category, v.stage),
    monetization: monetizationPlanFor(v.category),
  }));
  const stages = OPPORTUNITY_STAGES.map((key) => ({ key, label: STAGE_LABEL[key] }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Empire</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your whole economic ecosystem — assets, revenue streams + the best opportunities to compound them.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Nexus
        </Link>
      </div>

      {/* Top line */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-2xl font-semibold tracking-tight text-emerald-600">{gbp(portfolio.totalMrrPence)}<span className="text-base font-normal text-slate-400">/mo</span></div>
          <div className="mt-1 text-sm font-medium text-slate-700">Recurring revenue</div>
          <div className="text-xs text-slate-400">
            {portfolio.growthRatePct === null ? "no retainers yet" : `+${portfolio.growthRatePct}% from last 30 days`}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-2xl font-semibold tracking-tight text-fuchsia-600">{gbp(portfolio.assetValuePence)}</div>
          <div className="mt-1 text-sm font-medium text-slate-700">Portfolio value</div>
          <div className="text-xs text-slate-400">modelled at 24× MRR</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-2xl font-semibold tracking-tight text-slate-900">{portfolio.assets.length}</div>
          <div className="mt-1 text-sm font-medium text-slate-700">Owned assets</div>
          <div className="text-xs text-slate-400">{portfolio.opportunities.length} opportunities queued</div>
        </div>
      </div>

      {/* Asset portfolio */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Asset portfolio</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {portfolio.assets.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">{a.name}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {a.type.replace("-", " ")}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{a.note}</p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {a.monthlyRevenuePence > 0 ? `${gbp(a.monthlyRevenuePence)}/mo` : "pre-revenue — owned"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Ventures (execution lifecycle) + opportunity catalog (pursue to start). */}
      <Ventures catalog={catalog} ventures={ventureViews} stages={stages} threshold={VIABILITY_THRESHOLD} />

      <p className="text-xs text-slate-400">
        Money figures are modelled estimates from real cluster economics + your live retainers, never measured facts.
      </p>
    </div>
  );
}
