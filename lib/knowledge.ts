import { revalidatePath } from "next/cache";
import { sbSelect, sbInsert, sbUpdate, supabaseWritable } from "./supabase/client";

/**
 * AI Knowledge / learning layer (Agency OS). Org-scoped memory the agents accrue
 * and read back. Generic key/value; two kinds today (industry_profile,
 * winning_pattern). Service-role; never throws on read so agents degrade cleanly.
 */

export type KnowledgeKind = "industry_profile" | "winning_pattern";

export interface KnowledgeEntry<V = unknown> {
  id: string;
  orgId: string;
  kind: KnowledgeKind;
  key: string;
  value: V;
  hits: number;
  createdAt: string;
  updatedAt: string;
}

/** What we've learned an industry typically needs (structure, not bespoke copy). */
export interface IndustryProfileKnowledge {
  industry: string;
  categoryLabel?: string;
  services: string[];
  highlights: string[];
  faqs: string[];
  personality?: string;
  needsMenu?: boolean;
}

/** Copy that has won A/B tests for an industry + slot. */
export interface WinningPatternKnowledge {
  slot: string;
  texts: string[];
}

interface Row {
  id: string;
  org_id: string;
  kind: KnowledgeKind;
  key: string;
  value: unknown;
  hits: number;
  created_at: string;
  updated_at: string;
}

const COLS = "select=id,org_id,kind,key,value,hits,created_at,updated_at";

function toEntry<V>(row: Row): KnowledgeEntry<V> {
  return {
    id: row.id,
    orgId: row.org_id,
    kind: row.kind,
    key: row.key,
    value: row.value as V,
    hits: row.hits,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const norm = (s: string) => s.trim().toLowerCase();

export async function getKnowledge<V>(
  orgId: string,
  kind: KnowledgeKind,
  key: string
): Promise<KnowledgeEntry<V> | null> {
  if (!supabaseWritable) return null;
  try {
    const rows = await sbSelect<Row>({
      query: `knowledge?${COLS}&org_id=eq.${encodeURIComponent(orgId)}&kind=eq.${kind}&key=eq.${encodeURIComponent(norm(key))}&limit=1`,
      tier: "service",
    });
    return rows[0] ? toEntry<V>(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function listKnowledge(
  orgId: string,
  kind?: KnowledgeKind
): Promise<KnowledgeEntry[]> {
  if (!supabaseWritable) return [];
  try {
    const k = kind ? `&kind=eq.${kind}` : "";
    const rows = await sbSelect<Row>({
      query: `knowledge?${COLS}&org_id=eq.${encodeURIComponent(orgId)}${k}&order=updated_at.desc&limit=200`,
      tier: "service",
    });
    return rows.map((r) => toEntry(r));
  } catch {
    return [];
  }
}

/** Insert or refresh a knowledge row (bumping hits). Best-effort; never throws. */
export async function upsertKnowledge(input: {
  orgId: string;
  kind: KnowledgeKind;
  key: string;
  value: unknown;
  bumpHits?: boolean;
}): Promise<void> {
  if (!supabaseWritable) return;
  try {
    const existing = await getKnowledge(input.orgId, input.kind, input.key);
    if (existing) {
      await sbUpdate("knowledge", `id=eq.${encodeURIComponent(existing.id)}`, {
        value: input.value,
        hits: existing.hits + (input.bumpHits ? 1 : 0),
      });
    } else {
      await sbInsert("knowledge", {
        org_id: input.orgId,
        kind: input.kind,
        key: norm(input.key),
        value: input.value,
        hits: 0,
      });
    }
    revalidatePath("/admin/knowledge");
  } catch {
    /* learning is best-effort — never break the agent run */
  }
}

// ---------------------------------------------------------------------------
// Typed helpers for the two learning loops.
// ---------------------------------------------------------------------------

export async function getIndustryKnowledge(
  orgId: string,
  industry: string
): Promise<IndustryProfileKnowledge | null> {
  const e = await getKnowledge<IndustryProfileKnowledge>(orgId, "industry_profile", industry);
  return e?.value ?? null;
}

export async function recordIndustryProfile(
  orgId: string,
  profile: IndustryProfileKnowledge
): Promise<void> {
  await upsertKnowledge({
    orgId,
    kind: "industry_profile",
    key: profile.industry,
    value: profile,
    bumpHits: true,
  });
}

export async function getWinningPatterns(
  orgId: string,
  industry: string,
  slot: string
): Promise<string[]> {
  const e = await getKnowledge<WinningPatternKnowledge>(orgId, "winning_pattern", `${industry}|${slot}`);
  return e?.value?.texts ?? [];
}

/** Append a winning copy text for an industry+slot (deduped, most-recent first). */
export async function recordWinningPattern(
  orgId: string,
  industry: string,
  slot: string,
  text: string
): Promise<void> {
  const key = `${industry}|${slot}`;
  const existing = await getKnowledge<WinningPatternKnowledge>(orgId, "winning_pattern", key);
  const prior = existing?.value?.texts ?? [];
  const texts = [text, ...prior.filter((t) => t !== text)].slice(0, 5);
  await upsertKnowledge({
    orgId,
    kind: "winning_pattern",
    key,
    value: { slot, texts } satisfies WinningPatternKnowledge,
    bumpHits: true,
  });
}
