/**
 * Free website discovery (no API key). For a named local business that has no
 * website on file (OSM rarely has one), search the web and return the most likely
 * official site — which the contact scraper can then mine for email/phone.
 *
 * Uses DuckDuckGo's HTML endpoint (no key). Best-effort + bounded + never throws:
 * search HTML changes and rate-limits, so a miss just means "no site found", never
 * an error. Filters out directories/socials so we return the business's own domain,
 * not a Yell/Facebook listing.
 */

const UA = "Mozilla/5.0 (compatible; AgencyOS-Discovery/1.0; local-business research)";
const TIMEOUT_MS = 5_000;

/** Hosts that are never the business's own website (directories, socials, maps). */
const EXCLUDE =
  /(facebook|instagram|twitter|x\.com|linkedin|tiktok|youtube|youtu\.be|pinterest|yell\.|yelp\.|checkatrade|trustpilot|tripadvisor|trustatrader|google\.|bing\.|duckduckgo|wikipedia|amazon\.|ebay\.|thomsonlocal|cylex|freeindex|192\.com|scoot|brownbook|gov\.uk|nhs\.uk|companieshouse|find-and-update|justeat|deliveroo|ubereats|booking\.com|gumtree|indeed|glassdoor)/i;

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A loose token of the business name, for preferring an on-brand domain. */
function nameToken(name: string): string {
  return name.toLowerCase().replace(/\b(ltd|limited|the|and|&)\b/g, "").replace(/[^a-z0-9]/g, "");
}

/**
 * Find the most likely official website for a business. Returns an origin
 * (https://host) or null. Bounded to a single search request.
 */
export async function findWebsite(name: string, city?: string): Promise<string | null> {
  if (!name.trim()) return null;
  const q = encodeURIComponent(`${name} ${city ?? ""}`.trim());
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${q}`);
  if (!html) return null;

  // DDG wraps result links as /l/?uddg=<encoded-target>.
  const urls: string[] = [];
  for (const m of html.matchAll(/uddg=([^&"']+)/g)) {
    try {
      const decoded = decodeURIComponent(m[1]);
      if (/^https?:\/\//i.test(decoded)) urls.push(decoded);
    } catch {
      /* skip malformed */
    }
  }
  if (urls.length === 0) return null;

  const token = nameToken(name);
  const candidates: string[] = [];
  for (const url of urls) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (EXCLUDE.test(host)) continue;
      candidates.push(`${u.protocol}//${u.host}`);
    } catch {
      /* skip */
    }
  }
  if (candidates.length === 0) return null;

  // Prefer a domain that echoes the business name; else take the top result.
  const onBrand = token.length >= 4 ? candidates.find((c) => c.toLowerCase().replace(/[^a-z0-9]/g, "").includes(token.slice(0, 8))) : undefined;
  return onBrand ?? candidates[0];
}
