/**
 * SEO automation engine.
 *
 * Turns a `Business` into a steady stream of genuinely useful, locally-targeted
 * articles ("emergency plumber in Latchford", "Boiler Installation in
 * Warrington", …). Each article targets one long-tail keyword built by expanding
 * the business's city into nearby areas and crossing those with its services.
 *
 * The output is plain Markdown (rendered by components/Markdown.tsx) plus the
 * metadata the blog pages and Article schema need. Generation is deterministic
 * and idempotent: the same business always yields the same candidate slugs, so
 * the nightly cron (app/api/cron/seo) can re-run safely and only insert the
 * articles that don't exist yet (see lib/blog.ts `runSeoGeneration`).
 *
 * No external API or LLM call — this is a zero-dependency, offline generator, in
 * keeping with the rest of the codebase.
 */

import type { Business } from "./types";
import { averageRating } from "./utils";

/**
 * Nearby areas keyed by (lowercased) city. Expanding "Warrington" into its
 * suburbs is how a single site ranks for dozens of "<service> <area>" searches.
 * Add a city here to expand the SaaS to a new region — pure data entry.
 */
const NEARBY_AREAS: Record<string, string[]> = {
  warrington: [
    "Latchford",
    "Stockton Heath",
    "Grappenhall",
    "Lymm",
    "Great Sankey",
    "Birchwood",
    "Padgate",
    "Woolston",
    "Culcheth",
    "Penketh",
    "Appleton",
    "Westbrook",
    "Burtonwood",
    "Orford",
  ],
};

/** Areas to target for a business: its own service areas first, then the city's known suburbs. */
export function nearbyAreasFor(business: Business): string[] {
  const city = business.address.city;
  const known = NEARBY_AREAS[city.toLowerCase()] ?? [];
  const merged = [...business.serviceAreas, ...known];
  const seen = new Set<string>([city.toLowerCase()]);
  const out: string[] = [];
  for (const area of merged) {
    const key = area.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(area.trim());
  }
  return out;
}

