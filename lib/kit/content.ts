/**
 * Map Pack Kit — section content model, JSON schemas, prompts and the generator.
 *
 * Each kit is generated as independent SECTIONS (profile, post quarters, reviews…)
 * so every model call is short (~10–25s). That keeps each request well inside
 * serverless timeouts on free hosting tiers, lets the client show live progress,
 * and makes fulfilment idempotent per section (see lib/kit/storage.ts).
 *
 * Integrity rule (project-wide "never fake"): the model may only use facts the
 * owner supplied. Anything specific it can't know (prices, years trading,
 * accreditation numbers, guarantees) becomes an obvious [square-bracket]
 * placeholder for the owner to fill in, never an invented claim.
 *
 * Customer fulfilment is deliberately NOT routed through `runAgent`: a paid order
 * must never be blocked by the agency's autonomy/spend caps. Cost is bounded by the
 * fixed section set per paid Stripe session + idempotent storage.
 */

import { createAiClient, aiConfigured, type AiUsage } from "../ai/client";
import type { AiTier } from "../ai/models";
import { TASTE_COPY_RULES } from "../design/taste";
import type { KitInput, KitTier, SectionId } from "./catalog";

// ---------------------------------------------------------------------------
// Output shapes
// ---------------------------------------------------------------------------
export interface KitService {
  name: string;
  description: string;
}

export interface ProfileSection {
  description: string;
  openingLine: string;
  primaryCategory: string;
  secondaryCategories: string[];
  services: KitService[];
  attributes: string[];
  keywords: string[];
  checklist: string[];
}

export interface KitPost {
  /** Filled in by code from the schedule, not the model. */
  date: string;
  title: string;
  type: string;
  body: string;
  cta: string;
  photoIdea: string;
}

export interface PostsSection {
  posts: KitPost[];
}

export interface ReviewsSection {
  requests: { channel: string; label: string; text: string }[];
  replies: { scenario: string; stars: number; text: string }[];
  tips: string[];
}

export interface QaSection {
  items: { q: string; a: string }[];
}

export interface SocialSection {
  facebookBio: string;
  instagramBio: string;
  nextdoorIntro: string;
  captions: { platform: string; text: string; hashtags: string[] }[];
}

export interface WebsiteSection {
  metaTitle: string;
  metaDescription: string;
  heroHeadline: string;
  heroSubheading: string;
  about: string[];
  areaParagraph: string;
  ctas: string[];
}

export type SectionContent =
  | ProfileSection
  | PostsSection
  | ReviewsSection
  | QaSection
  | SocialSection
  | WebsiteSection;

export interface StoredSection<T = SectionContent> {
  id: SectionId;
  generatedAt: string;
  model: string;
  costPence: number;
  regens: number;
  content: T;
}

// ---------------------------------------------------------------------------
// Schedule helpers (pure)
// ---------------------------------------------------------------------------
const DAY = 86_400_000;

/** The Monday on/after `from` (UTC date arithmetic, local-agnostic). */
export function nextMonday(from: Date): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const dow = d.getUTCDay(); // 0 Sun … 6 Sat
  const add = dow === 1 ? 0 : (8 - dow) % 7;
  return new Date(d.getTime() + add * DAY);
}

const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Dates for a posts section. Weekly quarters = 13 Mondays; monthly = 12 firsts. */
export function scheduleFor(section: SectionId, orderDate: Date): string[] {
  if (section === "posts_monthly") {
    const y = orderDate.getUTCFullYear();
    const m = orderDate.getUTCMonth();
    return Array.from({ length: 12 }, (_, i) => fmt(new Date(Date.UTC(y, m + i + (orderDate.getUTCDate() > 20 ? 1 : 0), 1))));
  }
  const q = { posts_q1: 0, posts_q2: 1, posts_q3: 2, posts_q4: 3 }[section as "posts_q1"];
  if (q === undefined) return [];
  const start = nextMonday(orderDate);
  return Array.from({ length: 13 }, (_, i) => fmt(new Date(start.getTime() + (q * 13 + i) * 7 * DAY)));
}

export const isPostsSection = (s: SectionId) => s.startsWith("posts_");

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const str = (description: string) => ({ type: "string", description });
const strArr = (description: string, min?: number, max?: number) => ({
  type: "array",
  items: { type: "string" },
  description,
  ...(min ? { minItems: min } : {}),
  ...(max ? { maxItems: max } : {}),
});

