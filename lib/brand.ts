import { SITE_URL } from "./seo";

/**
 * Public brand config for the agency's OWN marketing site (the homepage Stripe and
 * customers see). Everything is env-driven so the real business details — name,
 * contact email, address — are SET by the operator, never fabricated (data-integrity
 * rule). Render guards (`hasEmail` etc.) hide anything not configured rather than
 * inventing it. Set these in .env.local before submitting the site to Stripe.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "Empire Digital",
  legalName:
    process.env.NEXT_PUBLIC_BRAND_LEGAL_NAME?.trim() ||
    process.env.NEXT_PUBLIC_BRAND_NAME?.trim() ||
    "Empire Digital",
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE?.trim() ||
    "Websites that win local businesses more customers.",
  email: process.env.NEXT_PUBLIC_BRAND_EMAIL?.trim() || "",
  phone: process.env.NEXT_PUBLIC_BRAND_PHONE?.trim() || "",
  location: process.env.NEXT_PUBLIC_BRAND_LOCATION?.trim() || "United Kingdom",
  url: SITE_URL,
};

export const hasBrandEmail = brand.email.length > 0;
export const hasBrandPhone = brand.phone.length > 0;

/** Pricing shown publicly — matches the real proposal economics (build fee + care plan). */
export const PRICING = {
  buildFromPence: 39_900, // one-off, from
  carePlanPence: 3_900, // per month
};

export const gbp = (pence: number) =>
  `£${Math.round(pence / 100).toLocaleString("en-GB")}`;

/**
 * Organization + WebSite JSON-LD for the agency's own site — what search engines use
 * to recognise the business (knowledge panel, rich results). Only emits facts that
 * are configured (email), never invents them.
 */
export function organizationJsonLd() {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${brand.url}#org`,
    name: brand.legalName,
    url: brand.url,
    description: brand.tagline,
    areaServed: brand.location,
    knowsAbout: ["Web design", "Local SEO", "Conversion optimisation", "Lead generation"],
    makesOffer: [
      { "@type": "Offer", name: "Website build", priceCurrency: "GBP", price: (PRICING.buildFromPence / 100).toFixed(0) },
      { "@type": "Offer", name: "Website care plan", priceCurrency: "GBP", price: (PRICING.carePlanPence / 100).toFixed(0) },
    ],
  };
  if (hasBrandEmail) ld.email = brand.email;
  if (hasBrandPhone) ld.telephone = brand.phone;
  return ld;
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${brand.url}#website`,
    url: brand.url,
    name: brand.name,
    description: brand.tagline,
    publisher: { "@id": `${brand.url}#org` },
  };
}
