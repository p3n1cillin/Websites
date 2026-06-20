import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private/tokenised surfaces — keep them out of the index.
      disallow: ["/api/", "/admin", "/preview/", "/portal/", "/proposal/", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