export interface GeneratedPost {
  slug: string;
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
  targetKeyword: string;
  serviceRef?: string | null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Internal-link helpers — every article links back into the site (good for SEO + UX). */
function links(business: Business) {
  const base = `/${business.slug}`;
  return {
    home: `[${business.name}](${base})`,
    services: `[our ${business.primaryService.toLowerCase()} services](${base}/services)`,
    contact: `[request a free quote](${base}/contact)`,
    book: business.enableBooking ? `[book online](${base}/book)` : null,
  };
}

/** An article targeting "<primary service> in <area>". */
function areaPost(business: Business, area: string): GeneratedPost {
  const { primaryService, categoryLabel, address, phone, name, badges, serviceAreas } = business;
  const city = address.city;
  const l = links(business);
  const rating = averageRating(business);
  const otherAreas = serviceAreas.filter((a) => a.toLowerCase() !== area.toLowerCase()).slice(0, 4);

  const body = [
    `Looking for a reliable **${categoryLabel.toLowerCase()} in ${area}**? ${name} provides professional ${primaryService.toLowerCase()} services right across ${area} and the wider ${city} area. As a trusted local team, we know the area, we turn up when we say we will, and we get the job done properly the first time.`,
    ``,
    `## Why ${area} chooses ${name}`,
    ``,
    rating
      ? `We've built our reputation on doing great work for our neighbours. Customers across ${area} rate us **${rating}/5**, and here's what sets us apart:`
      : `We've built our reputation on doing great work for our neighbours. Here's what sets us apart:`,
    ``,
    ...badges.slice(0, 5).map((b) => `- ${b}`),
    ``,
    `Whether it's a quick fix or a larger project, you'll get the same honest advice and upfront pricing every time.`,
    ``,
    `## Our ${primaryService.toLowerCase()} services in ${area}`,
    ``,
    `Here's how we help homes and businesses in ${area}:`,
    ``,
    ...business.services.slice(0, 6).map((s) => `- **${s.name}** — ${s.description}`),
    ``,
    `See the full range on ${l.services}.`,
    ``,
    `## Local ${primaryService.toLowerCase()} you can count on`,
    ``,
    `Being based near ${area} means we're rarely far away — handy when you need help quickly. We also regularly cover ${
      otherAreas.length ? otherAreas.join(", ") + " and the surrounding villages" : `${city} and the surrounding villages`
    }, so wherever you are, there's a good chance we already work on your street.`,
    ``,
    `## Get a free quote in ${area}`,
    ``,
    `Ready to get started? Call us on **${phone}** or ${l.contact} and we'll get back to you fast — no obligation, no pushy sales. You can read more ${l.home} or ${
      l.book ?? l.contact
    } today.`,
  ].join("\n");

  return {
    slug: slugify(`${primaryService}-in-${area}`),
    title: `${primaryService} in ${area}`,
    metaDescription: `Need a ${categoryLabel.toLowerCase()} in ${area}? ${name} offers trusted ${primaryService.toLowerCase()} services across ${area} & ${city}.${rating ? ` Rated ${rating}/5.` : ""} Call ${phone} for a free quote.`,
    bodyMarkdown: body,
    targetKeyword: `${primaryService} ${area}`.toLowerCase(),
  };
}

/** An article targeting a specific "<service> in <city>". */
function servicePost(business: Business, service: Business["services"][number]): GeneratedPost {
  const { primaryService, categoryLabel, address, phone, name } = business;
  const city = address.city;
  const l = links(business);
  const rating = averageRating(business);

  const body = [
    `Need **${service.name.toLowerCase()} in ${city}**? ${name} is a trusted local ${categoryLabel.toLowerCase()} offering reliable ${service.name.toLowerCase()} for homes and businesses across ${city}.`,
    ``,
    `## What's involved in ${service.name.toLowerCase()}`,
    ``,
    `${service.description} ${service.price ? `Pricing typically starts from **${service.price}**, and we'll always confirm the cost with you before any work begins.` : `We'll always give you a clear, upfront price before any work begins.`}`,
    ``,
    `## Why book ${name} for ${service.name.toLowerCase()}`,
    ``,
    ...(rating ? [`- Rated **${rating}/5** by ${city} customers`] : []),
    `- Local, fully-vetted ${categoryLabel.toLowerCase()}s`,
    `- Honest, upfront pricing with no surprises`,
    `- Fast response across ${city} and nearby areas`,
    ``,
    `It's just one of ${l.services} we provide — take a look to see how else we can help.`,
    ``,
    `## Book your ${service.name.toLowerCase()} in ${city}`,
    ``,
    `Call **${phone}** or ${l.contact} for a free, no-obligation quote. Prefer to plan ahead? ${
      l.book ? `You can also ${l.book}.` : `Drop us a message and we'll arrange a convenient time.`
    } Learn more about ${l.home}.`,
  ].join("\n");

  return {
    slug: slugify(`${service.name}-in-${city}`),
    title: `${service.name} in ${city}`,
    metaDescription: `${service.name} in ${city} by ${name}, a trusted local ${categoryLabel.toLowerCase()}.${rating ? ` Rated ${rating}/5.` : ""} ${primaryService} services with upfront pricing — call ${phone}.`,
    bodyMarkdown: body,
    targetKeyword: `${service.name} ${city}`.toLowerCase(),
    serviceRef: service.name,
  };
}

/**
 * The full, deterministic set of candidate articles for a business, ordered by
 * priority (area-targeted long-tails first, then service guides). The caller
 * picks how many new ones to publish per run and skips slugs that already exist.
 */
export function planPostsFor(business: Business): GeneratedPost[] {
  const areaPosts = nearbyAreasFor(business).map((area) => areaPost(business, area));
  const servicePosts = business.services.map((s) => servicePost(business, s));

  // De-duplicate by slug (a service could collide with an area phrasing).
  const bySlug = new Map<string, GeneratedPost>();
  for (const post of [...areaPosts, ...servicePosts]) {
    if (!bySlug.has(post.slug)) bySlug.set(post.slug, post);
  }
  return [...bySlug.values()];
}
