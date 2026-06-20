/**
 * Minimal Supabase (PostgREST) access over `fetch` — no extra npm packages,
 * matching the project's existing zero-dependency data layer.
 *
 * Two credential tiers:
 *  - ANON key   : public reads. RLS limits it to `published` rows.
 *  - SERVICE key : server-only writes (admin actions, webhooks). Bypasses RLS;
 *                  authorization is enforced at the application layer.
 *
 * If Supabase isn't configured the project still runs entirely on the bundled
 * local data files (see lib/businesses.ts), so this module degrades gracefully.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Reads are possible (URL + anon key present). */
export const supabaseConfigured = Boolean(URL && ANON);
/** Writes are possible (URL + service role key present). */
export const supabaseWritable = Boolean(URL && SERVICE);

type Tier = "anon" | "service";

interface SelectOptions {
  /** PostgREST query string, e.g. `select=data&status=eq.published`. */
  query: string;
  /** Next.js cache tags for on-demand revalidation (reads only). */
  tags?: string[];
  /** Override the default credential tier (defaults to anon). */
  tier?: Tier;
}

function baseUrl(): string {
  if (!URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return `${URL}/rest/v1`;
}

function authHeaders(tier: Tier): HeadersInit {
  const key = tier === "service" ? SERVICE : ANON;
  if (!key) {
    throw new Error(
      tier === "service"
        ? "SUPABASE_SERVICE_ROLE_KEY is required for this write."
        : "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set."
    );
  }
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** GET rows. Tagged so writes can revalidate exactly the affected pages. */
export async function sbSelect<T>({
  query,
  tags,
  tier = "anon",
}: SelectOptions): Promise<T[]> {
  const res = await fetch(`${baseUrl()}/${query}`, {
    headers: authHeaders(tier),
    next: tags ? { tags } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Supabase select failed (${res.status}): ${await safeText(res)}`);
  }
  return (await res.json()) as T[];
}

/** INSERT a row (service role). Returns the created representation. */
export async function sbInsert<T>(table: string, row: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}/${table}`, {
    method: "POST",
    headers: {
      ...authHeaders("service"),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Supabase insert failed (${res.status}): ${await safeText(res)}`);
  }
  const [created] = (await res.json()) as T[];
  return created;
}

/** PATCH rows matching `query` (service role). */
export async function sbUpdate<T>(
  table: string,
  query: string,
  patch: unknown
): Promise<T[]> {
  const res = await fetch(`${baseUrl()}/${table}?${query}`, {
    method: "PATCH",
    headers: {
      ...authHeaders("service"),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Supabase update failed (${res.status}): ${await safeText(res)}`);
  }
  return (await res.json()) as T[];
}

/** DELETE rows matching `query` (service role). */
export async function sbDelete(table: string, query: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/${table}?${query}`, {
    method: "DELETE",
    headers: authHeaders("service"),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Supabase delete failed (${res.status}): ${await safeText(res)}`);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
