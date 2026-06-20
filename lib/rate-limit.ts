/**
 * Zero-dependency, in-memory rate limiter (fixed-window counter).
 *
 * Protects public, unauthenticated endpoints (the enquiry form, the manual cron
 * trigger) from abuse without adding Redis/Upstash or any npm package. State is
 * held in a module-level Map, so it is per-instance and best-effort: on a
 * single long-lived server it is exact; across serverless instances each cold
 * instance has its own window. That is still a meaningful brake on floods from a
 * single source, and the design swaps cleanly for a shared store later (replace
 * the Map with an Upstash REST call behind the same `rateLimit` signature).
 *
 * Not a security boundary on its own — secrets (CRON_SECRET) and validation
 * still gate the endpoints; this just caps volume.
 */

interface Window {
  count: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

const BUCKETS = new Map<string, Window>();

// Opportunistic cleanup so the Map can't grow unbounded from one-off IPs.
const MAX_ENTRIES = 10_000;

export interface RateLimitOptions {
  /** Max requests permitted within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Requests remaining in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
  /** Seconds until reset — for the `Retry-After` header when blocked. */
  retryAfter: number;
}

/**
 * Record a hit for `key` and report whether it is within the limit.
 * Call once per request; the first call that exceeds `limit` returns ok:false.
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  let entry = BUCKETS.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + opts.windowMs };
    if (BUCKETS.size >= MAX_ENTRIES) sweep(now);
    BUCKETS.set(key, entry);
  }

  entry.count += 1;
  const ok = entry.count <= opts.limit;
  const remaining = Math.max(0, opts.limit - entry.count);
  return {
    ok,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

/** Drop expired windows. Cheap and only runs when the Map gets large. */
function sweep(now: number): void {
  for (const [key, entry] of BUCKETS) {
    if (entry.resetAt <= now) BUCKETS.delete(key);
  }
}

/**
 * Best-effort client IP from the standard proxy headers (Vercel / most hosts
 * set `x-forwarded-for`). Falls back to a constant so a missing header degrades
 * to a shared bucket rather than disabling the limit entirely.
 */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Standard headers describing the limit state, for transparency to clients. */
export function rateLimitHeaders(
  result: RateLimitResult,
  limit: number
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.ok) headers["Retry-After"] = String(result.retryAfter);
  return headers;
}
