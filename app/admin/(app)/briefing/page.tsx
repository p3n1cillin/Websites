import Link from "next/link";
import { requireOrg } from "@/lib/auth";
import { getProspectsForOrg } from "@/lib/prospects";
import { getPreviewsForOrg } from "@/lib/previews";
import { getRetainersForOrg } from "@/lib/retainers";
import { buildGoalStatus } from "@/lib/goal-engine";
import { getSetupChecklist } from "@/lib/setup-checklist";
import { getRecentAgentRuns } from "@/lib/agent-runs";
import { getPendingApprovals } from "@/lib/approvals";
import { loopStateTableReadable, readLoopState } from "@/lib/operator-digest";
import { supabaseConfigured, supabaseWritable } from "@/lib/supabase/client";

/**
 * Operator Briefing — the 5-hour empire mode cockpit. One screen answering one
 * question: "what stands between me and £1,000/mo?" Goal progress (real MRR),
 * funnel state, the setup checklist for one-off autonomy work, pending human
 * approvals and recent loop failures — all real data, models labelled.
 */
export const dynamic = "force-dynamic";

const gbp = (pence: number) => `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

const EFFORT_STYLE: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

export default async function BriefingPage() {
  const org = await requireOrg();
  const [prospects, previews, retainers, runs, approvals, migrationsReadable] = await Promise.all([
    getProspectsForOrg(org.id),
    getPreviewsForOrg(org.id),
    getRetainersForOrg(org.id),
    getRecentAgentRuns(org.id, 50),
    getPendingApprovals(org.id),
    loopStateTableReadable(),
  ]);

  const status = buildGoalStatus(prospects, previews, retainers);
  const checklist = getSetupChecklist({
    supabaseConfigured,
    supabaseWritable,
    loopStateTableReadable: migrationsReadable,
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    cronSecretSet: Boolean(process.env.CRON_SECRET),
    inboundSecretSet: Boolean(process.env.RESEND_INBOUND_SECRET),
    operatorEmailSet: Boolean(process.env.OPERATOR_NOTIFY_EMAIL),
    prospectCount: prospects.length,
  });
  const openTasks = checklist.filter((t) => !t.done);
  const snapshot = await readLoopState<{ at: string; currentMrrPence: number }>(
    org.id,
    "weekly_snapshot"
  );
  const failures = [
    ...new Set(
      runs
        .filter((r) => r.status === "failed" && r.error)
        .map((r) => `${r.kind}: ${r.error}`)
    ),
  ].slice(0, 5);

  const pct = Math.min(100, Math.round(status.coverageRatio !== null ? status.coverageRatio * 100 : 0));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Briefing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everything standing between you and £1,000/mo recurring revenue — loops do the rest.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Nexus
        </Link>
      </div>

      {/* Goal progress */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-2xl font-semibold tracking-tight text-slate-900">
            {gbp(status.currentMrrPence)}
            <span className="text-base font-normal text-slate-400">/mo</span>
          </div>
          <div className="mt-1 text-sm font-medium text-slate-700">Banked MRR</div>
          <div className="text-xs text-slate-400">
            {snapshot ? `last weekly snapshot: ${gbp(snapshot.currentMrrPence)}` : "no snapshots yet"}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-500">{pct}% of the £1,000/mo goal</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className={`text-2xl font-semibold tracking-tight ${status.gapPence > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {gbp(status.gapPence)}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-700">Gap to goal</div>
          <div className="text-xs text-slate-400">
            pipeline model projects {gbp(status.projectedMrrPence)}/mo
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-2xl font-semibold tracking-tight text-slate-900">{openTasks.length}</div>
          <div className="mt-1 text-sm font-medium text-slate-700">Setup tasks left</div>
          <div className="text-xs text-slate-400">
            ~{openTasks.reduce((s, t) => s + t.minutes, 0)} min of one-off work to full autopilot
          </div>
        </div>
      </section>

      {/* Funnel */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Funnel</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Discovered", value: status.counts.discovered },
            { label: "Contacted", value: status.counts.contacted },
            { label: "Demos", value: status.counts.demosBuilt },
            { label: "Replied", value: status.counts.responded },
            { label: "Won", value: status.counts.won },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-xl font-semibold tracking-tight text-slate-900">{s.value}</div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
        {status.notes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {status.notes.map((n) => (
              <li key={n} className="text-xs text-slate-400">
                Model note: {n}
              </li>
            ))}
          </ul>
        )}
      </section>


      {/* Next actions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Highest-leverage moves
        </h2>
        {status.nextActions.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Nothing queued — the loops have everything they need.
          </p>
        ) : (
          <div className="space-y-3">
            {status.nextActions.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">{a.title}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${EFFORT_STYLE[a.effort]}`}>
                      {a.effort} effort
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{a.rationale}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-emerald-600">
                    +{gbp(a.potentialMrrPence)}/mo
                  </div>
                  <Link href={a.where} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                    Open →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          Money figures are explicit models (see notes above), never measured facts.
        </p>
      </section>

      {/* Human gates */}
      {(approvals.length > 0 || failures.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {approvals.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-sm font-semibold text-amber-800">
                {approvals.length} action{approvals.length === 1 ? "" : "s"} need your approval
              </h2>
              <ul className="mt-2 space-y-1.5">
                {approvals.slice(0, 5).map((a) => (
                  <li key={a.id} className="text-xs text-amber-700">
                    • [{a.kind}] {a.summary}
                  </li>
                ))}
              </ul>
              <Link href="/admin/agents" className="mt-3 inline-block text-xs font-semibold text-amber-900 underline">
                Review in Agent Control Centre →
              </Link>
            </div>
          )}
          {failures.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <h2 className="text-sm font-semibold text-rose-800">Recent loop failures</h2>
              <ul className="mt-2 space-y-1.5">
                {failures.map((f) => (
                  <li key={f} className="truncate text-xs text-rose-700" title={f}>
                    • {f}
                  </li>
                ))}
              </ul>
              <Link href="/admin/agents" className="mt-3 inline-block text-xs font-semibold text-rose-900 underline">
                Inspect run history →
              </Link>
            </div>
          )}
        </section>
      )}


      {/* Setup checklist */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          One-off autonomy setup
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Roughly five hours, once. After this the daily tick discovers, builds, sends, chases replies and collects payments without you.
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {checklist.map((t) => (
            <div key={t.id} className="flex items-start gap-3 border-b border-slate-100 p-4 last:border-b-0">
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${
                  t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-slate-400"
                }`}
              >
                {t.done ? "✓" : ""}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${t.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {t.title}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {t.group} · ~{t.minutes} min
                  </span>
                </div>
                {!t.done && <p className="mt-1 text-xs text-slate-500">{t.how}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

