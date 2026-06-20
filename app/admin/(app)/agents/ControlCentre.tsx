"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AgentKind, AgentRunStatus, Autonomy } from "@/lib/agents/types";
import type { AgentRun } from "@/lib/agent-runs";
import type { Approval } from "@/lib/approvals";
import { setAgentSettingsAction, decideApprovalAction } from "./actions";

export interface AgentRow {
  kind: AgentKind;
  title: string;
  description: string;
  defaultAutonomy: Autonomy;
  autonomy: Autonomy;
  dailyCapPence: number | null;
  monthlyCapPence: number | null;
}

export interface CostPoint {
  day: string;
  costPence: number;
  runs: number;
}

interface Stats {
  costToday: number;
  costMonth: number;
  runs14: number;
  pending: number;
  dailyCapPence: number;
  monthlyCapPence: number;
}

const AUTONOMY_BADGE: Record<Autonomy, string> = {
  off: "bg-slate-100 text-slate-500",
  suggest: "bg-sky-100 text-sky-700",
  approve: "bg-amber-100 text-amber-700",
  auto: "bg-emerald-100 text-emerald-700",
};

const RUN_BADGE: Record<AgentRunStatus, string> = {
  running: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  awaiting_approval: "bg-amber-100 text-amber-700",
  blocked: "bg-orange-100 text-orange-700",
  skipped: "bg-slate-100 text-slate-500",
  failed: "bg-red-100 text-red-700",
};

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

interface Edit {
  autonomy: Autonomy;
  daily: string;
  monthly: string;
}

export default function ControlCentre({
  agents,
  runs,
  approvals,
  autonomyLevels,
  stats,
  series,
}: {
  agents: AgentRow[];
  runs: AgentRun[];
  approvals: Approval[];
  autonomyLevels: Autonomy[];
  stats: Stats;
  series: CostPoint[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [, startTransition] = useTransition();

  const setKey = (k: string, v: boolean) => setBusy((b) => ({ ...b, [k]: v }));
  const penceToStr = (p: number | null) => (p != null ? String(p / 100) : "");

  const editFor = (a: AgentRow): Edit =>
    edits[a.kind] ?? {
      autonomy: a.autonomy,
      daily: penceToStr(a.dailyCapPence),
      monthly: penceToStr(a.monthlyCapPence),
    };
  const patchEdit = (kind: string, patch: Partial<Edit>, base: Edit) =>
    setEdits((e) => ({ ...e, [kind]: { ...base, ...patch } }));

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

  function save(a: AgentRow) {
    const e = editFor(a);
    const toPence = (s: string) => {
      const n = Number(s);
      return s.trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
    };
    run(`save-${a.kind}`, () =>
      setAgentSettingsAction(a.kind, e.autonomy, toPence(e.daily), toPence(e.monthly))
    );
  }

  const maxCost = Math.max(1, ...series.map((p) => p.costPence));

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Spend today" value={gbp(stats.costToday)} sub={stats.dailyCapPence ? `cap ${gbp(stats.dailyCapPence)}` : "uncapped"} />
        <Stat label="Spend this month" value={gbp(stats.costMonth)} sub={stats.monthlyCapPence ? `cap ${gbp(stats.monthlyCapPence)}` : "uncapped"} />
        <Stat label="Runs (14d)" value={String(stats.runs14)} />
        <Stat label="Pending approvals" value={String(stats.pending)} />
      </div>

      {/* Cost series */}
      {series.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Daily AI spend (14 days)</h2>
          <div className="mt-3 flex h-24 items-end gap-1">
            {series.map((p) => (
              <div key={p.day} className="flex flex-1 flex-col items-center gap-1" title={`${p.day}: ${gbp(p.costPence)} · ${p.runs} runs`}>
                <div
                  className="w-full rounded-t bg-indigo-400"
                  style={{ height: `${Math.max(2, (p.costPence / maxCost) * 100)}%` }}
                />
                <span className="text-[9px] text-slate-400">{p.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approvals */}
      {approvals.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Pending approvals</h2>
          <div className="mt-2 space-y-2">
            {approvals.map((ap) => (
              <div key={ap.id} className="flex items-start justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium capitalize">{ap.kind}</span> · {ap.summary}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(ap.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button
                    onClick={() => run(`ap-${ap.id}`, () => decideApprovalAction(ap.id, "approved"))}
                    disabled={busy[`ap-${ap.id}`]}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => run(`ap-${ap.id}`, () => decideApprovalAction(ap.id, "rejected"))}
                    disabled={busy[`ap-${ap.id}`]}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agents — autonomy + caps */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Agents</h2>
        <div className="mt-3 space-y-2">
          {agents.map((a) => {
            const e = editFor(a);
            const dirty =
              e.autonomy !== a.autonomy ||
              e.daily !== penceToStr(a.dailyCapPence) ||
              e.monthly !== penceToStr(a.monthlyCapPence);
            return (
              <div key={a.kind} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {a.title}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${AUTONOMY_BADGE[a.autonomy]}`}>
                      {a.autonomy}
                    </span>
                  </p>
                  <p className="truncate text-xs text-slate-500">{a.description}</p>
                </div>
                <select
                  value={e.autonomy}
                  onChange={(ev) => patchEdit(a.kind, { autonomy: ev.target.value as Autonomy }, e)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  {autonomyLevels.map((lv) => (
                    <option key={lv} value={lv}>{lv}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  £/day
                  <input
                    value={e.daily}
                    onChange={(ev) => patchEdit(a.kind, { daily: ev.target.value }, e)}
                    placeholder="∞"
                    inputMode="decimal"
                    className="w-16 rounded-md border border-slate-300 px-1.5 py-1 text-xs"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  £/mo
                  <input
                    value={e.monthly}
                    onChange={(ev) => patchEdit(a.kind, { monthly: ev.target.value }, e)}
                    placeholder="∞"
                    inputMode="decimal"
                    className="w-16 rounded-md border border-slate-300 px-1.5 py-1 text-xs"
                  />
                </label>
                <button
                  onClick={() => save(a)}
                  disabled={!dirty || busy[`save-${a.kind}`]}
                  className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  {busy[`save-${a.kind}`] ? "Saving…" : "Save"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent runs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">No agent runs recorded yet.</p>
        ) : (
          <div className="mt-3 space-y-1">
            {runs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 border-b border-slate-50 py-1.5 text-xs last:border-0">
                <span className="w-28 shrink-0 font-medium capitalize text-slate-700">{r.kind}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold uppercase ${RUN_BADGE[r.status]}`}>
                  {r.status.replace("_", " ")}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-500">{r.error || r.summary || "—"}</span>
                <span className="shrink-0 text-slate-400">{gbp(r.costPence)}</span>
                <span className="shrink-0 text-slate-300">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}
