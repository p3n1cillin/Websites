import {
  BUSINESS_CATEGORIES,
  type Business,
  type BusinessCategory,
} from "./types";

/**
 * Parse the admin Business form (FormData) into a validated `Business` object.
 *
 * Core scalar fields are individual inputs; the structured arrays (services,
 * testimonials, opening hours) are edited as JSON, and the simple lists
 * (service areas, badges) as one-per-line text. Rich per-item editors arrive in
 * step 3 (content editor) — this keeps the whole model editable today.
 */

export interface ParseResult {
  data?: Business;
  errors: string[];
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function str(form: FormData, key: string): string {
  return (form.get(key) as string | null)?.trim() ?? "";
}

function lines(form: FormData, key: string): string[] {
  return str(form, key)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function json<T>(form: FormData, key: string, label: string, errors: string[]): T | undefined {
  const raw = str(form, key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    errors.push(`${label} must be valid JSON.`);
    return undefined;
  }
}

export function parseBusinessForm(
  form: FormData,
  /** When editing, the current object — preserves fields the form doesn't expose (e.g. geo). */
  existing?: Business
): ParseResult {
  const errors: string[] = [];

  const name = str(form, "name");
  if (!name) errors.push("Business name is required.");

  const category = str(form, "category") as BusinessCategory;
  if (!BUSINESS_CATEGORIES.includes(category)) {
    errors.push("A valid category is required.");
  }

  const slug = slugify(str(form, "slug") || name);
  if (!slug) errors.push("A slug could not be derived — set a name or slug.");

  const phone = str(form, "phone");
  if (!phone) errors.push("Phone is required.");
  const email = str(form, "email");
  if (!email) errors.push("Email is required.");

  const city = str(form, "city") || "Warrington";

  const services =
    json<Business["services"]>(form, "services", "Services", errors) ?? [];
  const testimonials =
    json<Business["testimonials"]>(form, "testimonials", "Testimonials", errors) ?? [];
  const openingHours =
    json<Business["openingHours"]>(form, "openingHours", "Opening hours", errors) ?? [];

  const ratingValue = Number(str(form, "ratingValue") || "5");
  const ratingCount = Number(str(form, "ratingCount") || "0");
  if (Number.isNaN(ratingValue) || ratingValue < 0 || ratingValue > 5) {
    errors.push("Rating value must be a number between 0 and 5.");
  }
  if (Number.isNaN(ratingCount) || ratingCount < 0) {
    errors.push("Rating count must be a non-negative number.");
  }

  if (errors.length > 0) return { errors };

  const establishedRaw = str(form, "established");
  const brandPrimary = str(form, "brandPrimary");
  const brandAccent = str(form, "brandAccent");
  const brandLogo = str(form, "brandLogoUrl");
  const hasBrand = brandPrimary || brandAccent || brandLogo;

  const data: Business = {
    slug,
    name,
    category,
    categoryLabel: str(form, "categoryLabel") || name,
    primaryService: str(form, "primaryService") || name,
    tagline: str(form, "tagline"),
    about: str(form, "about"),
    established: establishedRaw ? Number(establishedRaw) : undefined,
    phone,
    email,
    address: {
      line1: str(form, "addressLine1"),
      line2: str(form, "addressLine2") || undefined,
      city,
      postcode: str(form, "postcode"),
    },
    serviceAreas: lines(form, "serviceAreas"),
    services,
    openingHours,
    testimonials,
    // Rating only when real reviews back it (count > 0) — otherwise omit it so
    // the render hides the stars rather than showing an unbacked score.
    rating: ratingCount > 0 ? { value: ratingValue, count: ratingCount } : undefined,
    badges: lines(form, "badges"),
    brand: hasBrand
      ? {
          primary: brandPrimary || undefined,
          accent: brandAccent || undefined,
          logoUrl: brandLogo || undefined,
        }
      : undefined,
    heroImage: str(form, "heroImage") || undefined,
    enableBooking: form.get("enableBooking") === "on",
    // Not exposed in the form yet — preserve when editing.
    geo: existing?.geo,
  };

  return { data, errors: [] };
}
