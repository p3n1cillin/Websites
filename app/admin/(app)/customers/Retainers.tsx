"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RETAINER_STATUSES, type ClientRetainer, type RetainerStatus } from "@/lib/types";
import { setRetainerStatusAction, setRetainerAmountAction } from "./actions";

const STATUS_BADGE: Record<RetainerStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const gbp = (pence: number) => `£${(pence / 100).toLocaleString("en-GB")}`;

/** Recurring-revenue ledger: real, agreed monthly fees per won client → true MRR. */
export default function Retainers({ retainers }: { retainers: ClientRetainer[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(retainers.map((r) => [r.id, (r.monthlyPence / 100).toString()]))
  );
  const [, startTransition] = useTransition();

  const mrr = retainers.filter((r) => r.status === "active").reduce((s, r) => s + r.monthlyPence, 0);
  const activeCount = retainers.filter((r) => r.status === "active").length;

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
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recurring revenue (MRR)
          </h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {gbp(mrr)}<span className="text-base font-normal text-slate-400">/mo</span>
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {activeCount} active retainer{activeCount === 1 ? "" : "s"} of {retainers.length}
        </p>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {retainers.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No retainers yet. One opens automatically when you win a deal.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {retainers.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-400">
                  since {new Date(r.startedAt).toLocaleDateString("en-GB")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[r.status]}`}>
                  {r.status}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">£</span>
                  <input
                    type="number"
                    min={0}
                    value={amounts[r.id] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [r.id]: e.target.value }))}
                    className="w-20 rounded-md border border-slate-200 px-2 py-1"
                  />
                  <span className="text-slate-400">/mo</span>
                  <button
                    onClick={() =>
                      run(`amt-${r.id}`, () =>
                        setRetainerAmountAction(r.id, parseFloat(amounts[r.id] || "0"))
                      )
                    }
                    disabled={busy[`amt-${r.id}`] || (amounts[r.id] ?? "") === (r.monthlyPence / 100).toString()}
                    className="rounded-md bg-slate-900 px-2 py-1 font-medium text-white hover:bg-slate-700 disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
                <select
                  value={r.status}
                  onChange={(e) =>
                    run(`st-${r.id}`, () =>
                      setRetainerStatusAction(r.id, e.target.value as RetainerStatus)
                    )
                  }
                  disabled={busy[`st-${r.id}`]}
                  className="rounded-md border border-slate-200 px-1.5 py-1 disabled:opacity-50"
                >
                  {RETAINER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
