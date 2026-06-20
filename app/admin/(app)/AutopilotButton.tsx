"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runAutopilotNowAction } from "./autopilot-actions";
import type { AutopilotResult } from "@/lib/autopilot";

/**
 * One-click Autopilot — drives the whole funnel forward and shows what it did +
 * what's blocked on a human. The unattended cron tick runs the same engine.
 */
export default function AutopilotButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AutopilotResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    setResult(null);
    start(async () => {
      try {
        const res = await runAutopilotNowAction();
        if (!res.ok || !res.result) setError(res.error || "Autopilot failed.");
        else {
          setResult(res.result);
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Autopilot failed.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-50 to-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-600">Autopilot</div>
          <p className="text-sm text-slate-700">
            Drive the whole funnel one pass — discover, build demos, send due outreach, advance ventures.
            <span className="text-slate-400"> Runs automatically on the cron tick too.</span>
          </p>
        </div>
        <button
          onClick={run}
          disabled={pending}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          {pending ? "Running…" : "Run autopilot now"}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-700">
            <span><b>{result.discovered}</b> discovered</span>
            <span><b>{result.demosBuilt}</b> demos built</span>
            <span><b>{result.outreachSent}</b> outreach sent</span>
            <span><b>{result.venturesPursued}</b> ventures started</span>
            <span><b>{result.venturesAdvanced}</b> advanced</span>
          </div>
          {result.blocked.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">Needs you (autopilot can&apos;t do these):</p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                {result.blocked.map((b, i) => (
                  <li key={i}>• {b}</li>
                ))}
              </ul>
            </div>
          )}
          {result.notes.length > 0 && (
            <p className="text-xs text-slate-400">{result.notes.join(" ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
