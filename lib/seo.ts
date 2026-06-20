import type { Metadata } from "next";
import type { Business, BlogPost } from "./types";
import { fullAddress, geoFor, heroImageFor, hasRating, hasPhone, hasEmail, hasAddress, hasReviews } from "./utils";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

export type PageKind = "home" | "services" | "about" | "contact" | "book";

/**
 * Title tags follow the brief's format: "Service in Warrington | Business Name".
 */
export function buildTitle(business: Business, page: PageKind): string {
  const city = business.address.city;
  const base = `${business.primaryService} in ${city} | ${business.name}`;
  switch (page) {
    case "services":
      return `${business.primaryService} Services in ${city} | ${business.name}`;
    case "about":
      return `About ${business.name} | ${business.primaryService} in ${city}`;
    case "contact":
      return `Contact ${business.name} | ${business.primaryService} in ${city}`;
    case "book":
      return `Book a ${business.primaryService} in ${city} | ${business.name}`;
    default:
      return base;
  }
}

/** Click-through-optimised meta descriptions, unique per page + business. */
export function buildDescription(business: Business, page: PageKind): string {
  const city = business.address.city;
  // Only claim a rating / phone in meta copy when they are real (never fabricate).
  const rating = hasRating(business)
    ? ` Rated ${business.rating!.value}/5 by ${business.rating!.count}+ customers.`
    : "";
  const callCta = hasPhone(business) ? ` Call ${business.phone}.` : "";
  switch (page) {
    case "services":
      return `Explore ${business.name}'s ${business.primaryService.toLowerCase()} services in ${city}. ${business.services
        .slice(0, 3)
        .map((s) => s.name)
        .join(", ")} and more.${rating}${callCta}`;
    case "about":
      return `Meet ${business.name}, your trusted ${business.categoryLabel.toLowerCase()} in ${city}${
        business.established ? `, established ${business.established}` : ""
      }.${rating} ${business.badges.slice(0, 2).join(" · ")}.`;
    case "contact":
      return `Get in touch with ${business.name} in ${city}.${
        hasPhone(business) ? ` Call ${business.phone},` : ""
      } request a free quote online${hasAddress(business) ? ` or find us at ${fullAddress(business)}` : ""}.`;
    case "book":
      return `Book ${business.name} in ${city} online in under a minute.${rating} Fast response and no-obligation quotes.`;
    default:
      return `${business.tagline}${rating} ${business.badges.slice(0, 2).join(" · ")}.${callCta}`;
  }
}

function pagePath(business: Business, page: PageKind): string {
  const root = `/${business.slug}`;
  return page === "home" ? root : `${root}/${page}`;
}

export function buildMetadata(business: Business, page: PageKind): Metadata {
  const title = buildTitle(business, page);
  const description = buildDescription(business, page);
  const url = `${SITE_URL}${pagePath(business, page)}`;
  const image = heroImageFor(business);

  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: [
      `${business.primaryService} ${business.address.city}`,
      `${business.categoryLabel} ${business.address.city}`,
      ...business.serviceAreas.map(
        (area) => `${business.primaryService} ${area}`
      ),
      business.name,
    ],
    openGraph: {
      type: "website",
      url,
      title,
      description,
      siteName: business.name,
      locale: "en_GB",
      images: [{ url: image, width: 1600, height: 900, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/** LocalBusiness JSON-LD structured data for rich results + local SEO. */
export function localBusinessJsonLd(business: Business) {
  const geo = geoFor(business);
  const url = `${SITE_URL}/${business.slug}`;

  // Build the base, then attach only the facts that are real. Fabricated
  // aggregateRating/review markup risks Google structured-data penalties and is
  // dishonest — so we emit them ONLY when the business has genuine reviews.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#business`,
    name: business.name,
    description: business.tagline,
    url,
    image: heroImageFor(business),
    priceRange: "££",
    geo: {
      "@type": "GeoCoordinates",
      latitude: geo.lat,
      longitude: geo.lng,
    },
    areaServed: business.serviceAreas.map((name) => ({
      "@type": "Place",
      name,
    })),
  };

  if (hasPhone(business)) jsonLd.telephone = business.phone;
  if (hasEmail(business)) jsonLd.email = business.email;
  if (hasAddress(business)) {
    jsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: [business.address.line1, business.address.line2].filter(Boolean).join(", "),
      addressLocality: business.address.city,
      postalCode: business.address.postcode,
      addressCountry: "GB",
    };
  }
  if (hasRating(business)) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: business.rating!.value,
      reviewCount: business.rating!.count,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (hasReviews(business)) {
    jsonLd.review = business.testimonials.map((t) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: t.rating, bestRating: 5 },
      author: { "@type": "Person", name: t.author },
      reviewBody: t.quote,
    }));
  }

  return {
    ...jsonLd,
    openingHoursSpecification: business.openingHours
      .filter((o) => !/closed/i.test(o.hours) && /\d/.test(o.hours))
      .map((o) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: o.day,
        // "08:00 – 18:00" -> opens/closes
        opens: o.hours.split("–")[0]?.trim(),
        closes: o.hours.split("–")[1]?.trim(),
      })),
    makesOffer: business.services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.name, description: s.description },
    })),
  };
}

/** Build SEO metadata for a blog article. */
export function buildBlogMetadata(business: Business, post: BlogPost): Metadata {
  const title = `${post.title} | ${business.name}`;
  const description =
    post.metaDescription ??
    `${post.title} — local advice from ${business.name}, your ${business.categoryLabel.toLowerCase()} in ${business.address.city}.`;
  const url = `${SITE_URL}/${business.slug}/blog/${post.slug}`;
  const image = heroImageFor(business);

  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: post.targetKeyword
      ? [post.targetKeyword, `${business.primaryService} ${business.address.city}`, business.name]
      : undefined,
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: business.name,
      locale: "en_GB",
      images: [{ url: image, width: 1600, height: 900, alt: post.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Article JSON-LD structured data for a blog post (rich results + topical authority). */
export function articleJsonLd(business: Business, post: BlogPost) {
  const url = `${SITE_URL}/${business.slug}/blog/${post.slug}`;
  const published = post.publishedAt ?? new Date().toISOString();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.metaDescription ?? post.title,
    image: heroImageFor(business),
    datePublished: published,
    dateModified: published,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: business.name, url: `${SITE_URL}/${business.slug}` },
    publisher: {
      "@type": "Organization",
      name: business.name,
      url: `${SITE_URL}/${business.slug}`,
    },
    about: post.targetKeyword,
    articleSection: `${business.primaryService} in ${business.address.city}`,
  };
}

/** BreadcrumbList JSON-LD for inner pages. */
export function breadcrumbJsonLd(business: Business, page: PageKind) {
  const items: { name: string; path: string }[] = [
    { name: "Home", path: `/${business.slug}` },
  ];
  if (page !== "home") {
    const label =
      page === "book" ? "Book Online" : page[0].toUpperCase() + page.slice(1);
    items.push({ name: label, path: `/${business.slug}/${page}` });
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
