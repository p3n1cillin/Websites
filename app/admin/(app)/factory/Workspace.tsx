"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DesignLayout } from "@/lib/design/types";
import type { QaReport } from "@/lib/design/qa";
import { runQaAction, saveDesignAction } from "./actions";

export interface Candidate {
  seed: string;
  layout: DesignLayout;
}

interface Props {
  businessId: string;
  businessName: string;
  businessSlug: string;
  hasSavedDesign: boolean;
  personalityLabel: string;
  /** On-brief variants per slot (the cycle set for "regenerate section"). */
  slotCandidates: Record<string, string[]>;
  slots: string[];
  candidates: Candidate[];
}

type Device = "desktop" | "mobile";
const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, mobile: 390 };

// Thumbnail geometry — each preview is a real page scaled down to fit a column.
const COL_W = 340;
const PREVIEW_H = 520;

const OPTION_LABELS = ["Option A", "Option B", "Option C", "Option D", "Option E"];

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function previewUrl(businessId: string, c: Candidate, slots: string[]): string {
  const params = new URLSearchParams({ seed: c.seed });
  for (const slot of slots) params.set(slot, c.layout[slot as keyof DesignLayout]);
  return `/admin/factory-preview/${businessId}?${params.toString()}`;
}

export default function FactoryWorkspace({
  businessId,
  businessName,
  businessSlug,
  hasSavedDesign,
  personalityLabel,
  slotCandidates,
  slots,
  candidates: initial,
}: Props) {
  const router = useRouter();
  const [device, setDevice] = useState<Device>("desktop");
  const [candidates, setCandidates] = useState<Candidate[]>(initial);
  const [qa, setQa] = useState<Record<number, QaReport | null>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const width = DEVICE_WIDTH[device];
  const scale = COL_W / width;

  const setBusyKey = (key: string, v: boolean) =>
    setBusy((b) => ({ ...b, [key]: v }));

  function regenerate(index: number, slot: string) {
    setCandidates((cs) =>
      cs.map((c, i) => {
        if (i !== index) return c;
        const options = slotCandidates[slot] ?? [];
        const current = c.layout[slot as keyof DesignLayout];
        const at = options.indexOf(current);
        const next = options[(at + 1) % options.length] ?? current;
        return { ...c, layout: { ...c.layout, [slot]: next } };
      })
    );
    setQa((q) => ({ ...q, [index]: null })); // design changed → QA is stale
  }

  function runQa(index: number) {
    setError(null);
    setBusyKey(`qa-${index}`, true);
    startTransition(async () => {
      try {
        const report = await runQaAction(businessId, candidates[index]);
        setQa((q) => ({ ...q, [index]: report }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "QA failed.");
      } finally {
        setBusyKey(`qa-${index}`, false);
      }
    });
  }

  function save(index: number) {
    setError(null);
    setBusyKey(`save-${index}`, true);
    startTransition(async () => {
      try {
        const res = await saveDesignAction(businessId, candidates[index]);
        if (!res.ok) {
          setError(res.error || "Save failed.");
          return;
        }
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      } finally {
        setBusyKey(`save-${index}`, false);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/factory" className="text-sm text-slate-500 hover:text-slate-900">
            ← Factory
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{businessName}</h1>
          <p className="text-sm text-slate-500">
            /{businessSlug} ·{" "}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {personalityLabel}
            </span>
            {hasSavedDesign && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                design saved
              </span>
            )}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-sm">
          {(["desktop", "mobile"] as Device[]).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`rounded-md px-3 py-1.5 font-medium capitalize ${
                device === d ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {saved && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Design saved.{" "}
          <Link href={`/admin/businesses/${businessId}`} className="font-medium underline">
            Go to the business
          </Link>{" "}
          to publish.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <p className="text-sm text-slate-500">
        Three on-brief designs, generated from the same content. Regenerate any section to explore
        alternatives, run the QA gate, then ship the one you like.
      </p>

      <div className="flex flex-wrap gap-5">
        {candidates.map((c, i) => {
          const report = qa[i];
          const url = previewUrl(businessId, c, slots);
          return (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-4"
              style={{ width: COL_W + 32 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold">{OPTION_LABELS[i] ?? `Option ${i + 1}`}</span>
                {report && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      report.pass
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    QA {report.overall} · {report.pass ? "pass" : "review"}
                  </span>
                )}
              </div>

              {/* Live, scaled preview of the actual page. */}
              <div
                className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                style={{ width: COL_W, height: PREVIEW_H }}
              >
                <iframe
                  key={url}
                  src={url}
                  title={`${OPTION_LABELS[i]} preview`}
                  className="origin-top-left border-0 bg-white"
                  style={{
                    width,
                    height: PREVIEW_H / scale,
                    transform: `scale(${scale})`,
                    pointerEvents: "none",
                  }}
                />
              </div>

              {/* Regenerate individual sections. */}
              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Sections
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => regenerate(i, slot)}
                      title={`Cycle ${slot} variant`}
                      className="group rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900"
                    >
                      <span className="font-medium">{titleCase(slot)}</span>
                      <span className="ml-1 text-slate-400 group-hover:text-slate-600">
                        {c.layout[slot as keyof DesignLayout]} ↻
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* QA findings. */}
              {report && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-medium text-slate-700">
                    <span>Content {report.scores.content}</span>
                    <span>Complete {report.scores.completeness}</span>
                    <span>Design {report.scores.design}</span>
                    <span>Unique {report.scores.uniqueness}</span>
                  </div>
                  <ul className="mt-2 list-disc space-y-0.5 pl-4">
                    {report.notes.slice(0, 4).map((n, k) => (
                      <li key={k}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => runQa(i)}
                  disabled={busy[`qa-${i}`]}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
                >
                  {busy[`qa-${i}`] ? "Running…" : "Run QA"}
                </button>
                <button
                  onClick={() => save(i)}
                  disabled={busy[`save-${i}`]}
                  className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {busy[`save-${i}`] ? "Saving…" : "Use this design"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
