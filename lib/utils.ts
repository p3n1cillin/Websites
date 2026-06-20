import type { Business, BusinessCategory } from "./types";

/** Default Warrington town-centre coordinates. */
export const WARRINGTON_GEO = { lat: 53.39, lng: -2.597 };

/** Category-specific default hero imagery (royalty-free Unsplash sources). */
const CATEGORY_HERO: Record<BusinessCategory, string> = {
  plumber:
    "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1600&q=80",
  electrician:
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1600&q=80",
  barber:
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1600&q=80",
  restaurant:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
  cleaner:
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80",
  landscaper:
    "https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=1600&q=80",
  dentist:
    "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=1600&q=80",
  mechanic:
    "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1600&q=80",
  "beauty-salon":
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=80",
  roofer:
    "https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&w=1600&q=80",
  // Neutral storefront / interior — safe for any retail or unclassified business
  // (the Industry Profiler can set a more specific business.heroImage later).
  retail:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
  other:
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80",
};

export function heroImageFor(business: Business): string {
  return business.heroImage ?? CATEGORY_HERO[business.category];
}

export function fullAddress(business: Business): string {
  const { line1, line2, city, postcode } = business.address;
  return [line1, line2, city, postcode].filter(Boolean).join(", ");
}

export function telHref(phone: string): string {
  return "tel:" + phone.replace(/[^+\d]/g, "");
}

export function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function geoFor(business: Business) {
  return business.geo ?? WARRINGTON_GEO;
}

/** Google Maps embed URL (no API key required for the basic embed). */
export function mapEmbedSrc(business: Business): string {
  const q = encodeURIComponent(fullAddress(business));
  return `https://maps.google.com/maps?q=${q}&z=14&output=embed`;
}

/** Google Maps directions link. */
export function mapDirectionsHref(business: Business): string {
  const q = encodeURIComponent(fullAddress(business));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

/**
 * Data-integrity predicates ("never fake"). A generated draft leaves unverified
 * facts empty/absent rather than inventing them; these tell the render layer
 * when a fact is real enough to show. Routed through here so the rule lives once.
 */
export function hasPhone(business: Business): boolean {
  return Boolean(business.phone && business.phone.trim());
}
export function hasEmail(business: Business): boolean {
  return Boolean(business.email && business.email.trim());
}
export function hasAddress(business: Business): boolean {
  const a = business.address;
  return Boolean((a.line1 && a.line1.trim()) || (a.postcode && a.postcode.trim()));
}
/** True only when the business has a real aggregate rating (reviews exist). */
export function hasRating(business: Business): boolean {
  return Boolean(business.rating && business.rating.count > 0 && business.rating.value > 0);
}
export function hasReviews(business: Business): boolean {
  return business.testimonials.length > 0;
}

/** Formatted rating, or null when there is none (never fabricate "5.0"). */
export function averageRating(business: Business): string | null {
  return hasRating(business) ? business.rating!.value.toFixed(1) : null;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
