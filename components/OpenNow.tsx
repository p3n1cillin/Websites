"use client";

import { useEffect, useState } from "react";
import type { Business } from "@/lib/types";
import { computeOpenState, type OpenState } from "@/lib/hours";

/**
 * Live "Open now / Closed" badge (Phase 5 — live data). Computes status from the
 * visitor's current time on the client, so a statically-generated page still shows
 * a real, ticking status (re-evaluates every minute). Renders nothing until mounted
 * (avoids SSR/hydration mismatch) and nothing when hours can't be parsed.
 */
export default function OpenNow({
  business,
  className = "",
}: {
  business: Business;
  className?: string;
}) {
  const [state, setState] = useState<OpenState | null>(null);

  useEffect(() => {
    const update = () => setState(computeOpenState(business.openingHours, new Date()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [business.openingHours]);

  if (!state) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        state.open ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
      } ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${state.open ? "bg-emerald-500" : "bg-slate-400"}`}
        aria-hidden
      />
      {state.label}
    </span>
  );
}
