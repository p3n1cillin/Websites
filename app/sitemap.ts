import type { MetadataRoute } from "next";
import { getAllBusinesses } from "@/lib/businesses";
import { getAllPublishedPostRefs } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [businesses, postRefs] = await Promise.all([
    getAllBusinesses(),
    getAllPublishedPostRefs(),
  ]);
  const now = new Date();

  const root: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
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
