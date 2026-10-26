/**
 * Map Pack Kit — product catalogue + order-input model (pure, zero deps).
 *
 * The Map Pack Kit is a self-serve DIGITAL PRODUCT: a tailored Google Business
 * Profile content kit (optimised profile, a dated post calendar, review scripts +
 * replies, Q&A, social + website copy) generated instantly after Stripe payment.
 *
 * Order inputs travel in Stripe Checkout metadata (50 keys / 500 chars each), so
 * fulfilment needs no database row — see lib/kit/order.ts.
 */

export type KitTier = "starter" | "complete";

export type KitTone = "friendly" | "professional" | "premium";

export interface KitInput {
  businessName: string;
  trade: string;
  town: string;
  /** Other towns/areas covered (free text). */
  areas: string;
  /** Services offered (free text, comma/line separated). */
  services: string;
  /** What makes them different — ONLY facts the owner supplies. */
  usp: string;
  phone: string;
  website: string;
  /** Their Google "ask for reviews" short link (for the QR card). Optional. */
  reviewLink: string;
  tone: KitTone;
}

export type SectionId =
  | "profile"
  | "posts_monthly"
  | "posts_q1"
  | "posts_q2"
  | "posts_q3"
  | "posts_q4"
  | "reviews"
  | "qa"
  | "social"
  | "website";

export interface TierInfo {
  id: KitTier;
  name: string;
  pricePence: number;
  /** One-line positioning shown on the pricing card. */
  blurb: string;
  sections: SectionId[];
  features: string[];
}

const envPence = (key: string, fallback: number): number => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n >= 100 ? Math.round(n) : fallback;
};

export const KIT_PRODUCT_NAME = "Map Pack Kit";

export const TIERS: Record<KitTier, TierInfo> = {
  starter: {
    id: "starter",
    name: "Starter Kit",
    pricePence: envPence("KIT_PRICE_STARTER_PENCE", 1900),
    blurb: "The essentials to fix your profile and keep it active monthly.",
    sections: ["profile", "posts_monthly", "reviews"],
    features: [
      "Optimised 750-character business description",
      "Service list with descriptions, ready to paste",
      "Category, attribute and keyword suggestions",
      "12 monthly Google posts, dated and seasonal",
      "Review request scripts (SMS, WhatsApp, email)",
      "15 ready-made review replies",
      "Printable review QR card",
    ],
  },
  complete: {
    id: "complete",
    name: "Complete Kit",
    pricePence: envPence("KIT_PRICE_COMPLETE_PENCE", 2900),
    blurb: "A full year of weekly content plus everything around your profile.",
    sections: ["profile", "posts_q1", "posts_q2", "posts_q3", "posts_q4", "reviews", "qa", "social", "website"],
    features: [
      "Everything in Starter",
      "52 weekly Google posts, a full year, dated",
      "15 Q&As to pre-load on your profile",
      "Facebook + Instagram bios and 10 captions",
      "Website homepage, about and area copy",
      "SEO title and meta description",
    ],
  },
};

export const SECTION_LABELS: Record<SectionId, string> = {
  profile: "Profile optimisation",
  posts_monthly: "12 monthly posts",
  posts_q1: "Posts: weeks 1-13",
  posts_q2: "Posts: weeks 14-26",
  posts_q3: "Posts: weeks 27-39",
  posts_q4: "Posts: weeks 40-52",
  reviews: "Review toolkit",
  qa: "Profile Q&A",
  social: "Social media pack",
  website: "Website copy",
};

export const ALL_SECTIONS = Object.keys(SECTION_LABELS) as SectionId[];

export function isSectionId(v: string): v is SectionId {
  return (ALL_SECTIONS as string[]).includes(v);
}

export function isTier(v: string): v is KitTier {
  return v === "starter" || v === "complete";
}

export const gbpPrice = (pence: number) =>
  `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

// ---------------------------------------------------------------------------
// Validation + Stripe-metadata (de)serialisation.
// ---------------------------------------------------------------------------
const LIMITS: Record<keyof KitInput, number> = {
  businessName: 80,
  trade: 60,
  town: 60,
  areas: 300,
  services: 480,
  usp: 480,
  phone: 30,
  website: 200,
  reviewLink: 200,
  tone: 20,
};

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export interface ParseResult {
  ok: boolean;
  input?: KitInput;
  error?: string;
}

/** Validate untrusted form/metadata input into a KitInput. */
export function parseKitInput(raw: Record<string, unknown>): ParseResult {
  const get = (k: keyof KitInput) => clean(raw[k], LIMITS[k]);
  const tone = get("tone");
  const input: KitInput = {
    businessName: get("businessName"),
    trade: get("trade"),
    town: get("town"),
    areas: get("areas"),
    services: get("services"),
    usp: get("usp"),
    phone: get("phone"),
    website: get("website"),
    reviewLink: get("reviewLink"),
    tone: tone === "professional" || tone === "premium" ? tone : "friendly",
  };
  if (input.businessName.length < 2) return { ok: false, error: "Please enter your business name." };
  if (input.trade.length < 2) return { ok: false, error: "Please enter your trade or business type." };
  if (input.town.length < 2) return { ok: false, error: "Please enter the town you're based in." };
  if (input.services.length < 3) return { ok: false, error: "Please list at least one service." };
  if (input.reviewLink && !/^https?:\/\//i.test(input.reviewLink)) {
    return { ok: false, error: "Your review link should start with https://" };
  }
  if (input.website && !/^https?:\/\//i.test(input.website)) {
    input.website = `https://${input.website}`;
  }
  return { ok: true, input };
}

/** Flatten an order into Stripe metadata (all strings, within limits). */
export function toMetadata(input: KitInput, tier: KitTier): Record<string, string> {
  const md: Record<string, string> = { kind: "map_pack_kit", tier, v: "1" };
  for (const [k, v] of Object.entries(input)) {
    if (v) md[k] = String(v).slice(0, 490);
  }
  return md;
}
