import type { MetadataRoute } from "next";
import { getAllBusinesses } from "@/lib/businesses";
import { getAllPublishedPostRefs } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";
import { SERVICE_PAGES } from "@/lib/seo-content";
import { SEO_TRADES } from "@/lib/kit/seo-trades";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [businesses, postRefs] = await Promise.all([
    getAllBusinesses(),
    getAllPublishedPostRefs(),
  ]);
  const now = new Date();

  // The agency's own marketing site (what Stripe + new customers find).
  const root: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/map-pack-kit`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/free-tools/google-business-description`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/websites`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...SERVICE_PAGES.map((s) => ({
      url: `${SITE_URL}/websites/${s.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...SEO_TRADES.map((t) => ({
      url: `${SITE_URL}/map-pack-kit/${t.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  const hasPosts = new Set(postRefs.map((r) => r.businessSlug));

  const businessUrls = businesses.flatMap((b) => {
    const base = `${SITE_URL}/${b.slug}`;
    const pages = ["", "/services", "/about", "/contact"];
    if (b.enableBooking) pages.push("/book");
    if (hasPosts.has(b.slug)) pages.push("/blog");
    return pages.map((p) => ({
      url: `${base}${p}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: p === "" ? 0.9 : 0.7,
    }));
  });

  // Individual blog articles — the SEO engine's long-tail landing pages.
  const blogUrls = postRefs.map((r) => ({
    url: `${SITE_URL}/${r.businessSlug}/blog/${r.postSlug}`,
    lastModified: r.publishedAt ? new Date(r.publishedAt) : now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...root, ...businessUrls, ...blogUrls];
}
