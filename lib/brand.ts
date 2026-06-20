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
    "AI-built websites that win local businesses more customers.",
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
