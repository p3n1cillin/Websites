import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { getProspectsForOrg } from "@/lib/prospects";
import { getRetainersForOrg } from "@/lib/retainers";
import { getBusinessesForOrg } from "@/lib/businesses";
import { buildBusinessGraph } from "@/lib/discovery-graph";
import { buildEmpirePortfolio, OPP_CATEGORY_LABEL, type OppCategory } from "@/lib/empire";

/**
 * Empire Dashboard — the owner's whole economic ecosystem in one place: assets
 * owned, revenue streams, MRR, and a ranked opportunity pipeline (not just "build
 * websites"). All derived from real agency signals via lib/empire (deterministic).
 */
export const dynamic = "force-dynamic";

const gbp = (pence: number) => `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

const CAT_COLOR: Record<OppCategory, string> = {
  saas: "bg-fuchsia-100 text-fuchsia-700",
  affiliate: "bg-emerald-100 text-emerald-700",
  "digital-product": "bg-violet-100 text-violet-700",
  leadgen: "bg-cyan-100 text-cyan-700",
  service: "bg-sky-100 text-sky-700",
  content: "bg-amber-100 text-amber-700",
  acquisition: "bg-rose-100 text-rose-700",
};

const LEVEL_COLOR = (l: string) =>
  l === "low" ? "text-emerald-600" : l === "medium" ? "text-amber-600" : "text-red-600";

function ScoreRing({ value, label }: { value: number; label: string }) {
  const tone = value >= 70 ? "text-emerald-600" : value >= 45 ? "text-amber-600" : "text-slate-500";
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

export default async function EmpirePage() {
  const org = await requireOrg();
  const [prospects, retainers, businesses] = await Promise.all([
    getProspectsForOrg(org.id),
    getRetainersForOrg(org.id),
    getBusinessesForOrg(org.id),
  ]);

  const graph = buildBusinessGraph(prospects);
  const portfolio = buildEmpirePortfolio({
    clusters: graph.clusters,
    retainers,
    liveSites: businesses.filter((b) => b.status === "published").length,
    prospectCount: prospects.length,
    orgName: org.name,
  });

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

      {/* Opportunity pipeline */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Opportunity pipeline</h2>
        <p className="mb-3 text-xs text-slate-400">
          Ranked by empire score — strategic value + synergy with what you already own. Don&apos;t ask &quot;what business can I build&quot;; chase the highest long-term return.
        </p>
        <div className="space-y-3">
          {portfolio.opportunities.map((o) => (
            <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{o.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CAT_COLOR[o.category]}`}>
                      {OPP_CATEGORY_LABEL[o.category]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{o.rationale}</p>
                  <p className="mt-1 text-[11px] text-slate-400">Signal: {o.source}</p>
                </div>
                <div className="flex shrink-0 gap-4">
                  <ScoreRing value={o.empireScore} label="empire" />
                  <ScoreRing value={o.opportunityScore} label="opp" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4 lg:grid-cols-7">
                <Field label="Recurring" value={`${gbp(o.recurringPotentialPence)}/mo`} accent="text-emerald-600" />
                <Field label="Time to rev" value={`${o.timeToRevenueDays}d`} />
                <Field label="Startup" value={o.startupCostPence === 0 ? "£0" : gbp(o.startupCostPence)} />
                <Field label="Effort" value={o.effort} accent={LEVEL_COLOR(o.effort === "low" ? "low" : o.effort === "medium" ? "medium" : "high")} />
                <Field label="Scalability" value={`${o.scalability}`} />
                <Field label="Automation" value={`${o.automation}`} />
                <Field label="Risk" value={o.risk} accent={LEVEL_COLOR(o.risk)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Money figures are modelled estimates from real cluster economics + your live retainers, never measured facts.
      </p>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`font-medium capitalize ${accent ?? "text-slate-700"}`}>{value}</div>
    </div>
  );
}
