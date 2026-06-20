"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OPP_CATEGORY_LABEL, type OppCategory, type RevenueOpportunity } from "@/lib/empire";
import { pursueOpportunityAction, advanceOpportunityAction } from "./actions";

export interface VentureView {
  id: string;
  title: string;
  category: OppCategory;
  stage: string;
  stageIndex: number;
  viabilityScore: number;
  recurringPotentialPence: number;
  nextAction: string;
  dependencies: { label: string; kind: string }[];
  monetization: { primary: string; channels: string[] };
}

export interface CatalogOpp extends RevenueOpportunity {
  pursued: boolean;
}

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

const DEP_COLOR: Record<string, string> = {
  human: "bg-amber-100 text-amber-700",
  credential: "bg-sky-100 text-sky-700",
  payment: "bg-emerald-100 text-emerald-700",
  legal: "bg-rose-100 text-rose-700",
};

const LEVEL_COLOR = (l: string) =>
  l === "low" ? "text-emerald-600" : l === "medium" ? "text-amber-600" : "text-red-600";

export default function Ventures({
  catalog,
  ventures,
  stages,
  threshold,
}: {
  catalog: CatalogOpp[];
  ventures: VentureView[];
  stages: { key: string; label: string }[];
  threshold: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setBusy((b) => ({ ...b, [key]: true }));
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) setError(res.error || "Action failed.");
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      } finally {
        setBusy((b) => ({ ...b, [key]: false }));
      }
    });
  }

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* ACTIVE VENTURES — opportunities being executed through the lifecycle. */}
      {ventures.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Active ventures ({ventures.length})
          </h2>
          <div className="space-y-3">
            {ventures.map((v) => {
              const belowThreshold = v.stage === "validation" && v.viabilityScore < threshold;
              const isLive = v.stage === "live";
              return (
                <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{v.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CAT_COLOR[v.category]}`}>
                          {OPP_CATEGORY_LABEL[v.category]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        <span className="font-medium text-slate-800">Next:</span> {v.nextAction}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className={`text-lg font-bold ${v.viabilityScore >= threshold ? "text-emerald-600" : "text-red-500"}`}>{v.viabilityScore}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">viability</div>
                    </div>
                  </div>

                  {/* Lifecycle progress */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {stages.map((s, i) => (
                      <span
                        key={s.key}
                        title={s.label}
                        className={`h-1.5 flex-1 min-w-[18px] rounded-full ${
                          i < v.stageIndex ? "bg-emerald-500" : i === v.stageIndex ? "bg-slate-900" : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-medium capitalize text-slate-700">{v.stage.replace("_", " ")}</span>
                    <span>{gbp(v.recurringPotentialPence)}/mo potential · {v.monetization.primary}</span>
                  </div>

                  {/* Reality-constraint dependencies */}
                  {v.dependencies.length > 0 && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-2">
                      <p className="text-[11px] font-semibold text-slate-600">Needs you (can&apos;t automate):</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {v.dependencies.map((d, i) => (
                          <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DEP_COLOR[d.kind] ?? "bg-slate-100 text-slate-600"}`}>
                            {d.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    {!isLive && (
                      <button
                        onClick={() => run(`adv-${v.id}`, () => advanceOpportunityAction(v.id))}
                        disabled={busy[`adv-${v.id}`] || belowThreshold}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy[`adv-${v.id}`] ? "Advancing…" : `Advance → ${stages[v.stageIndex + 1]?.label ?? ""}`}
                      </button>
                    )}
                    {isLive && <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700">Live — earning</span>}
                    {belowThreshold && <span className="text-xs text-red-500">Below {threshold} viability — park or rework.</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* OPPORTUNITY PIPELINE — the catalog; pursue to start executing. */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Opportunity pipeline</h2>
        <p className="mb-3 text-xs text-slate-400">
          Ranked by empire score — strategic value + synergy with what you already own. Pursue one to move it from idea to operational asset.
        </p>
        <div className="space-y-3">
          {catalog.map((o) => (
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
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-center">
                    <div className={`text-xl font-bold ${o.empireScore >= 70 ? "text-emerald-600" : o.empireScore >= 45 ? "text-amber-600" : "text-slate-500"}`}>{o.empireScore}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">empire</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-700">{o.opportunityScore}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">opp</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4 lg:grid-cols-7">
                <Field label="Recurring" value={`${gbp(o.recurringPotentialPence)}/mo`} accent="text-emerald-600" />
                <Field label="Time to rev" value={`${o.timeToRevenueDays}d`} />
                <Field label="Startup" value={o.startupCostPence === 0 ? "£0" : gbp(o.startupCostPence)} />
                <Field label="Effort" value={o.effort} accent={LEVEL_COLOR(o.effort)} />
                <Field label="Scalability" value={`${o.scalability}`} />
                <Field label="Automation" value={`${o.automation}`} />
                <Field label="Risk" value={o.risk} accent={LEVEL_COLOR(o.risk)} />
              </div>

              <div className="mt-3">
                {o.pursued ? (
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-500">In execution ↑</span>
                ) : (
                  <button
                    onClick={() => run(`pursue-${o.id}`, () => pursueOpportunityAction(o.id))}
                    disabled={busy[`pursue-${o.id}`]}
                    className="rounded-lg bg-fuchsia-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-700 disabled:opacity-50"
                  >
                    {busy[`pursue-${o.id}`] ? "Starting…" : "Pursue this →"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
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
