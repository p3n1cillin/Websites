"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ExperimentSlot } from "@/lib/types";

/**
 * SSG-safe live A/B text (Phase G). It server-renders the control copy (`children`)
 * so the static page, crawlers and first paint always see real content. On mount it
 * asks /api/experiments/active whether a test is running for this business + slot;
 * if so it buckets the visitor (stable in localStorage), records one impression, and
 * — only for a non-control bucket — swaps in the variant text. Any failure silently
 * leaves the control showing, so the public site is never at risk.
 *
 * The visitor's assignment is also written to the `expv` cookie so a later enquiry
 * (the conversion) can be attributed server-side in /api/enquiry.
 */
export default function ExperimentText({
  businessSlug,
  slot,
  children,
}: {
  businessSlug: string;
  slot: ExperimentSlot;
  children: ReactNode;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/experiments/active?business=${encodeURIComponent(businessSlug)}&slot=${slot}`
        );
        if (!res.ok) return;
        const data: {
          experiment: { id: string; variants: { id: string; text: string; control?: boolean }[] } | null;
        } = await res.json();
        const exp = data.experiment;
        if (!exp || exp.variants.length === 0 || cancelled) return;

        // Stable per-visitor assignment.
        const key = `exp_${exp.id}`;
        let variantId = safeGet(key);
        if (!variantId || !exp.variants.some((v) => v.id === variantId)) {
          variantId = exp.variants[Math.floor(Math.random() * exp.variants.length)].id;
          safeSet(key, variantId);
        }
        const variant = exp.variants.find((v) => v.id === variantId);
        if (!variant) return;

        // Record one impression per visitor per experiment.
        const impKey = `exp_imp_${exp.id}`;
        if (!safeGet(impKey)) {
          safeSet(impKey, "1");
          void track(exp.id, variant.id, "impression");
        }

        // Remember the assignment for conversion attribution at enquiry time.
        writeAssignment(exp.id, variant.id);

        // Only swap copy for a non-control bucket (avoids any control-group flash).
        if (!variant.control && !cancelled) setText(variant.text);
      } catch {
        /* control stays */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [businessSlug, slot]);

  return <>{text ?? children}</>;
}

function safeGet(k: string): string | null {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string): void {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

async function track(experimentId: string, variantId: string, type: "impression" | "conversion") {
  try {
    await fetch("/api/experiments/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentId, variantId, type }),
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}

/** Merge this assignment into the `expv` cookie (map of expId → variantId). */
function writeAssignment(expId: string, variantId: string) {
  try {
    const map = readCookieMap();
    map[expId] = variantId;
    document.cookie = `expv=${encodeURIComponent(JSON.stringify(map))}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function readCookieMap(): Record<string, string> {
  const m = document.cookie.match(/(?:^|;\s*)expv=([^;]+)/);
  if (!m) return {};
  try {
    return JSON.parse(decodeURIComponent(m[1])) as Record<string, string>;
  } catch {
    return {};
  }
}
