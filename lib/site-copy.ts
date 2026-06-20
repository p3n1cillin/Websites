/**
 * Vertical-aware site copy + CTA resolution.
 *
 * The render layer must not assume every business is a trade ("services for homes
 * and businesses" leaks onto pubs, salons, shops). This maps a Business to a coarse
 * VERTICAL and returns copy + a NON-DUPLICATE primary/secondary CTA pair. Pure +
 * deterministic so it's safe in SSG. The Industry Profiler can still override
 * section copy via Business.highlights.heading etc.; this is the truthful baseline.
 */

import type { Business } from "./types";
import { hasPhone, telHref } from "./utils";

export type Vertical = "hospitality" | "trade" | "personal-care" | "retail" | "generic";

const TRADE = new Set(["plumber", "electrician", "cleaner", "landscaper", "roofer", "mechanic"]);
const PERSONAL = new Set(["barber", "beauty-salon", "dentist"]);
const HOSPITALITY_RE =
  /\b(pub|bar|tavern|inn|restaurant|cafe|café|coffee|bistro|eatery|diner|grill|kitchen|brewery|brasserie|takeaway|deli|bakery|teahouse|gastro)\b/i;

/**
 * Core classifier from raw parts — shared by the render layer (verticalOf) and the
 * draft generator (which only has a prospect's category + industry text, no Business).
 */
export function verticalFromParts(category: string, industryText?: string): Vertical {
  const label = `${industryText ?? ""} ${category}`;
  if (category === "restaurant" || HOSPITALITY_RE.test(label)) return "hospitality";
  if (TRADE.has(category)) return "trade";
  if (PERSONAL.has(category)) return "personal-care";
  if (category === "retail") return "retail";
  return "generic";
}

/** Classify a business into a coarse vertical that drives copy + CTA wording. */
export function verticalOf(b: Business): Vertical {
  return verticalFromParts(b.category, `${b.industryLabel ?? ""} ${b.categoryLabel}`);
}

export interface OfferCopy {
  /** Small kicker above the heading. */
  eyebrow: string;
  /** Section H2. */
  heading: string;
  /** Supporting line. */
  subheading: string;
  /** "View all …" button label. */
  viewAll: string;
}

/** Copy for the main offerings section, appropriate to the vertical. */
export function offerCopy(b: Business): OfferCopy {
  const v = verticalOf(b);
  const city = b.address.city;
  const cat = b.categoryLabel.toLowerCase();
  switch (v) {
    case "hospitality":
      return {
        eyebrow: "What we offer",
        heading: `What's on at ${b.name}`,
        subheading: `Great food, drink and a warm welcome in the heart of ${city}.`,
        viewAll: "See the full menu",
      };
    case "trade":
      return {
        eyebrow: "What we do",
        heading: `Our ${b.primaryService.toLowerCase()} services`,
        subheading: `Trusted ${cat} for homes and businesses across ${city}.`,
        viewAll: "View all services",
      };
    case "personal-care":
      return {
        eyebrow: "What we offer",
        heading: "Our services",
        subheading: `Expert ${cat} in ${city} — book in a few taps.`,
        viewAll: "View all services",
      };
    case "retail":
      return {
        eyebrow: "What we offer",
        heading: "What we stock",
        subheading: `Quality products and friendly service in ${city}.`,
        viewAll: "Browse the range",
      };
    default:
      return {
        eyebrow: "What we offer",
        heading: "What we offer",
        subheading: `Trusted ${cat} in ${city}.`,
        viewAll: "View everything",
      };
  }
}

export interface ResolvedCta {
  label: string;
  href: string;
  /** True when href is a tel: link (render with a phone icon). */
  isTel: boolean;
}

export interface ResolvedCtas {
  primary: ResolvedCta;
  secondary: ResolvedCta;
}

/**
 * Resolve a NON-DUPLICATE primary + secondary CTA for a business.
 *
 * The bug this kills: with no verified phone, the old code fell back to "Book
 * Online" for BOTH buttons. Here, when there's no phone the booking/enquiry action
 * takes the primary slot and the secondary always offers a genuinely different path.
 */
export function resolveCtas(b: Business): ResolvedCtas {
  const v = verticalOf(b);
  const slug = b.slug;
  const bookHref = b.enableBooking ? `/${slug}/book` : `/${slug}/contact`;
  const bookLabel =
    v === "hospitality"
      ? b.enableBooking
        ? "Book a Table"
        : "Enquire Now"
      : b.enableBooking
        ? "Book Online"
        : "Get a Free Quote";

  if (hasPhone(b)) {
    return {
      primary: { label: `Call ${b.phone}`, href: telHref(b.phone), isTel: true },
      secondary: { label: bookLabel, href: bookHref, isTel: false },
    };
  }

  // No phone → primary takes the booking/enquiry slot; secondary must differ.
  const secondary: ResolvedCta =
    v === "hospitality"
      ? { label: "View Menu", href: `/${slug}/services`, isTel: false }
      : { label: "Get in Touch", href: `/${slug}/contact`, isTel: false };
  return {
    primary: { label: bookLabel, href: bookHref, isTel: false },
    secondary,
  };
}