const POST_CTAS = ["Call now", "Book", "Learn more", "Get offer", "Sign up", "Order online"];

const SCHEMAS: Record<string, Record<string, unknown>> = {
  profile: {
    type: "object",
    required: ["description", "openingLine", "primaryCategory", "secondaryCategories", "services", "attributes", "keywords", "checklist"],
    properties: {
      description: str("Google Business Profile 'from the business' description. 600-750 characters. Mentions the town, main services and what makes them different. No URLs, no phone numbers, no ALL CAPS."),
      openingLine: str("A punchy one-sentence summary (max 140 chars) for use anywhere."),
      primaryCategory: str("The single best-fit Google Business Profile primary category (use Google's real category naming, e.g. 'Plumber')."),
      secondaryCategories: strArr("3-6 relevant real Google secondary categories.", 3, 6),
      services: {
        type: "array",
        minItems: 6,
        maxItems: 12,
        description: "Services to add in the profile's Services section. Based on the services supplied, expanded into sensible specific sub-services typical for the trade.",
        items: {
          type: "object",
          required: ["name", "description"],
          properties: { name: str("Service name, max 50 chars"), description: str("Service description, 150-300 characters, specific and benefit-led.") },
        },
      },
      attributes: strArr("5-8 profile attributes/highlights the owner should tick IF true (e.g. 'Online estimates', 'Onsite services'). Phrase as Google attribute names.", 5, 8),
      keywords: strArr("10 local search phrases customers use, e.g. 'emergency plumber Warrington'.", 8, 12),
      checklist: strArr("8-10 specific actions to optimise THIS profile this week, each one sentence, imperative.", 8, 10),
    },
  },
  posts: {
    type: "object",
    required: ["posts"],
    properties: {
      posts: {
        type: "array",
        description: "Exactly one post per scheduled date, in the same order.",
        items: {
          type: "object",
          required: ["title", "type", "body", "cta", "photoIdea"],
          properties: {
            title: str("Short headline, max 58 characters."),
            type: { type: "string", enum: ["Update", "Offer", "Tip", "Seasonal", "Behind the scenes", "FAQ", "Project spotlight"] },
            body: str("Post text, 80-150 words, max 1,400 characters. Ends with a clear next step. No hashtags. No phone numbers or URLs (the button handles that)."),
            cta: { type: "string", enum: POST_CTAS },
            photoIdea: str("What photo to take or attach for this post, one sentence, realistic for the owner to shoot on a phone."),
          },
        },
      },
    },
  },
  reviews: {
    type: "object",
    required: ["requests", "replies", "tips"],
    properties: {
      requests: {
        type: "array",
        minItems: 6,
        maxItems: 8,
        description: "Review request messages: 2 SMS, 2 WhatsApp, 1 email (with subject line on first line as 'Subject: ...'), 1 in-person script. Use [Customer name] and [Review link] placeholders.",
        items: {
          type: "object",
          required: ["channel", "label", "text"],
          properties: { channel: { type: "string", enum: ["SMS", "WhatsApp", "Email", "In person"] }, label: str("When to use it, e.g. 'Right after the job'"), text: str("The message.") },
        },
      },
      replies: {
        type: "array",
        minItems: 15,
        maxItems: 15,
        description: "15 review reply templates: 7 for 5-star, 3 for 4-star, 2 for 3-star, 3 for 1-2 star (calm, professional, take it offline, never argue or disclose customer details). Use [Customer name] placeholder.",
        items: {
          type: "object",
          required: ["scenario", "stars", "text"],
          properties: { scenario: str("e.g. '5 stars, mentions punctuality'"), stars: { type: "integer", minimum: 1, maximum: 5 }, text: str("Reply text, 30-80 words, varied openings.") },
        },
      },
      tips: strArr("6 specific tips to get more Google reviews for this kind of business, compliant with Google's policies (no incentives, no gating).", 5, 7),
    },
  },
  qa: {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 15,
        maxItems: 15,
        description: "15 questions customers genuinely ask this kind of business before booking, with helpful answers (40-90 words). Use [placeholders] for prices, times or facts not supplied.",
        items: { type: "object", required: ["q", "a"], properties: { q: str("Question"), a: str("Answer") } },
      },
    },
  },
  social: {
    type: "object",
    required: ["facebookBio", "instagramBio", "nextdoorIntro", "captions"],
    properties: {
      facebookBio: str("Facebook page 'About' intro, max 255 characters."),
      instagramBio: str("Instagram bio, max 150 characters, line breaks allowed, no emoji."),
      nextdoorIntro: str("A friendly Nextdoor business introduction post, 60-110 words."),
      captions: {
        type: "array",
        minItems: 10,
        maxItems: 10,
        description: "10 social captions mixing Facebook and Instagram, varied angles (before/after, tip, meet the team, local pride, seasonal).",
        items: {
          type: "object",
          required: ["platform", "text", "hashtags"],
          properties: { platform: { type: "string", enum: ["Facebook", "Instagram"] }, text: str("Caption, 40-120 words."), hashtags: strArr("3-8 relevant local + trade hashtags without spaces, each starting with #.") },
        },
      },
    },
  },
  website: {
    type: "object",
    required: ["metaTitle", "metaDescription", "heroHeadline", "heroSubheading", "about", "areaParagraph", "ctas"],
    properties: {
      metaTitle: str("SEO title tag, 50-60 characters, format '[Service] in [Town] | [Business]'."),
      metaDescription: str("Meta description, 140-155 characters, with a call to action."),
      heroHeadline: str("Homepage headline, max 60 characters."),
      heroSubheading: str("Homepage subheading, 120-180 characters."),
      about: strArr("About-us copy as 3 short paragraphs (40-80 words each). Use [placeholders] for years trading, founder name, accreditations unless supplied.", 3, 3),
      areaParagraph: str("A 'Areas we cover' paragraph naming the town and supplied areas, 60-100 words."),
      ctas: strArr("5 button/CTA label options, 2-5 words each.", 5, 5),
    },
  },
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
const TONE: Record<KitInput["tone"], string> = {
  friendly: "Warm, down-to-earth and approachable, like a trusted local tradesperson talking to a neighbour.",
  professional: "Clear, confident and professional. Reassuring, precise, no slang.",
  premium: "Polished and premium. Calm confidence, emphasis on quality and care, never salesy.",
};

