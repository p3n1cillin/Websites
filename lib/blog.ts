import { revalidateTag } from "next/cache";
import type { BlogPost, BlogPostStatus, BusinessRecord } from "./types";
import { CATALOGUE_TAG, blogTag, tenantTag } from "./cache-tags";
import { sbSelect, sbInsert, supabaseConfigured, supabaseWritable } from "./supabase/client";
import { planPostsFor } from "./seo-automation";

/**
 * Blog / SEO-automation data layer.
 *
 * Reads (public):  anon key, RLS-limited to published articles on published
 *                  businesses. Tagged for on-demand revalidation.
 * Writes:          service role (the cron / admin generator). Each write
 *                  revalidates the affected blog, tenant pages and the sitemap.
 *
 * Blog content only exists when Supabase is configured; with the bundled local
 * data the blog is simply empty (the rest of the site is unaffected).
 */

interface BlogPostRow {
  id: string;
  business_id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  body_mdx: string;
  target_keyword: string | null;
  service_ref: string | null;
  status: BlogPostStatus;
  published_at: string | null;
  businesses?: { slug: string } | null;
}

const COLS =
  "id,business_id,slug,title,meta_description,body_mdx,target_keyword,service_ref,status,published_at";

function toPost(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    businessId: row.business_id,
    slug: row.slug,
    title: row.title,
    metaDescription: row.meta_description,
    bodyMdx: row.body_mdx,
    targetKeyword: row.target_keyword,
    serviceRef: row.service_ref,
    status: row.status,
    publishedAt: row.published_at,
    businessSlug: row.businesses?.slug,
  };
}

// ===========================================================================
// READS  (public — anon key, RLS-limited to published)
// ===========================================================================

/** Published articles for one business, newest first. Empty if Supabase is off. */
export async function getPublishedPosts(businessSlug: string): Promise<BlogPost[]> {
  if (!supabaseConfigured) return [];
  try {
    const rows = await sbSelect<BlogPostRow>({
      query:
        `blog_posts?select=${COLS},businesses!inner(slug)` +
        `&businesses.slug=eq.${encodeURIComponent(businessSlug)}` +
        `&status=eq.published&order=published_at.desc`,
      tags: [tenantTag(businessSlug), blogTag(businessSlug)],
    });
    return rows.map(toPost);
  } catch (err) {
    console.warn(`[blog] list failed for "${businessSlug}":`, err);
    return [];
  }
}

/** A single published article by business + post slug. */
export async function getPublishedPost(
  businessSlug: string,
  postSlug: string
): Promise<BlogPost | null> {
  if (!supabaseConfigured) return null;
  try {
    const rows = await sbSelect<BlogPostRow>({
      query:
        `blog_posts?select=${COLS},businesses!inner(slug)` +
        `&businesses.slug=eq.${encodeURIComponent(businessSlug)}` +
        `&slug=eq.${encodeURIComponent(postSlug)}&status=eq.published&limit=1`,
      tags: [tenantTag(businessSlug), blogTag(businessSlug)],
    });
    return rows[0] ? toPost(rows[0]) : null;
  } catch (err) {
    console.warn(`[blog] lookup failed for "${businessSlug}/${postSlug}":`, err);
    return null;
  }
}

/** Every published article as { businessSlug, postSlug } — for sitemap + SSG. */
export async function getAllPublishedPostRefs(): Promise<
  { businessSlug: string; postSlug: string; publishedAt: string | null }[]
> {
  if (!supabaseConfigured) return [];
  try {
    const rows = await sbSelect<BlogPostRow>({
      query:
        `blog_posts?select=slug,published_at,businesses!inner(slug,status)` +
        `&businesses.status=eq.published&status=eq.published`,
      tags: [CATALOGUE_TAG],
    });
    return rows
      .filter((r) => r.businesses?.slug)
      .map((r) => ({
        businessSlug: r.businesses!.slug,
        postSlug: r.slug,
        publishedAt: r.published_at,
      }));
  } catch (err) {
    console.warn("[blog] ref list failed:", err);
    return [];
  }
}

// ===========================================================================
// ADMIN READS  (service role — includes drafts)
// ===========================================================================

/** All articles for a business (any status). Newest first. */
export async function getPostsForBusiness(businessId: string): Promise<BlogPost[]> {
  if (!supabaseWritable) return [];
  const rows = await sbSelect<BlogPostRow>({
    query: `blog_posts?select=${COLS}&business_id=eq.${encodeURIComponent(
      businessId
    )}&order=published_at.desc`,
    tier: "service",
  });
  return rows.map(toPost);
}

/** The set of slugs that already exist for a business (to skip on re-generation). */
async function existingSlugs(businessId: string): Promise<Set<string>> {
  const rows = await sbSelect<{ slug: string }>({
    query: `blog_posts?select=slug&business_id=eq.${encodeURIComponent(businessId)}`,
    tier: "service",
  });
  return new Set(rows.map((r) => r.slug));
}

// ===========================================================================
// WRITES / GENERATION  (service role required)
// ===========================================================================

/** How many new articles the engine publishes per business on each run. */
export const POSTS_PER_RUN = 3;

export interface GenerationResult {
  /** Total new articles created across all businesses. */
  created: number;
  /** Per-business breakdown for reporting. */
  perBusiness: { slug: string; created: number }[];
}

/**
 * Generate up to `POSTS_PER_RUN` new articles for each given (published)
 * business, skipping any whose slug already exists. Idempotent and safe to run
 * nightly — it drips fresh, locally-targeted content rather than dumping it all
 * at once. Revalidates each affected blog, tenant and the sitemap.
 */
export async function runSeoGeneration(
  records: BusinessRecord[],
  limitPerBusiness = POSTS_PER_RUN
): Promise<GenerationResult> {
  if (!supabaseWritable) {
    throw new Error("SEO generation requires SUPABASE_SERVICE_ROLE_KEY.");
  }

  const perBusiness: { slug: string; created: number }[] = [];
  let created = 0;

  for (const record of records) {
    const existing = await existingSlugs(record.id);
    const candidates = planPostsFor(record.data).filter((c) => !existing.has(c.slug));
    const batch = candidates.slice(0, limitPerBusiness);

    for (const post of batch) {
      await sbInsert<BlogPostRow>("blog_posts", {
        business_id: record.id,
        slug: post.slug,
        title: post.title,
        meta_description: post.metaDescription,
        body_mdx: post.bodyMarkdown,
        target_keyword: post.targetKeyword,
        service_ref: post.serviceRef ?? null,
        status: "published",
        published_at: new Date().toISOString(),
      });
    }

    if (batch.length > 0) {
      created += batch.length;
      revalidateTag(blogTag(record.slug));
      revalidateTag(tenantTag(record.slug));
    }
    perBusiness.push({ slug: record.slug, created: batch.length });
  }

  if (created > 0) revalidateTag(CATALOGUE_TAG);
  return { created, perBusiness };
}
