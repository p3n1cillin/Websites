/**
 * Custom-domain resolution for the multi-tenant edge middleware.
 *
 * A tenant points their own domain (e.g. `eliteplumbing.co.uk`) at the platform.
 * The middleware then rewrites incoming requests on that host to the tenant's
 * `/[business]` path, so the visitor sees a bare domain while Next.js still
 * renders the existing per-tenant route. The slug is the join key.
 *
 * This runs in the edge runtime, so it uses plain `fetch` against PostgREST with
 * the anon key (RLS exposes only `published` rows — exactly what a live custom
 * domain should resolve to). A small in-memory TTL cache keeps the hot path off
 * the database; it is per-isolate and best-effort, which is fine for a lookup
 * that changes rarely.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * The DNS target tenants point a custom domain at. On Vercel a root domain uses
 * an A record (76.76.21.21) and a subdomain a CNAME to cname.vercel-dns.com.
 * Surfaced in the admin setup instructions.
 */
export const CUSTOM_DOMAIN_CNAME = "cname.vercel-dns.com";
export const CUSTOM_DOMAIN_A_RECORD = "76.76.21.21";

/** Lowercase the host and strip any `:port` and trailing dot. */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.toLowerCase().trim().replace(/\.$/, "").split(":")[0]!;
}

/**
 * Is this host the platform itself (not a tenant's custom domain)? Platform
 * traffic skips the domain lookup entirely, so this check must be cheap and
 * never hit the network.
 */
export function isPlatformHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h) return true;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
  // Vercel preview/prod deployment URLs.
  if (h.endsWith(".vercel.app")) return true;

  // The configured public site host (apex + www).
  const siteHost = normalizeHost(extractHost(process.env.NEXT_PUBLIC_SITE_URL));
  if (siteHost && (h === siteHost || h === `www.${siteHost}` || `www.${h}` === siteHost)) {
    return true;
  }
  return false;
}

function extractHost(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    // Allow a bare host to be configured too.
    return url;
  }
}

interface CacheEntry {
  slug: string | null;
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 60_000; // 1 minute — domain→slug mappings change rarely.
const NEGATIVE_TTL_MS = 30_000; // cache misses too, to absorb junk traffic.

/**
 * Resolve a custom domain to a published business slug, or null if none matches.
 * Returns null (and does not throw) when Supabase isn't configured.
 */
export async function getSlugByDomain(host: string): Promise<string | null> {
  const domain = normalizeHost(host);
  if (!domain || !SUPABASE_URL || !SUPABASE_ANON) return null;

  const cached = CACHE.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.slug;

  let slug: string | null = null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/businesses?select=slug&status=eq.published&custom_domain=eq.${encodeURIComponent(
        domain
      )}&limit=1`,
      {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
        // Edge fetch: keep it snappy and uncached at the fetch layer; we cache
        // the resolved result in-process instead.
        cache: "no-store",
      }
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ slug: string }>;
      slug = rows[0]?.slug ?? null;
    }
  } catch {
    // Network hiccup — treat as unmapped for this request, don't cache long.
    return null;
  }

  CACHE.set(domain, {
    slug,
    expiresAt: Date.now() + (slug ? TTL_MS : NEGATIVE_TTL_MS),
  });
  return slug;
}

/**
 * Validate + normalize a domain a tenant entered in the admin UI. Returns the
 * cleaned host, or an error string. Rejects URLs with schemes/paths, the
 * platform's own host, and anything that isn't a plausible registrable domain.
 */
export function validateCustomDomain(input: string): { domain?: string; error?: string } {
  let raw = input.trim().toLowerCase();
  if (!raw) return { error: "Enter a domain." };
  // Be forgiving about pasted URLs.
  raw = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const domain = normalizeHost(raw);

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return { error: "Enter a valid domain, e.g. example.com or www.example.com." };
  }
  if (isPlatformHost(domain)) {
    return { error: "That domain is reserved by the platform." };
  }
  return { domain };
}
