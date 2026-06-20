import { createHash } from "crypto";
import { sbSelect, sbInsert, sbUpdate, supabaseWritable } from "../supabase/client";

/**
 * AI response cache (Agency OS — Phase 6, token economy).
 *
 * Content-addressed, org-scoped reuse layer so the platform never pays for the
 * same AI generation twice. Agents wrap a `completeJson` call: build a stable key
 * from the inputs that determine the output, check the cache, and on a hit skip
 * the model call entirely (zero tokens, zero cost). On a miss they generate and
 * store the result.
 *
 * Best-effort: with no Supabase (or before migration 0011) every lookup misses and
 * every store is a no-op — the agent simply always calls the model, exactly as before.
 */

/** Build a short, stable cache key from arbitrary parts (hashed). */
export function aiCacheKey(...parts: (string | number | undefined | null)[]): string {
  const basis = parts.map((p) => String(p ?? "")).join("");
  return createHash("sha256").update(basis).digest("hex").slice(0, 40);
}

interface CacheRow {
  id: string;
  value: unknown;
  hits: number;
}

/** Read a cached value (and bump its hit counter). Returns null on miss/any error. */
export async function getAiCache<T>(orgId: string, key: string): Promise<T | null> {
  if (!supabaseWritable) return null;
  try {
    const rows = await sbSelect<CacheRow>({
      query: `ai_cache?select=id,value,hits&org_id=eq.${encodeURIComponent(
        orgId
      )}&cache_key=eq.${encodeURIComponent(key)}&limit=1`,
      tier: "service",
    });
    const row = rows[0];
    if (!row) return null;
    // Fire-and-forget hit bump (don't block the read on it).
    void sbUpdate("ai_cache", `id=eq.${encodeURIComponent(row.id)}`, { hits: row.hits + 1 }).catch(
      () => {}
    );
    return row.value as T;
  } catch {
    return null;
  }
}

/** Store a value under a key (insert or update). Best-effort; never throws. */
export async function setAiCache(
  orgId: string,
  key: string,
  value: unknown,
  model?: string | null
): Promise<void> {
  if (!supabaseWritable) return;
  try {
    const existing = await sbSelect<{ id: string }>({
      query: `ai_cache?select=id&org_id=eq.${encodeURIComponent(
        orgId
      )}&cache_key=eq.${encodeURIComponent(key)}&limit=1`,
      tier: "service",
    });
    if (existing[0]) {
      await sbUpdate("ai_cache", `id=eq.${encodeURIComponent(existing[0].id)}`, {
        value,
        model: model ?? null,
      });
    } else {
      await sbInsert("ai_cache", { org_id: orgId, cache_key: key, value, model: model ?? null });
    }
  } catch {
    /* caching is best-effort — never break an agent run */
  }
}
