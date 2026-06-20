"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Workflow, WorkflowStep, WorkflowRun, WorkflowRunStatus } from "@/lib/workflows";
import {
  createStandardWorkflowAction,
  createModeWorkflowAction,
  createWorkflowAction,
  updateWorkflowAction,
  deleteWorkflowAction,
  runWorkflowAction,
  runWorkflowBatchAction,
} from "./actions";

export interface AgentOption {
  kind: string;
  label: string;
}
export interface SeedOption {
  id: string;
  label: string;
}

const AUTONOMY_OPTIONS = ["auto", "approve", "suggest", "off"] as const;

const RUN_BADGE: Record<WorkflowRunStatus, string> = {
  running: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  paused: "bg-amber-100 text-amber-700",
};

function genId(kind: string): string {
  return `${kind}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Workflows({
  workflows,
  runs,
  agentOptions,
  prospectOptions,
  businessOptions,
}: {
  workflows: Workflow[];
  runs: WorkflowRun[];
  agentOptions: AgentOption[];
  prospectOptions: SeedOption[];
  businessOptions: SeedOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, WorkflowStep[]>>({});
  const [addKind, setAddKind] = useState<Record<string, string>>({});
  const [seedP, setSeedP] = useState<Record<string, string>>({});
  const [seedB, setSeedB] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const labelFor = (kind: string) => agentOptions.find((a) => a.kind === kind)?.label ?? kind;
  const wfName = (id: string) => workflows.find((w) => w.id === id)?.name ?? "Workflow";
  const stepsOf = (wf: Workflow) => drafts[wf.id] ?? wf.steps;
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

  function saveSteps(wf: Workflow, steps: WorkflowStep[]) {
    setDrafts((d) => ({ ...d, [wf.id]: steps }));
    run(`save-${wf.id}`, () => updateWorkflowAction(wf.id, { steps }));
  }

  function addStep(wf: Workflow) {
    const kind = addKind[wf.id] ?? agentOptions[0].kind;
    const step: WorkflowStep = {
      id: genId(kind),
      kind: kind as WorkflowStep["kind"],
      autonomy: "auto",
      ...(kind === "conversion" ? { config: { slot: "headline" as const } } : {}),
    };
    saveSteps(wf, [...stepsOf(wf), step]);
  }

  function patchStep(wf: Workflow, idx: number, patch: Partial<WorkflowStep>) {
    const steps = stepsOf(wf).map((s, i) => (i === idx ? { ...s, ...patch } : s));
    saveSteps(wf, steps);
  }

  function removeStep(wf: Workflow, idx: number) {
    saveSteps(wf, stepsOf(wf).filter((_, i) => i !== idx));
  }

  function moveStep(wf: Workflow, idx: number, dir: -1 | 1) {
    const steps = [...stepsOf(wf)];
    const j = idx + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[idx], steps[j]] = [steps[j], steps[idx]];
    saveSteps(wf, steps);
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Create */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <span className="text-xs font-medium text-slate-500">Automation modes:</span>
        {(["research", "demonstration", "growth"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => run(`mode-${mode}`, () => createModeWorkflowAction(mode))}
            disabled={busy[`mode-${mode}`]}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium capitalize text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            + {mode}
          </button>
        ))}
        <button
          onClick={() => run("std", () => createStandardWorkflowAction())}
          disabled={busy.std}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          + Standard pipeline
        </button>
        <span className="text-sm text-slate-400">or</span>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New workflow name"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={() => run("new", () => createWorkflowAction(newName))}
          disabled={busy.new || !newName.trim()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          Create blank
        </button>
      </div>

      {/* Workflows */}
      {workflows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No workflows yet. Create the standard pipeline to wire the agents into one automated run.
        </div>
      ) : (
        workflows.map((wf) => {
          const steps = stepsOf(wf);
          return (
            <div key={wf.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">{wf.name}</h2>
                <div className="flex items-center gap-3 text-xs">
                  <label
                    className="flex items-center gap-1.5 text-slate-500"
                    title="When on, this workflow runs automatically every 2 hours over eligible prospects (unattended)."
                  >
                    <input
                      type="checkbox"
                      checked={wf.enabled}
                      onChange={(e) =>
                        run(`en-${wf.id}`, () => updateWorkflowAction(wf.id, { enabled: e.target.checked }))
                      }
                    />
                    Scheduled
                  </label>
                  <button
                    onClick={() => run(`del-${wf.id}`, () => deleteWorkflowAction(wf.id))}
                    disabled={busy[`del-${wf.id}`]}
                    className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Steps editor */}
              <div className="mt-4 space-y-2">
                {steps.map((s, i) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-mono text-xs text-slate-400">{i + 1}</span>
                    <span className="flex-1 font-medium text-slate-700">{labelFor(s.kind)}</span>
                    {s.kind === "conversion" && (
                      <select
                        value={s.config?.slot ?? "headline"}
                        onChange={(e) => patchStep(wf, i, { config: { slot: e.target.value as "headline" | "cta" } })}
                        className="rounded border border-slate-200 px-1.5 py-1 text-xs"
                      >
                        <option value="headline">headline</option>
                        <option value="cta">cta</option>
                      </select>
                    )}
                    <select
                      value={s.autonomy}
                      onChange={(e) => patchStep(wf, i, { autonomy: e.target.value as WorkflowStep["autonomy"] })}
                      className="rounded border border-slate-200 px-1.5 py-1 text-xs"
                    >
                      {AUTONOMY_OPTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => moveStep(wf, i, -1)} disabled={i === 0} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-20">▲</button>
                    <button onClick={() => moveStep(wf, i, 1)} disabled={i === steps.length - 1} className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-20">▼</button>
                    <button onClick={() => removeStep(wf, i)} className="px-1 text-slate-400 hover:text-red-600">✕</button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <select
                    value={addKind[wf.id] ?? agentOptions[0].kind}
                    onChange={(e) => setAddKind((a) => ({ ...a, [wf.id]: e.target.value }))}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    {agentOptions.map((a) => (
                      <option key={a.kind} value={a.kind}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => addStep(wf)}
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100"
                  >
                    + Add step
                  </button>
                </div>
              </div>

              {/* Run */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-sm">
                <span className="text-xs font-medium text-slate-500">Run over:</span>
                <select
                  value={seedP[wf.id] ?? ""}
                  onChange={(e) => setSeedP((s) => ({ ...s, [wf.id]: e.target.value }))}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">— prospect —</option>
                  {prospectOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={seedB[wf.id] ?? ""}
                  onChange={(e) => setSeedB((s) => ({ ...s, [wf.id]: e.target.value }))}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                >
                  <option value="">— business —</option>
                  {businessOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    run(`run-${wf.id}`, () =>
                      runWorkflowAction(wf.id, { prospectId: seedP[wf.id], businessId: seedB[wf.id] })
                    )
                  }
                  disabled={busy[`run-${wf.id}`] || steps.length === 0}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {busy[`run-${wf.id}`] ? "Running…" : "Run now"}
                </button>
                <button
                  onClick={() => run(`batch-${wf.id}`, () => runWorkflowBatchAction(wf.id))}
                  disabled={busy[`batch-${wf.id}`] || steps.length === 0}
                  title="Run this workflow over all eligible prospects (those in the status its first step consumes)."
                  className="rounded-lg border border-violet-300 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                >
                  {busy[`batch-${wf.id}`] ? "Running batch…" : "Run over all eligible"}
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Run history */}
      {runs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Recent runs</h2>
          <div className="mt-3 space-y-2">
            {runs.map((r) => (
              <details key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">{wfName(r.workflowId)}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleString()}
                    <span className={`rounded-full px-2 py-0.5 font-semibold uppercase ${RUN_BADGE[r.status]}`}>
                      {r.status}
                    </span>
                  </span>
                </summary>
                <div className="mt-2 space-y-1">
                  {r.log.length === 0 && <p className="text-xs text-slate-400">No steps ran.</p>}
                  {r.log.map((l) => (
                    <div key={l.index} className="flex items-start gap-2 text-xs">
                      <span className="text-slate-400">{l.index + 1}</span>
                      <span className="font-medium text-slate-600">{labelFor(l.kind)}</span>
                      <span className={l.status === "completed" ? "text-emerald-600" : "text-slate-500"}>
                        {l.status}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-slate-500">{l.error || l.summary}</span>
                    </div>
                  ))}
                  {r.error && <p className="text-xs text-red-600">{r.error}</p>}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
