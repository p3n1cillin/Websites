"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CHANGE_REQUEST_STATUSES,
  type ChangeRequest,
  type ChangeRequestStatus,
  type CustomerPortalStatus,
  type CustomerReport,
} from "@/lib/types";
import type { RetentionRec } from "@/lib/retention";
import {
  runReportAction,
  setChangeRequestStatusAction,
  deleteChangeRequestAction,
  revokePortalAction,
} from "./actions";

export interface CustomerView {
  portalId: string;
  portalUrl: string;
  portalStatus: CustomerPortalStatus;
  businessId: string;
  name: string;
  published: boolean;
  liveUrl: string;
  requests: ChangeRequest[];
  /** Top upsell/retention recommendations for this live client (expansion revenue). */
  growth: RetentionRec[];
  growthAddonPence: number;
}

const gbpMoney = (pence: number) => `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

const CR_BADGE: Record<ChangeRequestStatus, string> = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-sky-100 text-sky-700",
  done: "bg-emerald-100 text-emerald-700",
  declined: "bg-slate-100 text-slate-500",
};

export default function Customers({ customers }: { customers: CustomerView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, CustomerReport>>({});
  const [, startTransition] = useTransition();

  const setKey = (k: string, v: boolean) => setBusy((b) => ({ ...b, [k]: v }));

  function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setKey(key, true);
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) setError(res.error || "Action failed.");
        else router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      } finally {
        setKey(key, false);
      }
    });
  }

  function runReport(businessId: string) {
    setError(null);
    setKey(`rep-${businessId}`, true);
    startTransition(async () => {
      try {
        const res = await runReportAction(businessId);
        if (!res.ok || !res.report) setError(res.error || "Report failed.");
        else setReports((r) => ({ ...r, [businessId]: res.report! }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Report failed.");
      } finally {
        setKey(`rep-${businessId}`, false);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {customers.map((c) => {
        const report = reports[c.businessId];
        return (
          <div key={c.portalId} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{c.name}</h2>
                <p className="text-xs text-slate-500">
                  {c.published ? "Live" : "Draft — not yet published"}
                  {c.portalStatus === "revoked" ? " · portal revoked" : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {c.published && (
                  <a
                    href={c.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Live site ↗
                  </a>
                )}
                {c.portalStatus === "active" && (
                  <a
                    href={c.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    Portal ↗
                  </a>
                )}
                <button
                  onClick={() => runReport(c.businessId)}
                  disabled={busy[`rep-${c.businessId}`]}
                  className="rounded-md bg-slate-900 px-2.5 py-1 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {busy[`rep-${c.businessId}`] ? "Running…" : "Run report"}
                </button>
                {c.portalStatus === "active" && (
                  <button
                    onClick={() => run(`revoke-${c.portalId}`, () => revokePortalAction(c.portalId))}
                    disabled={busy[`revoke-${c.portalId}`]}
                    className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                  >
                    revoke
                  </button>
                )}
              </div>
            </div>

            {report && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-slate-700">{report.summary}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{report.leads.total} enquiries</span>
                  <span>{report.leads.new} new</span>
                  <span>{report.leads.won} won</span>
                  <span>health {report.qaScore}/100</span>
                  {!report.ai && <span className="uppercase tracking-wide text-slate-400">heuristic</span>}
                </div>
                {report.suggestions.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {report.suggestions.map((s, i) => (
                      <li key={i}>→ {s}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Growth opportunities — upsells that grow the retainer (Retention Engine). */}
            {c.growth.length > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Growth opportunities</h3>
                  <span className="text-xs font-medium text-emerald-700">
                    +{gbpMoney(c.growthAddonPence)}/mo potential
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {c.growth.map((g) => (
                    <li key={g.service} className="flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {g.title}
                          {g.priority === "high" && (
                            <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              top pick
                            </span>
                          )}
                        </p>
                        <p className="text-slate-500">{g.rationale}</p>
                      </div>
                      <span className="shrink-0 text-right text-slate-600">
                        <span className="font-medium">{gbpMoney(g.addonPence)}/mo</span>
                        <span className="block text-[10px] text-slate-400">~{gbpMoney(g.estUpliftPence)}/mo value</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Change requests */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Change requests{c.requests.length ? ` (${c.requests.length})` : ""}
              </h3>
              {c.requests.length === 0 ? (
                <p className="mt-1 text-xs text-slate-400">None yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {c.requests.map((r) => (
                    <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {r.title}
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400">
                            {r.source}
                          </span>
                        </p>
                        {r.detail && <p className="mt-0.5 text-xs text-slate-500">{r.detail}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CR_BADGE[r.status]}`}>
                          {r.status.replace("_", " ")}
                        </span>
                        <select
                          value={r.status}
                          onChange={(e) =>
                            run(`cr-${r.id}`, () =>
                              setChangeRequestStatusAction(r.id, e.target.value as ChangeRequestStatus)
                            )
                          }
                          disabled={busy[`cr-${r.id}`]}
                          className="rounded-md border border-slate-200 px-1.5 py-1 text-xs disabled:opacity-50"
                        >
                          {CHANGE_REQUEST_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => run(`cr-${r.id}`, () => deleteChangeRequestAction(r.id))}
                          disabled={busy[`cr-${r.id}`]}
                          title="Delete request"
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