const SYSTEM = `You are a UK local-marketing copywriter who specialises in Google Business Profiles for small local businesses.
Write in British English (colour, specialise, favourite) with UK conventions.

Hard integrity rules:
- Only state facts the owner supplied. Never invent years in business ("years of experience" included), awards, accreditations, certificate numbers, guarantees, warranties, prices, discounts, review counts, staff names, response times, emergency or 24/7 availability, or services they didn't list (sensible sub-services of listed services are fine).
- Where a specific fact would help, insert a clear placeholder in square brackets for the owner to fill, e.g. [years trading], [Gas Safe number], [£ price], [X% off]. Use placeholders sparingly, only where they add real value.
- Offers must either be non-monetary (free quote, free check) or use a [placeholder] for the amount.
- Follow Google Business Profile content policy: no phone numbers or URLs inside post text, no ALL CAPS, no excessive punctuation, nothing misleading.

${TASTE_COPY_RULES}`;

function brief(input: KitInput): string {
  const lines = [
    `Business name: ${input.businessName}`,
    `Trade / business type: ${input.trade}`,
    `Based in: ${input.town}`,
    input.areas && `Also covers: ${input.areas}`,
    `Services (from the owner): ${input.services}`,
    input.usp && `What makes them different (owner's own words, treat as true): ${input.usp}`,
    `Tone of voice: ${TONE[input.tone]}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function sectionTask(section: SectionId, input: KitInput, dates: string[]): string {
  switch (section) {
    case "profile":
      return "Produce the complete Google Business Profile optimisation pack for this business.";
    case "posts_monthly":
    case "posts_q1":
    case "posts_q2":
    case "posts_q3":
    case "posts_q4":
      return `Write ${dates.length} Google Business Profile posts, one for each scheduled date below, in order.
Schedule: ${dates.map((d, i) => `${i + 1}. ${d}`).join("; ")}
- Make each post timely for its date in the UK (weather, seasons, school holidays, bank holidays, Christmas, New Year, spring clean, summer, back to school, clocks changing, winter prep) where it genuinely fits this trade. Don't force it.
- Mix types across the set: mostly helpful tips and updates, some project spotlights (written so the owner can describe a real recent job: use [area] / [job detail] placeholders), a few non-monetary or placeholder offers, FAQs.
- Each post should naturally mention ${input.town} or a covered area and one specific service, to help local ranking. Vary wording so no two posts open the same way.`;
    case "reviews":
      return "Produce the review toolkit: request messages, reply templates and tips.";
    case "qa":
      return "Produce 15 customer Q&As the owner can add to their profile and website FAQ.";
    case "social":
      return "Produce the social media starter pack.";
    case "website":
      return "Produce homepage website copy and SEO tags for this business.";
  }
}

const schemaKey = (s: SectionId) => (isPostsSection(s) ? "posts" : s);

const MAX_TOKENS: Record<string, number> = {
  profile: 3000,
  posts: 6000,
  reviews: 4000,
  qa: 4000,
  social: 3000,
  website: 2500,
};

/** Model tier for kit generation. Haiku-class ("fast") keeps each section ~10–25s. */
export function kitTier(): AiTier {
  const t = process.env.KIT_AI_TIER;
  return t === "smart" || t === "max" ? t : "fast";
}

export interface GenerateResult<T = SectionContent> {
  content: T;
  usage: AiUsage;
}

/**
 * Generate one section. Throws on AI failure (caller reports + allows retry).
 * Refuses in STUB mode: a paying customer must never receive placeholder output.
 */
export async function generateSection(
  section: SectionId,
  input: KitInput,
  orderDate: Date,
  opts: { tier?: AiTier } = {}
): Promise<GenerateResult> {
  if (!aiConfigured) throw new Error("AI is not configured (ANTHROPIC_API_KEY missing).");
  const dates = isPostsSection(section) ? scheduleFor(section, orderDate) : [];
  const key = schemaKey(section);
  const client = createAiClient();
  const { value, usage } = await client.completeJson<SectionContent>({
    tier: opts.tier ?? kitTier(),
    system: SYSTEM,
    prompt: `${brief(input)}\n\nTask: ${sectionTask(section, input, dates)}\n\nReturn the result via the tool.`,
    schema: SCHEMAS[key]!,
    maxTokens: MAX_TOKENS[key],
    temperature: 0.8,
  });
  if (isPostsSection(section)) {
    const posts = ((sanitize(value) as PostsSection).posts ?? []).slice(0, dates.length);
    if (posts.length < Math.ceil(dates.length * 0.75)) {
      throw new Error(`Model returned ${posts.length}/${dates.length} posts.`);
    }
    return { content: { posts: posts.map((p, i) => ({ ...p, date: dates[i]! })) }, usage };
  }
  return { content: sanitize(value), usage };
}

/**
 * Deterministic copy clean-up over every string in a model result: em/en-dash
 * flourishes become plain punctuation (taste rule), emoji are stripped.
 */
export function sanitize<T>(v: T): T {
  if (typeof v === "string") {
    return v
      .replace(/\s*\u2014\s*/g, ", ")
      .replace(/\s\u2013\s/g, " - ")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\uFE0F?/gu, "")
      .replace(/ ,/g, ",")
      .replace(/,\s*,/g, ",") as T;
  }
  if (Array.isArray(v)) return v.map(sanitize) as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sanitize(x)])) as T;
  }
  return v;
}

// ---------------------------------------------------------------------------
// Free tool (lead magnet): description + 3 sample posts, one cheap call.
// ---------------------------------------------------------------------------
export interface FreeSample {
  description: string;
  posts: { title: string; body: string }[];
}

export async function generateFreeSample(input: KitInput): Promise<GenerateResult<FreeSample>> {
  if (!aiConfigured) throw new Error("AI is not configured.");
  const client = createAiClient();
  const { value, usage } = await client.completeJson<FreeSample>({
    tier: "fast",
    system: SYSTEM,
    prompt: `${brief(input)}\n\nTask: write the Google Business Profile description (600-750 characters) and 3 example Google posts (60-110 words each, varied: a tip, a project spotlight with [placeholders], a seasonal post for the coming weeks in the UK).`,
    schema: {
      type: "object",
      required: ["description", "posts"],
      properties: {
        description: { type: "string" },
        posts: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: { type: "object", required: ["title", "body"], properties: { title: { type: "string" }, body: { type: "string" } } },
        },
      },
    },
    maxTokens: 1500,
    temperature: 0.8,
  });
  return { content: sanitize(value), usage };
}

export type { KitTier };
