/**
 * Map Pack Kit — order storage on Supabase Storage (private bucket), over fetch.
 *
 * Why Storage, not a table: it needs NO SQL migration (the bucket is created on
 * first use with the service-role key), so the product works the moment it's
 * deployed. Each paid Stripe session gets a folder: `orders/<sessionId>/<section>.json`.
 *
 * Without Supabase (local dev) it falls back to an in-memory Map so the flow is
 * still testable end-to-end. Server-only: uses SUPABASE_SERVICE_ROLE_KEY.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.KIT_STORAGE_BUCKET || "kits";

export const kitStorageDurable = Boolean(URL && SERVICE);

const memory = new Map<string, unknown>();
let bucketReady: Promise<void> | null = null;

function headers(extra: Record<string, string> = {}): HeadersInit {
  return { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}`, ...extra };
}

async function ensureBucket(): Promise<void> {
  if (!kitStorageDurable) return;
  if (!bucketReady) {
    bucketReady = (async () => {
      const res = await fetch(`${URL}/storage/v1/bucket`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
        cache: "no-store",
      });
      // 200 = created; 400/409 = already exists. Anything else: surface on next write.
      if (!res.ok && res.status !== 400 && res.status !== 409) {
        bucketReady = null;
        throw new Error(`Kit storage bucket setup failed (${res.status}): ${await res.text()}`);
      }
    })();
  }
  return bucketReady;
}

const safePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export async function putKitJson(path: string, value: unknown): Promise<void> {
  if (!kitStorageDurable) {
    memory.set(path, JSON.parse(JSON.stringify(value)));
    return;
  }
  await ensureBucket();
  const res = await fetch(`${URL}/storage/v1/object/${BUCKET}/${safePath(path)}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "x-upsert": "true", "cache-control": "no-cache" }),
    body: JSON.stringify(value),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kit storage write failed (${res.status}): ${await res.text()}`);
}

/** Read a JSON object, or null when missing / unreadable. Never throws. */
export async function getKitJson<T>(path: string): Promise<T | null> {
  if (!kitStorageDurable) return (memory.get(path) as T | undefined) ?? null;
  try {
    const res = await fetch(`${URL}/storage/v1/object/authenticated/${BUCKET}/${safePath(path)}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** List object names under a folder prefix (e.g. `orders/<id>`). Never throws. */
export async function listKitObjects(prefix: string): Promise<string[]> {
  if (!kitStorageDurable) {
    return [...memory.keys()].filter((k) => k.startsWith(`${prefix}/`)).map((k) => k.slice(prefix.length + 1));
  }
  try {
    await ensureBucket();
    const res = await fetch(`${URL}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix, limit: 200, offset: 0 }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as { name: string }[];
    return rows.map((r) => r.name);
  } catch {
    return [];
  }
}
