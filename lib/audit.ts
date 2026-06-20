import type { WebsiteAudit } from "./types";

/**
 * Website Audit / Opportunity Analysis engine (Agent 2's eyes).
 *
 * Fetches a prospect's EXISTING homepage server-side and scores its real quality
 * from concrete signals — mobile-readiness, SEO basics, trust/CTA presence,
 * accessibility, page weight, and DIY-builder detection. It is a single-page,
 * dependency-free heuristic audit (no headless browser / Lighthouse), which keeps
 * it fast and respectful: one GET of the homepage with a clear UA, a hard timeout,
 * and a capped body. It produces a 0–100 quality score and a plain-language list of
 * weaknesses that becomes the opportunity score + the "show, don't tell" pitch.
 *
 * Honest scope: homepage-only, static-HTML heuristics. It can't measure real load
 * speed or render JS-built pages; those (and robots.txt-aware crawling) are later
 * enhancements. It never throws — a dead or blocked site returns an unreachable
 * audit, which is itself a strong opportunity signal.
 */

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 800_000; // cap the body we parse
const UA = "Mozilla/5.0 (compatible; AgencyOS-SiteAudit/1.0; website opportunity analysis)";

/** Normalise a user-entered URL to an absolute http(s) URL. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Social platforms we recognise + label, for profile enrichment. */
const SOCIAL_DOMAINS: { host: RegExp; label: string }[] = [
  { host: /facebook\.com/i, label: "Facebook" },
  { host: /instagram\.com/i, label: "Instagram" },
  { host: /(?:twitter|x)\.com/i, label: "X/Twitter" },
  { host: /linkedin\.com/i, label: "LinkedIn" },
  { host: /tiktok\.com/i, label: "TikTok" },
  { host: /youtube\.com|youtu\.be/i, label: "YouTube" },
];

