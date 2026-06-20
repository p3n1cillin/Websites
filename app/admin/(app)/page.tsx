import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { getProspectsForOrg } from "@/lib/prospects";
import { getProposalsForOrg, getCollectedTotalForOrg } from "@/lib/proposals";
import { getLeadsForOrg } from "@/lib/leads";
import { getPreviewsForOrg } from "@/lib/previews";
import { getPreviewStatsForOrg } from "@/lib/preview-analytics";
import { getOutreachForOrg } from "@/lib/outreach";
import { getCostToday, getCostThisMonth } from "@/lib/ai/cost";
import { getRecentAgentRuns } from "@/lib/agent-runs";
import { buildLeadIntelReport } from "@/lib/lead-intel";
import { getRetainersForOrg, activeMrrPence, DEFAULT_RETAINER_PENCE } from "@/lib/retainers";
import { getPortalsForOrg } from "@/lib/customers";
import { buildCrmStates, needsAttention } from "@/lib/crm";
import { getBusinessesForOrg } from "@/lib/businesses";
import { buildBusinessGraph } from "@/lib/discovery-graph";
import { buildEmpirePortfolio } from "@/lib/empire";
import { PROSPECT_STATUSES, type OutreachMessage, type Proposal, type ProspectStatus, type SitePreview } from "@/lib/types";
import Nexus, { type NexusData, type NexusAgent } from "./Nexus";
import AutopilotButton from "./AutopilotButton";

const AGENT_LABELS: Record<string, string> = {
  discovery: "Discovery",
  market: "Intelligence",
  design: "Design",
  qa: "QA",
  "seo-growth": "SEO",
  conversion: "Conversion",
  prospecting: "Architect",
  sales: "Sales",
  onboarding: "Onboarding",
  success: "Success",
};

/**
 * Agency Command Center — the single screen optimised around one metric: revenue.
 * Three lenses over the whole funnel, assembled from the existing data layers:
 *   • Lead Pipeline  — discovery → demo → outreach → proposal → won
 *   • Revenue        — open pipeline, won value, avg deal, client revenue uplift
 *   • AI Performance  — spend, cost-per-lead/demo, agent success rate, demo engagement
 * Everything degrades gracefully (zeros) without Supabase / before migrations.
 */
export const dynamic = "force-dynamic";

