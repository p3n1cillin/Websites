import { sbSelect, sbInsert, supabaseWritable } from "./supabase/client";
import type { PreviewEventType, PreviewStats } from "./types";

/**
 * Shareable-demo analytics (Agency OS — Phase 3). Records per-interaction events
 * on a tokenised /preview/[token] demo and aggregates them for the prospect board.
 *
 * EVERYTHING here is best-effort and NEVER throws: a missing `preview_events` table
 * (before migration 0010 is applied) or any transient failure degrades to "no
 * analytics" rather than breaking a public demo or the admin board.
 */

interface EventRow {
  preview_id: string;
  type: string;
  value_ms: number | null;
  created_at: string;
}

export async function recordPreviewEvent(input: {
  orgId: string;
  previewId: string;
  type: PreviewEventType;
  label?: string | null;
  path?: string | null;
  valueMs?: number | null;
}): Promise<void> {
  if (!supabaseWritable) return;
  try {
    await sbInsert("preview_events", {
      org_id: input.orgId,
      preview_id: input.previewId,
      type: input.type,
      label: input.label ?? null,
      path: input.path ?? null,
      value_ms: input.valueMs ?? null,
    });
  } catch {
    /* analytics are best-effort — never break the demo */
  }
}

/** Aggregate engagement per preview for the whole org. Returns {} on any failure. */
export async function getPreviewStatsForOrg(orgId: string): Promise<Record<string, PreviewStats>> {
  if (!supabaseWritable) return {};
  try {
    const rows = await sbSelect<EventRow>({
      query: `preview_events?select=preview_id,type,value_ms,created_at&org_id=eq.${encodeURIComponent(
        orgId
      )}&order=created_at.desc&limit=5000`,
      tier: "service",
    });
    const out: Record<string, PreviewStats> = {};
    for (const r of rows) {
      const s = (out[r.preview_id] ??= { views: 0, conversions: 0, dwellMs: 0, lastEventAt: null });
      if (r.type === "view") s.views += 1;
      else if (r.type === "conversion") s.conversions += 1;
      if (r.type === "dwell" && r.value_ms) s.dwellMs += r.value_ms;
      if (!s.lastEventAt || r.created_at > s.lastEventAt) s.lastEventAt = r.created_at;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Isolated, best-effort read of a demo's optional password by token (migration
 * 0010). Returns null when there's no gate OR when the column/table isn't there
 * yet — so an un-migrated deployment treats every link as open rather than 500ing.
 */
export async function getPreviewPassword(token: string): Promise<string | null> {
  if (!token || !supabaseWritable) return null;
  try {
    const rows = await sbSelect<{ password: string | null }>({
      query: `site_previews?select=password&preview_token=eq.${encodeURIComponent(token)}&limit=1`,
      tier: "service",
    });
    return rows[0]?.password ?? null;
  } catch {
    return null; // column not present yet → no gate
  }
}