/** Review platforms we recognise from outbound links. */
const REVIEW_PLATFORMS: { host: RegExp; label: string }[] = [
  { host: /google\.[a-z.]+\/(?:maps|search)|g\.page|business\.google/i, label: "Google" },
  { host: /trustpilot\.com/i, label: "Trustpilot" },
  { host: /checkatrade\.com/i, label: "Checkatrade" },
  { host: /yell\.com/i, label: "Yell" },
  { host: /yelp\.[a-z.]+/i, label: "Yelp" },
  { host: /tripadvisor\.[a-z.]+/i, label: "Tripadvisor" },
  { host: /trustatrader\.com/i, label: "TrustATrader" },
  { host: /facebook\.com\/[^"']*\/reviews/i, label: "Facebook reviews" },
];

/**
 * Reputation Intelligence: mine review signals from the homepage HTML. Conservative
 * by design (we'd rather miss a signal than fabricate one): review-platform links,
 * an on-page advertised rating/count, and a rough testimonial-block tally.
 */
function extractReputation(html: string): NonNullable<WebsiteAudit["reputation"]> {
  const hrefs = (html.match(/href=["']([^"']+)["']/gi) ?? []).map((h) =>
    h.replace(/^href=["']/i, "").replace(/["']$/, "")
  );
  const platforms = new Set<string>();
  for (const url of hrefs) {
    const hit = REVIEW_PLATFORMS.find((p) => p.host.test(url));
    if (hit) platforms.add(hit.label);
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  // "4.8/5", "4.8 out of 5", "rated 5 stars"
  const valueMatch =
    text.match(/\b([0-5](?:\.\d)?)\s*(?:\/|out of)\s*5\b/i) ||
    text.match(/\b([0-5](?:\.\d)?)\s*stars?\b/i) ||
    text.match(/\brated\s+([0-5](?:\.\d)?)\b/i);
  // "127 reviews", "over 200 ratings"
  const countMatch = text.match(/\b(\d{1,5})\+?\s*(?:reviews|ratings|google reviews)\b/i);
  const value = valueMatch ? Number(valueMatch[1]) : undefined;
  const count = countMatch ? Number(countMatch[1]) : undefined;
  const onPageRating =
    value !== undefined || count !== undefined ? { value, count } : null;

  const testimonialCount =
    (html.match(/<blockquote\b/gi)?.length ?? 0) +
    (html.match(/\b(?:testimonial|review-card|review__|customer-review)\b/gi)?.length ?? 0);

  return { platforms: [...platforms], onPageRating, testimonialCount };
}

/** Junk patterns that look like emails but aren't a real business inbox. */
const EMAIL_JUNK = /(example\.|sentry\.|wix|\.png|\.jpg|\.jpeg|\.gif|\.webp|@2x|@3x|your-?email|name@|email@example)/i;

/**
 * Extract a plausible contact email from the homepage — `mailto:` links first
 * (most reliable), then visible text. Conservative: filters junk/asset strings and
 * prefers an address on the site's own domain. Returns null when nothing credible
 * is found (we never invent one). This is what makes auto-outreach possible.
 */
export function extractEmail(html: string, siteHost?: string): string | null {
  const candidates: string[] = [];
  for (const m of html.matchAll(/href=["']mailto:([^"'?]+)/gi)) {
    if (m[1]) candidates.push(m[1].trim());
  }
  const text = html.replace(/<[^>]+>/g, " ");
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    candidates.push(m[0]);
  }
  const seen = new Set<string>();
  const clean = candidates
    .map((e) => e.toLowerCase().replace(/^mailto:/, "").trim())
    .filter((e) => e.includes("@") && !EMAIL_JUNK.test(e))
    .filter((e) => (seen.has(e) ? false : (seen.add(e), true)));
  if (clean.length === 0) return null;
  // Prefer an address on the business's own domain (e.g. info@theirsite.co.uk).
  const domain = siteHost?.replace(/^www\./, "");
  const onDomain = domain ? clean.find((e) => e.endsWith(`@${domain}`)) : undefined;
  return onDomain ?? clean[0];
}

/** Pull recognised social-profile labels linked from the homepage HTML. */
function extractSocials(html: string): string[] {
  const hrefs = html.match(/href=["']([^"']+)["']/gi) ?? [];
  const found = new Set<string>();
  for (const raw of hrefs) {
    const url = raw.replace(/^href=["']/i, "").replace(/["']$/, "");
    // Skip share/intent links — we only want the business's own profile links.
    if (/sharer|share\?|\/intent\//i.test(url)) continue;
    const hit = SOCIAL_DOMAINS.find((s) => s.host.test(url));
    if (hit) found.add(hit.label);
  }
  return [...found];
}

const BUILDERS: { id: string; re: RegExp }[] = [
  { id: "Wix", re: /wix\.com|_wixCss*|wix-warmup/i },
  { id: "Weebly", re: /weebly\.com|editmysite\.com/i },
  { id: "Squarespace", re: /squarespace\.com|static1\.squarespace/i },
  { id: "GoDaddy Website Builder", re: /godaddy|websitebuilder|secureserver\.net/i },
  { id: "Wordpress", re: /wp-content|wp-includes/i },
];

/**
 * Score parsed homepage signals into a 0–100 quality + a weakness list. Pure, so
 * it's deterministic and unit-testable independently of the network fetch.
 */
function scoreHtml(url: string, html: string, finalUrl: string, status: number): WebsiteAudit {
  const lower = html.toLowerCase();
  const issues: string[] = [];
  let score = 100;
  const penalise = (cond: boolean, points: number, issue: string) => {
    if (cond) {
      score -= points;
      issues.push(issue);
    }
  };

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  const hasTitle = title.length > 0;
  const hasMetaDescription = /<meta[^>]+name=["']description["'][^>]*>/i.test(html);
  const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
  const hasH1 = /<h1[\s>]/i.test(html);
  const hasStructuredData = /application\/ld\+json/i.test(html);
  const hasOpenGraph = /<meta[^>]+property=["']og:/i.test(html);
  const hasFavicon = /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html);
  const hasPhoneLink = /href=["']tel:/i.test(html);
  const hasCtaSignal =
    /\b(book now|get a quote|free quote|contact us|call now|enquire|buy now|shop now|order online|get in touch|request a)\b/i.test(
      html
    );
  const https = finalUrl.startsWith("https://");

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imageCount = imgTags.length;
  const imagesWithoutAlt = imgTags.filter((t) => !/\balt\s*=/i.test(t)).length;

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = text ? text.split(" ").length : 0;
  const htmlBytes = Buffer.byteLength(html);
  const builder = BUILDERS.find((b) => b.re.test(lower))?.id ?? null;
  const socials = extractSocials(html);
  const reputation = extractReputation(html);
  let host: string | undefined;
  try { host = new URL(finalUrl).host; } catch { /* ignore */ }
  const contactEmail = extractEmail(html, host);

  penalise(!hasViewport, 20, "Not mobile-friendly (no viewport tag) — loses mobile customers.");
  penalise(!https, 14, "No HTTPS — browsers flag the site as 'Not secure'.");
  penalise(!hasMetaDescription, 12, "No meta description — weak Google search snippet.");
  penalise(!hasCtaSignal, 11, "No clear call-to-action (book/quote/contact).");
  penalise(!hasPhoneLink, 9, "Phone number isn't click-to-call on mobile.");
  penalise(!hasTitle, 10, "Missing page title tag.");
  penalise(hasTitle && (title.length < 15 || title.length > 65), 3, "Page title is poorly sized for SEO.");
  penalise(!hasH1, 8, "No H1 heading — unclear page focus for SEO.");
  penalise(!hasStructuredData, 6, "No structured data (no rich results / local SEO schema).");
  penalise(!hasOpenGraph, 4, "No social-share preview (Open Graph) tags.");
  penalise(imageCount > 0 && imagesWithoutAlt / imageCount > 0.4, 6, "Many images miss alt text (SEO + accessibility).");
  penalise(wordCount < 150, 10, "Very thin content — too little for Google to rank.");
  penalise(htmlBytes > 1_500_000, 6, "Heavy homepage — likely slow to load.");
  penalise(Boolean(builder) && /wix|weebly|godaddy/i.test(builder ?? ""), 8, `Built on a DIY tool (${builder}) — looks templated.`);
  penalise(!hasFavicon, 2, "No favicon — looks unfinished in browser tabs.");
  // Reputation gap: reviews exist off-site but aren't surfaced, or none at all.
  penalise(
    reputation.platforms.length > 0 && !reputation.onPageRating && reputation.testimonialCount === 0,
    7,
    `Reviews on ${reputation.platforms.join(", ")} aren't shown on the site — hidden trust.`
  );
  penalise(
    reputation.platforms.length === 0 && reputation.testimonialCount === 0 && !reputation.onPageRating,
    6,
    "No customer reviews or testimonials anywhere on the site."
  );

  return {
    url,
    reachable: true,
    statusCode: status,
    https,
    overall: clamp(score),
    signals: {
      hasTitle,
      titleLength: title.length,
      hasMetaDescription,
      hasViewport,
      hasH1,
      hasStructuredData,
      hasOpenGraph,
      hasFavicon,
      hasPhoneLink,
      hasCtaSignal,
      imageCount,
      imagesWithoutAlt,
      wordCount,
      htmlBytes,
      builder,
      socials,
    },
    reputation,
    contactEmail,
    issues,
    at: new Date().toISOString(),
  };
}

/** An "unreachable" audit — itself the strongest opportunity signal. */
function unreachable(url: string, statusCode?: number, reason = "The site didn't load."): WebsiteAudit {
  return {
    url,
    reachable: false,
    statusCode,
    https: url.startsWith("https://"),
    overall: 0,
    signals: {
      hasTitle: false,
      titleLength: 0,
      hasMetaDescription: false,
      hasViewport: false,
      hasH1: false,
      hasStructuredData: false,
      hasOpenGraph: false,
      hasFavicon: false,
      hasPhoneLink: false,
      hasCtaSignal: false,
      imageCount: 0,
      imagesWithoutAlt: 0,
      wordCount: 0,
      htmlBytes: 0,
      builder: null,
    },
    issues: [reason],
    at: new Date().toISOString(),
  };
}

/** Fetch + audit a homepage. Never throws — returns an unreachable audit on error. */
export async function auditWebsite(input: string): Promise<WebsiteAudit | null> {
  const url = normalizeUrl(input);
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
    });
    if (!res.ok) return unreachable(url, res.status, `Site returned ${res.status}.`);

    // Read up to MAX_BYTES so a huge page can't blow memory.
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (bytes >= MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    } else {
      html = await res.text();
    }

    return scoreHtml(url, html, res.url || url, res.status);
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return unreachable(url, undefined, aborted ? "The site timed out (too slow to load)." : "The site couldn't be reached.");
  } finally {
    clearTimeout(timer);
  }
}
