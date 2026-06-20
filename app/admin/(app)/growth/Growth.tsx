"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EXPERIMENT_SLOTS,
  type Experiment,
  type ExperimentSlot,
  type ExperimentStatus,
} from "@/lib/types";
import type { WinnerAnalysis } from "@/lib/experiments";
import {
  createExperimentAction,
  analyseExperimentAction,
  stopExperimentAction,
  deleteExperimentAction,
  generateArticlesAction,
} from "./actions";

export interface GrowthBusiness {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<ExperimentStatus, string> = {
  running: "bg-violet-100 text-violet-700",
  stopped: "bg-slate-100 text-slate-500",
  applied: "bg-emerald-100 text-emerald-700",
};

function pct(conversions: number, impressions: number): string {
  if (impressions === 0) return "—";
  return `${Math.round((conversions / impressions) * 100)}%`;
}

export default function Growth({
  businesses,
  expByBusiness,
}: {
  businesses: GrowthBusiness[];
  expByBusiness: Record<string, Experiment[]>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [slotFor, setSlotFor] = useState<Record<string, ExperimentSlot>>({});
  const [, startTransition] = useTransition();

  const setKey = (k: string, v: boolean) => setBusy((b) => ({ ...b, [k]: v }));

  function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setError(null);
    setKey(key, true);
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) setError(res.error || "Action failed.");
        else {
          onOk?.();
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      } finally {
        setKey(key, false);
      }
    });
  }

  function analyse(expId: string) {
    setError(null);
    setKey(`an-${expId}`, true);
    startTransition(async () => {
      try {
        const res = await analyseExperimentAction(expId);
        if (!res.ok) setError(res.error || "Analysis failed.");
        else {
          if (res.analysis) setNotes((n) => ({ ...n, [expId]: res.analysis!.note }));
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Analysis failed.");
      } finally {
        setKey(`an-${expId}`, false);
      }
    });
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {businesses.map((b) => {
        const slot = slotFor[b.id] ?? "headline";
        const experiments = expByBusiness[b.id] ?? [];
        return (
          <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{b.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={slot}
                  onChange={(e) =>
                    setSlotFor((s) => ({ ...s, [b.id]: e.target.value as ExperimentSlot }))
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 capitalize"
                >
                  {EXPERIMENT_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => run(`new-${b.id}`, () => createExperimentAction(b.id, slot))}
                  disabled={busy[`new-${b.id}`]}
                  className="rounded-md bg-violet-600 px-2.5 py-1 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {busy[`new-${b.id}`] ? "Starting…" : "Start A/B test"}
                </button>
                <button
                  onClick={() =>
                    run(`seo-${b.id}`, () => generateArticlesAction(b.id), undefined)
                  }
                  disabled={busy[`seo-${b.id}`]}
                  className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  {busy[`seo-${b.id}`] ? "Generating…" : "Generate SEO articles"}
                </button>
              </div>
            </div>

            {experiments.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">No experiments yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {experiments.map((exp) => (
                  <div key={exp.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium capitalize text-slate-700">
                        {exp.slot} test
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[exp.status]}`}
                        >
                          {exp.status}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        {exp.status === "running" && (
                          <>
                            <button
                              onClick={() => analyse(exp.id)}
                              disabled={busy[`an-${exp.id}`]}
                              className="rounded-md bg-slate-900 px-2 py-1 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                            >
                              {busy[`an-${exp.id}`] ? "Analysing…" : "Decide winner"}
                            </button>
                            <button
                              onClick={() => run(`stop-${exp.id}`, () => stopExperimentAction(exp.id))}
                              disabled={busy[`stop-${exp.id}`]}
                              className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                            >
                              Stop
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => run(`del-${exp.id}`, () => deleteExperimentAction(exp.id))}
                          disabled={busy[`del-${exp.id}`]}
                          title="Delete"
                          className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {exp.variants.map((v) => {
                        const isWinner = exp.winner === v.id;
                        return (
                          <div
                            key={v.id}
                            className={`flex items-center justify-between gap-3 rounded-md px-2 py-1 text-xs ${
                              isWinner ? "bg-emerald-50" : "bg-white"
                            }`}
                          >
                            <span className="min-w-0 flex-1 truncate text-slate-700">
                              <span className="font-medium">{v.label}</span>
                              {v.control && <span className="ml-1 text-slate-400">(control)</span>}
                              {isWinner && <span className="ml-1 text-emerald-600">★ winner</span>}
                              <span className="ml-2 text-slate-500">“{v.text}”</span>
                            </span>
                            <span className="shrink-0 text-slate-400">
                              {v.conversions}/{v.impressions} · {pct(v.conversions, v.impressions)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {notes[exp.id] && (
                      <p className="mt-2 text-xs text-slate-500">{notes[exp.id]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