const gbp = (pence: number) =>
  `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

const STAGE_LABEL: Record<ProspectStatus, string> = {
  discovered: "Discovered",
  analysed: "Analysed",
  previewed: "Demoed",
  contacted: "Contacted",
  responded: "Responded",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "emerald" | "indigo" | "amber" | "slate";
}) {
  const ring =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "indigo"
        ? "text-indigo-600"
        : accent === "amber"
          ? "text-amber-600"
          : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`text-2xl font-semibold tracking-tight ${ring}`}>{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-700">{label}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default async function CommandCenterPage() {
  const org = await requireOrg();

  const [prospects, proposals, leads, previews, previewStats, outreach, costToday, costMonth, runs, retainers, portals, businesses, collectedPence] =
    await Promise.all([
      getProspectsForOrg(org.id),
      getProposalsForOrg(org.id),
      getLeadsForOrg(org.id),
      getPreviewsForOrg(org.id),
      getPreviewStatsForOrg(org.id),
      getOutreachForOrg(org.id),
      getCostToday(org.id),
      getCostThisMonth(org.id),
      getRecentAgentRuns(org.id, 200),
      getRetainersForOrg(org.id),
      getPortalsForOrg(org.id),
      getBusinessesForOrg(org.id),
      getCollectedTotalForOrg(org.id),
    ]);

  // ---- Pipeline ---------------------------------------------------------------
  const byStage: Record<ProspectStatus, number> = {
    discovered: 0, analysed: 0, previewed: 0, contacted: 0,
    responded: 0, negotiating: 0, won: 0, lost: 0,
  };
  for (const p of prospects) byStage[p.status] += 1;
  const open = prospects.filter((p) => p.status !== "won" && p.status !== "lost");
  const wonProspects = prospects.filter((p) => p.status === "won");
  const demos = previews.filter((pv) => pv.status === "active").length;
  const outreachSent = outreach.filter((m) => m.status === "sent").length;
  const proposalsSent = proposals.filter((pr) => pr.status === "sent" || pr.status === "accepted").length;
  const accepted = proposals.filter((pr) => pr.status === "accepted");

  // ---- Revenue ----------------------------------------------------------------
  const openPipelinePence = open.reduce((s, p) => s + p.valueEstimate, 0);
  const wonValuePence = accepted.reduce((s, pr) => s + pr.pricePence, 0);
  const avgDealPence = accepted.length ? Math.round(wonValuePence / accepted.length) : 0;
  // "Revenue generated for clients": modelled monthly uplift across won customers
  // (their lead-intel missed-revenue estimate — clearly an estimate, see Phase 2).
  const clientUpliftPence = wonProspects.reduce(
    (s, p) => s + buildLeadIntelReport(p).roi.estMissedValuePence,
    0
  );

  // ---- Goal: £1000/mo recurring ----------------------------------------------
  // TRUE MRR = sum of ACTIVE client retainers (real, agreed, drops on churn). If
  // none have been opened yet, fall back to a projection (won clients × £39) so a
  // fresh org still sees the target — clearly labelled below as projected vs real.
  const TARGET_PENCE = 100_000; // £1,000/mo
  const realMrrPence = activeMrrPence(retainers);
  const activeRetainers = retainers.filter((r) => r.status === "active").length;
  const hasRetainers = retainers.length > 0;
  const recurringPence = hasRetainers ? realMrrPence : wonProspects.length * DEFAULT_RETAINER_PENCE;
  const goalPct = Math.min(100, Math.round((recurringPence / TARGET_PENCE) * 100));
  const clientsToGoal = Math.max(0, Math.ceil((TARGET_PENCE - recurringPence) / DEFAULT_RETAINER_PENCE));

  // ---- AI performance ---------------------------------------------------------
  const finished = runs.filter((r) => r.status === "completed" || r.status === "failed");
  const successRate = finished.length
    ? Math.round((runs.filter((r) => r.status === "completed").length / finished.length) * 100)
    : null;
  const costPerProspect = prospects.length ? Math.round(costMonth / prospects.length) : 0;
  const costPerDemo = previews.length ? Math.round(costMonth / previews.length) : 0;
  const demoOpens = Object.values(previewStats).reduce((s, st) => s + st.views, 0);
  const demoActions = Object.values(previewStats).reduce((s, st) => s + st.conversions, 0);

  const maxStage = Math.max(1, ...PROSPECT_STATUSES.map((s) => byStage[s]));

  // ---- CRM: next action + staleness so no lead goes quiet -----------------------
  const previewByProspect: Record<string, SitePreview> = {};
  for (const pv of previews) {
    if (pv.status !== "active") continue;
    const cur = previewByProspect[pv.prospectId];
    if (!cur || pv.createdAt > cur.createdAt) previewByProspect[pv.prospectId] = pv;
  }
  const outreachByProspect: Record<string, OutreachMessage[]> = {};
  for (const m of outreach) (outreachByProspect[m.prospectId] ??= []).push(m);
  const proposalByProspect: Record<string, Proposal> = {};
  for (const pr of proposals) {
    const cur = proposalByProspect[pr.prospectId];
    if (!cur || pr.createdAt > cur.createdAt) proposalByProspect[pr.prospectId] = pr;
  }
  const onboardedProspectIds = new Set(
    portals.map((p) => p.prospectId).filter((id): id is string => Boolean(id))
  );
  const crmStates = buildCrmStates(prospects, {
    previewByProspect,
    outreachByProspect,
    proposalByProspect,
    onboardedProspectIds,
  });
  const prospectById = new Map(prospects.map((p) => [p.id, p]));
  const allAttention = needsAttention(Object.values(crmStates));
  const attention = allAttention.slice(0, 6);
  const URGENCY_DOT = { high: "bg-red-500", medium: "bg-amber-500", low: "bg-slate-300" } as const;

  // ---- NEXUS: the agency as a living station, every node a real entity ----------
  const now = Date.now();
  const within = (iso: string, ms: number) => now - new Date(iso).getTime() <= ms;
  const DAY = 86_400_000;
  const discoveryLast7d = prospects.filter((p) => within(p.createdAt, 7 * DAY)).length;
  const throughput24h = runs.filter((r) => within(r.createdAt, DAY)).length;

  const publishedBusinesses = businesses.filter((b) => b.status === "published");
  const draftBusinesses = businesses.filter((b) => b.status !== "published");
  const customDomainCount = businesses.filter((b) => b.customDomain).length;
  const auditedCount = prospects.filter((p) => p.analysis?.audit).length;
  const analysedCount = prospects.filter((p) => p.analysis).length;
  const activePortals = portals.filter((p) => p.status === "active").length;

  const graph = buildBusinessGraph(prospects);
  const nexusClusters = graph.clusters.slice(0, 4).map((c) => ({
    label: `${c.category} · ${c.city}`,
    size: c.size,
    dominationScore: c.dominationScore,
  }));

  // Agent units — state from real recent runs (active if it ran in the last 24h).
  const agents: NexusAgent[] = Object.keys(AGENT_LABELS).map((kind) => {
    const mine = runs.filter((r) => r.kind === kind);
    const runs24h = mine.filter((r) => within(r.createdAt, DAY)).length;
    const latest = mine[0]; // getRecentAgentRuns is newest-first
    const state: NexusAgent["state"] =
      runs24h > 0 ? "active" : latest?.status === "failed" ? "failed" : "idle";
    return { kind, label: AGENT_LABELS[kind], state, runs24h };
  });

  const proposalValuePence = proposals
    .filter((pr) => pr.status === "sent")
    .reduce((s, pr) => s + pr.pricePence, 0);
  const ltvPence = recurringPence * 24 + wonValuePence; // modelled 24-month client value

  // Composite health (0–100) from real signals; light penalty for neglected leads.
  const cGoal = goalPct;
  const cSuccess = successRate ?? 60;
  const cActivity = Math.min(100, throughput24h * 8 + discoveryLast7d * 4);
  const cPipeline = Math.min(100, open.length * 5);
  const cDemos = Math.min(100, demos * 12);
  const health = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        cGoal * 0.3 + cSuccess * 0.25 + cActivity * 0.2 + cPipeline * 0.15 + cDemos * 0.1
      ) - Math.min(15, allAttention.length * 3)
    )
  );

  const empire = buildEmpirePortfolio({
    clusters: graph.clusters,
    retainers,
    liveSites: publishedBusinesses.length,
    prospectCount: prospects.length,
    orgName: org.name,
  });
  const topOpp = empire.opportunities[0] ?? null;

  const nexusData: NexusData = {
    health,
    mrrPence: recurringPence,
    targetPence: TARGET_PENCE,
    pipelinePence: openPipelinePence,
    proposalValuePence,
    wonValuePence,
    ltvPence,
    throughput24h,
    discoveryVelocity7d: discoveryLast7d,
    successRate,
    discovery: { total: prospects.length, last7d: discoveryLast7d, clusters: nexusClusters },
    intelligence: { analysed: analysedCount, audited: auditedCount },
    factory: { building: draftBusinesses.length, demos, live: publishedBusinesses.length },
    sales: { outreachSent, proposalsSent, responded: byStage.responded, won: byStage.won },
    deployment: { published: publishedBusinesses.length, customDomains: customDomainCount },
    success: {
      clients: activePortals,
      thriving: Math.max(0, activePortals - allAttention.filter((a) => a.stage === "won").length),
      attention: allAttention.length,
    },
  };

  return (
    <div className="space-y-6">
      {/* THE NEXUS — the agency as a living operations station (primary view). */}
      <Nexus data={nexusData} agents={agents} orgName={org.name} />

      {/* AUTOPILOT — drive the whole funnel start-to-finish in one pass. */}
      <AutopilotButton />

      {/* EMPIRE — the owner's portfolio: assets + the best opportunity to compound. */}
      <Link
        href="/admin/empire"
        className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-50 to-white p-4 transition-colors hover:border-fuchsia-400"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-500">Empire · portfolio</div>
            <div className="text-lg font-semibold text-slate-900">
              {gbp(empire.assetValuePence)} <span className="text-sm font-normal text-slate-400">value · {gbp(empire.totalMrrPence)}/mo · {empire.assets.length} assets</span>
            </div>
          </div>
          {topOpp && (
            <div className="border-l border-fuchsia-200 pl-6">
              <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Top opportunity</div>
              <div className="text-sm font-medium text-slate-800">
                {topOpp.title} <span className="text-fuchsia-600">· empire {topOpp.empireScore}</span>
              </div>
            </div>
          )}
        </div>
        <span className="font-mono text-xs uppercase tracking-widest text-fuchsia-600 group-hover:text-fuchsia-700">open empire ▸</span>
      </Link>

      {/* Classic readouts remain available as a secondary, detailed view. */}
      <details className="group">
        <summary className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-400 group-open:hidden">▸</span>
          <span className="hidden font-mono text-xs uppercase tracking-widest text-slate-400 group-open:inline">▾</span>
          Operational readouts (classic metrics)
        </summary>

        <div className="mt-6 space-y-8">

      {/* GOAL — progress to £1,000/mo recurring. Honest: £0 actual reads as £0. */}
      {recurringPence === 0 && wonValuePence === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Revenue · £0 so far</h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            No clients won yet — you&apos;re at the start.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Nothing here is earned until a deal closes. The path to your first £1,000/mo:
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-5">
            {[
              { n: 1, label: "Find businesses", done: prospects.length > 0 },
              { n: 2, label: "Build demos", done: demos > 0 },
              { n: 3, label: "Send outreach", done: outreachSent > 0 },
              { n: 4, label: "Send proposals", done: proposalsSent > 0 },
              { n: 5, label: "Close a deal", done: false },
            ].map((s) => (
              <li
                key={s.n}
                className={`rounded-xl border p-3 text-sm ${
                  s.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"
                }`}
              >
                <span className="font-semibold">{s.done ? "✓" : s.n}</span> {s.label}
              </li>
            ))}
          </ol>
          <Link
            href="/admin/prospects"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {prospects.length === 0 ? "Find your first businesses →" : "Work your pipeline →"}
          </Link>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Goal · £1,000/mo recurring{hasRetainers ? "" : " (projected)"}
              </h2>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {gbp(recurringPence)}<span className="text-base font-normal text-slate-400">/mo</span>
                <span className="ml-2 text-sm font-medium text-slate-500">{goalPct}%</span>
              </p>
            </div>
            <p className="text-sm text-slate-500">
              {clientsToGoal === 0
                ? "🎯 Target hit — push for the next £1k."
                : `${clientsToGoal} more client${clientsToGoal === 1 ? "" : "s"} at £39/mo to hit £1,000.`}
            </p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${goalPct >= 100 ? "bg-emerald-500" : "bg-slate-900"}`}
              style={{ width: `${Math.max(2, goalPct)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {hasRetainers
              ? `Real agreed MRR across ${activeRetainers} active retainer${activeRetainers === 1 ? "" : "s"} — manage them in Customers.`
              : `Projected at £39/mo per won client (${wonProspects.length} won) — open a retainer in Customers to track real MRR.`}{" "}
            Plus {gbp(wonValuePence)} in one-off build fees booked.
          </p>
        </section>
      )}

      {/* NEEDS ATTENTION — the CRM safety net: no lead goes quiet without a reason. */}
      {attention.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Needs attention
            </h2>
            <Link href="/admin/prospects" className="text-xs font-medium text-slate-500 hover:text-slate-900">
              Work pipeline →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {attention.map((s) => {
              const p = prospectById.get(s.prospectId);
              if (!p) return null;
              return (
                <li key={s.prospectId} className="flex items-center gap-3 py-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${URGENCY_DOT[s.urgency]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {p.name}
                      <span className="ml-2 text-xs font-normal capitalize text-slate-400">{STAGE_LABEL[s.stage]}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {s.nextAction}
                      {s.reason ? ` · ${s.reason}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {s.daysSinceActivity === 0 ? "today" : `${s.daysSinceActivity}d ago`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* REVENUE — the headline metric. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Revenue</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Collected (paid)" value={gbp(collectedPence)} hint={collectedPence > 0 ? "real cash via Stripe" : "no card payments yet"} accent="emerald" />
          <Stat label="Signed (agreed)" value={gbp(wonValuePence)} hint={`${accepted.length} deal${accepted.length === 1 ? "" : "s"} accepted`} />
          <Stat label="Open pipeline (potential)" value={gbp(openPipelinePence)} hint={`${open.length} live deals — not earned`} accent="indigo" />
          <Stat label="Avg deal size" value={accepted.length ? gbp(avgDealPence) : "—"} hint="accepted proposals" />
          <Stat label="Est. client uplift" value={clientUpliftPence ? `${gbp(clientUpliftPence)}/mo` : "—"} hint="projected for won clients" accent="amber" />
        </div>
      </section>

      {/* LEAD PIPELINE — the funnel. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Lead pipeline</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Prospects" value={prospects.length} hint={`${byStage.discovered} new`} />
          <Stat label="Demos built" value={demos} hint="active preview links" accent="indigo" />
          <Stat label="Outreach sent" value={outreachSent} hint={`${outreach.length} drafted`} />
          <Stat label="Proposals" value={proposalsSent} hint="sent or accepted" />
          <Stat label="Deals won" value={byStage.won} hint={`${byStage.lost} lost`} accent="emerald" />
        </div>

        {/* Compact stage funnel. */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-2">
            {PROSPECT_STATUSES.filter((s) => s !== "lost").map((s) => (
              <div key={s} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-medium text-slate-500">{STAGE_LABEL[s]}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${(byStage[s] / maxStage) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700">{byStage[s]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI PERFORMANCE — unit economics. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">AI performance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="AI spend (30d)" value={gbp(costMonth)} hint={`${gbp(costToday)} today`} />
          <Stat label="Cost / prospect" value={prospects.length ? gbp(costPerProspect) : "—"} hint="30d spend ÷ prospects" />
          <Stat label="Cost / demo" value={previews.length ? gbp(costPerDemo) : "—"} hint="30d spend ÷ demos" />
          <Stat label="Agent success" value={successRate === null ? "—" : `${successRate}%`} hint={`${finished.length} runs`} accent="emerald" />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Demo engagement: {demoOpens} open{demoOpens === 1 ? "" : "s"}
          {demoActions > 0 ? ` · ${demoActions} conversion action${demoActions === 1 ? "" : "s"}` : ""}
          {leads.length > 0 ? ` · ${leads.length} site lead${leads.length === 1 ? "" : "s"} captured` : ""}.
          {" "}AI cost-per-lead and demo analytics fill in once migrations 0010/0011 are applied.
        </p>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        On the <span className="font-medium capitalize">{org.plan}</span> plan.
        {org.plan === "trial" && org.trialEndsAt
          ? ` Trial ends ${new Date(org.trialEndsAt).toLocaleDateString("en-GB")}.`
          : ""}{" "}
        <Link href="/admin/billing" className="font-medium text-slate-900 hover:underline">Manage billing →</Link>
      </div>
        </div>
      </details>
    </div>
  );
}
