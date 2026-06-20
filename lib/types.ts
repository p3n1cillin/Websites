/**
 * Canonical business data model.
 *
 * Every generated website is produced entirely from a single `Business` object.
 * Adding a new site = adding one of these (a TS file in lib/data, a row in
 * Supabase, or a record from any other source). No per-business code required.
 */

import type { DesignDNA, PersonalityKey } from "./design/types";

export type BusinessCategory =
  | "plumber"
  | "barber"
  | "restaurant"
  | "electrician"
  | "cleaner"
  | "landscaper"
  | "dentist"
  | "mechanic"
  | "beauty-salon"
  | "roofer"
  // Broad fallback buckets so ANY industry has a sensible home (drives the design
  // feel + palette + default imagery). The true industry is carried in
  // `Business.industryLabel`, and the AI Industry Profiler fills the real copy.
  | "retail"
  | "other";

/** Selectable categories (mirrors the BusinessCategory union for forms/validation). */
export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  "plumber",
  "barber",
  "restaurant",
  "electrician",
  "cleaner",
  "landscaper",
  "dentist",
  "mechanic",
  "beauty-salon",
  "roofer",
  "retail",
  "other",
];

export interface Service {
  /** Short name, e.g. "Boiler Installation". */
  name: string;
  /** One-sentence benefit-led description. */
  description: string;
  /** Optional price, free text so "From £45", "£30/hr" etc. all work. */
  price?: string;
  /** Optional icon key (see components/ServicesGrid icon map). */
  icon?: ServiceIcon;
}

export type ServiceIcon =
  | "wrench"
  | "flame"
  | "scissors"
  | "sparkles"
  | "bolt"
  | "leaf"
  | "tooth"
  | "car"
  | "shield"
  | "star";

/**
 * Industry-specific content blocks (Agency OS — dynamic site structure). All
 * optional: a section renders only when its data is present, so the same render
 * layer adapts to any industry. The AI Industry Profiler decides which a business
 * needs and fills them (e.g. a solicitor → practice-area highlights; a restaurant
 * → a menu; a collectables shop → product-category highlights). See HomeSections.
 */

/** A flexible feature/specialty card — practice areas, treatments, categories, etc. */
export interface Highlight {
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface MenuItem {
  name: string;
  description?: string;
  price?: string;
}

export interface MenuSection {
  name: string;
  items: MenuItem[];
}

export interface Testimonial {
  author: string;
  /** 1–5. */
  rating: number;
  quote: string;
  /** Optional location/area for local-trust signalling. */
  location?: string;
}

export interface OpeningHour {
  /** "Monday", "Tuesday", … or "Mon–Fri" style label. */
  day: string;
  /** e.g. "08:00 – 18:00" or "Closed". */
  hours: string;
}

export interface BusinessBrand {
  /** Hex (e.g. "#1d4ed8"). If omitted, generated from name + category. */
  primary?: string;
  /** Hex accent. If omitted, derived from primary. */
  accent?: string;
  /** Optional logo URL. If omitted, a monogram badge is rendered. */
  logoUrl?: string;
}

/** Provenance of a single factual field on a generated draft. */
export type FieldStatus = "verified" | "template" | "missing";

/**
 * Per-field provenance for a generated Business draft. Drives the admin
 * verification checklist and the QA data-integrity gate. Marketing copy
 * (services/about/badges) is intentionally NOT tracked here — only facts a
 * site must not get wrong.
 */
export interface BusinessVerification {
  phone: FieldStatus;
  email: FieldStatus;
  address: FieldStatus;
  rating: FieldStatus;
  testimonials: FieldStatus;
}

export interface Business {
  /** URL slug, unique. e.g. "elite-plumbing-warrington". */
  slug: string;
  name: string;
  category: BusinessCategory;
  /** Human label for the category, e.g. "Emergency Plumber". */
  categoryLabel: string;
  /**
   * The true human industry, e.g. "Collectables & Trading-Card Shop". Set by the
   * Industry Profiler for businesses outside the core trades; `category` is then
   * just the broad design bucket (retail/other). Drives no machinery — copy only.
   */
  industryLabel?: string;
  /** Primary keyword/service for SEO titles, e.g. "Plumber". */
  primaryService: string;
  tagline: string;
  /** 1–2 paragraph "about" body. */
  about: string;
  /** Founding year, used in trust copy. */
  established?: number;

  phone: string;
  email: string;

  address: {
    line1: string;
    line2?: string;
    city: string; // "Warrington"
    postcode: string;
  };

  /** Areas served, used for local-SEO internal copy. */
  serviceAreas: string[];

  services: Service[];
  openingHours: OpeningHour[];
  /** Real customer reviews. May be empty — we NEVER fabricate testimonials. */
  testimonials: Testimonial[];

  /**
   * Aggregate rating shown in schema + UI. OPTIONAL and present only when the
   * business has real reviews — absent means "no reviews yet" (the render hides
   * the stars and JSON-LD omits aggregateRating). We never invent a rating.
   */
  rating?: { value: number; count: number };

  /**
   * Per-field provenance for generated drafts (data-integrity / "never fake").
   * `verified` = from a real source (OSM tag / manual entry); `template` =
   * generic marketing draft the operator must confirm/replace; `missing` = no
   * truthful value, render shows a labelled placeholder. Absent on hand-authored
   * Businesses (demo data / fully-onboarded customers) which are trusted as-is.
   */
  verification?: BusinessVerification;

  /** Headline trust badges, e.g. "Gas Safe Registered". */
  badges: string[];

  /**
   * Optional, industry-specific sections. Each renders only when present, so the
   * site structure adapts to the business — a flexible feature/specialty grid
   * (`highlights`), customer FAQs, and a `menu` for food businesses.
   */
  highlights?: { heading?: string; items: Highlight[] };
  faqs?: FaqItem[];
  menu?: { heading?: string; sections: MenuSection[] };

  brand?: BusinessBrand;

  /** Optional hero/background image URL. A category default is used if absent. */
  heroImage?: string;

  /** Whether to expose the booking/enquiry page in the nav. */
  enableBooking: boolean;

  /** Geo coordinates for map + schema. Defaults to Warrington centre. */
  geo?: { lat: number; lng: number };

  /**
   * Presentation genome chosen in the Website Factory. When set, the render layer
   * uses it verbatim (see lib/design/dna.ts `getDesignDNA`); when absent the DNA is
   * derived deterministically from the slug. Stored embedded in the Business per
   * docs/AGENCY_OS.md §4.1 ("start embedded, promote to a column if needed").
   */
  design?: DesignDNA;

  /**
   * Explicit design personality. When set (e.g. chosen by the Industry Profiler
   * for a non-trade business) it overrides the category→personality default in
   * the DNA generator, so any industry gets an on-brief feel. See lib/design/dna.ts.
   */
  personality?: PersonalityKey;
}

/**
 * Persistence layer (SaaS).
 *
 * The `Business` above remains the single source of truth that every page
 * renders from. A `BusinessRecord` is how a business is *stored* in the
 * multi-tenant database: the same `Business` object inside `data`, wrapped with
 * tenancy + lifecycle columns (see supabase/migrations/0001_init.sql).
 */
export type Plan = "trial" | "basic" | "pro" | "premium";

/** The billing tenant — one owner, many businesses (see orgs table). */
export interface Org {
  id: string;
  name: string;
  ownerUserId: string;
  plan: Plan;
  trialEndsAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
}

/** A Stripe invoice mirrored locally for the billing dashboard (see invoices table). */
export interface Invoice {
  id: string;
  orgId: string;
  stripeInvoiceId?: string | null;
  amountDue?: number | null; // pence
  currency: string;
  status?: string | null; // paid|open|void
  hostedUrl?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
}

export type BusinessStatus = "draft" | "published";

export type BlogPostStatus = "draft" | "published";

/**
 * An SEO-automation article (see blog_posts table). Generated by the SEO engine
 * (lib/seo-automation.ts) and rendered at /[business]/blog/[post]. The body is
 * trusted, generated Markdown (rendered by components/Markdown.tsx).
 */
export interface BlogPost {
  id: string;
  businessId: string;
  slug: string;
  title: string;
  metaDescription?: string | null;
  bodyMdx: string;
  /** The local-SEO phrase this article targets, e.g. "emergency plumber Latchford". */
  targetKeyword?: string | null;
  /** Optional internal-link target (a service name). */
  serviceRef?: string | null;
  status: BlogPostStatus;
  publishedAt?: string | null;
  /** Denormalised for cross-business listings (joined from the business). */
  businessSlug?: string;
}

export type LeadType = "enquiry" | "booking";
export type LeadStatus = "new" | "contacted" | "won" | "lost";

export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "won", "lost"];

/** A captured contact/booking submission (see leads table). */
export interface Lead {
  id: string;
  businessId: string;
  type: LeadType;
  name: string;
  email?: string | null;
  phone: string;
  service?: string | null;
  message?: string | null;
  preferredDate?: string | null;
  status: LeadStatus;
  sourcePath?: string | null;
  createdAt: string;
  /** Denormalised for the inbox display (joined from the business). */
  businessName?: string;
  businessSlug?: string;
}

// ---------------------------------------------------------------------------
// Prospects (Agency OS — acquisition side). OUTBOUND discovery targets, distinct
// from `Lead`s (a live customer's inbound enquiries). See docs/AGENCY_OS.md §5.
// ---------------------------------------------------------------------------

export type ProspectStatus =
  | "discovered" // found, not yet assessed
  | "analysed" // Market agent has scored + written an angle
  | "previewed" // a demo site has been generated (Phase E)
  | "contacted" // outreach sent (Phase E)
  | "responded"
  | "negotiating"
  | "won"
  | "lost";

export const PROSPECT_STATUSES: ProspectStatus[] = [
  "discovered",
  "analysed",
  "previewed",
  "contacted",
  "responded",
  "negotiating",
  "won",
  "lost",
];

/** Where a prospect came from (provenance — kept for ToS/audit, docs §9). */
export interface ProspectSource {
  origin: "manual" | "import" | "discovery";
  /** Free-text note, e.g. the original pasted line or the discovery brief. */
  note?: string;
  /** The raw industry text as entered (e.g. "trading cards"), preserved even when
   * the design `category` bucket is broad (retail/other). Feeds the AI profiler. */
  industry?: string;
  at?: string;
}

/**
 * A real, homepage-only audit of a prospect's EXISTING website (Opportunity
 * Analysis engine). Server-fetched + heuristically scored — not a headless-browser
 * Lighthouse run, but enough concrete weaknesses to power a genuine opportunity
 * score and the "show, don't tell" before/after pitch. See lib/audit.ts.
 */
export interface WebsiteAudit {
  url: string;
  /** Did the homepage load at all? */
  reachable: boolean;
  statusCode?: number;
  https: boolean;
  /** 0–100 quality of their current site (low = big opportunity). */
  overall: number;
  signals: {
    hasTitle: boolean;
    titleLength: number;
    hasMetaDescription: boolean;
    hasViewport: boolean;
    hasH1: boolean;
    hasStructuredData: boolean;
    hasOpenGraph: boolean;
    hasFavicon: boolean;
    hasPhoneLink: boolean;
    hasCtaSignal: boolean;
    imageCount: number;
    imagesWithoutAlt: number;
    wordCount: number;
    htmlBytes: number;
    /** Detected DIY site-builder (wix/weebly/etc.), if any. */
    builder?: string | null;
    /** Social profile URLs linked from the homepage (facebook/instagram/etc.). */
    socials?: string[];
  };
  /**
   * Reputation Intelligence (Phase 2) — review signals mined from the homepage we
   * already fetch (zero-dependency, no paid API). Tells us where their reviews
   * live and whether they're surfaced on-site — the trust gap to pitch on.
   */
  reputation?: {
    /** Review platforms linked from the page (Google, Trustpilot, Checkatrade…). */
    platforms: string[];
    /** A rating/review-count the site advertises on-page, if detected. */
    onPageRating?: { value?: number; count?: number } | null;
    /** Rough count of on-page testimonial/review blocks. */
    testimonialCount: number;
  };
  /** Plain-language weaknesses — the sales ammunition. */
  issues: string[];
  at: string;
}

/** The Market/Competitor agent's verdict on a prospect. */
export interface ProspectAnalysis {
  /** 1–2 sentence read on the opportunity. */
  summary: string;
  /** The winning angle — what their current presence lacks that we'd fix. */
  angle: string;
  /** Recommended design personality for the eventual build. */
  personality?: string;
  /** Notable strengths/risks the operator should know. */
  signals?: string[];
  /** The real audit of their existing site, when one was run. */
  audit?: WebsiteAudit | null;
  /** True when written by the AI model; false = deterministic heuristic. */
  ai: boolean;
  at: string;
}

/**
 * Prospect-facing Lead Intelligence Report (Agency OS — acquisition). Deterministic
 * pitch artefact assembled from what we already know (the website audit + scores +
 * category economics) — the sales ammunition for an outreach conversation. Money
 * figures are explicitly modelled ESTIMATES (see `roi.assumptions`), never claimed
 * as fact, in keeping with the platform's data-integrity rule.
 */
export interface LeadIntelReport {
  prospectId: string;
  headline: string;
  currentSite: {
    hasSite: boolean;
    reachable: boolean;
    /** Audit overall 0–100, or null when no audit has run yet. */
    score: number | null;
    problems: string[];
  };
  seoWeaknesses: string[];
  conversionIssues: string[];
  opportunities: string[];
  roi: {
    /** Modelled potential monthly web enquiries for a business of this type/area. */
    estMonthlyLeads: number;
    /** Rough share of that potential they likely capture today (0–100). */
    capturedPct: number;
    /** Potential monthly revenue from web enquiries, in pence (estimate). */
    estMonthlyValuePence: number;
    /** Revenue likely being missed each month with their current presence (estimate). */
    estMissedValuePence: number;
    assumptions: string[];
  };
  talkingPoints: string[];
  ai: boolean;
  at: string;
}

export interface Prospect {
  id: string;
  orgId: string;
  name: string;
  category: BusinessCategory;
  city: string;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  /** 0–100: strength of their current web presence (low = big opportunity). */
  presenceScore: number;
  /** 0–100: overall priority to pursue (high = chase first). */
  opportunityScore: number;
  /** Estimated first-year value to the agency, in pence. */
  valueEstimate: number;
  status: ProspectStatus;
  source?: ProspectSource | null;
  analysis?: ProspectAnalysis | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Sales (Agency OS — Phase E). A `site_preview` is the demo site we build for a
// prospect (the sales asset, viewable by opaque token); `outreach_messages` are
// the generated sales comms. See docs/AGENCY_OS.md §5.
// ---------------------------------------------------------------------------

export type SitePreviewStatus = "active" | "revoked";

/** A generated demo site for a prospect, shown pre-sale at /preview/[token]. */
export interface SitePreview {
  id: string;
  orgId: string;
  prospectId: string;
  /** The scaffolded Business the demo renders from. */
  businessDraft: Business;
  /** The chosen presentation genome. */
  designDna: DesignDNA;
  /** QA agent overall score (0–100). */
  qaScore: number;
  /** Full QA report (sub-scores + notes). */
  qaReport?: unknown;
  /** Opaque, unguessable capability token for the public URL. */
  token: string;
  status: SitePreviewStatus;
  /** How many times the demo has been opened (a buying signal). */
  views: number;
  lastViewedAt?: string | null;
  /** ISO expiry; null = never. */
  expiresAt?: string | null;
  /** Optional password gate for private sharing (null = open link). */
  password?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single interaction on a tokenised demo (lib/preview-analytics). */
export type PreviewEventType = "view" | "dwell" | "click" | "conversion";

/** Aggregated engagement for one demo, shown on the prospect board. */
export interface PreviewStats {
  views: number;
  conversions: number;
  /** Total dwell across sessions, milliseconds. */
  dwellMs: number;
  lastEventAt: string | null;
}

export type OutreachChannel = "email" | "sms";
export type OutreachDirection = "outbound" | "inbound";
export type OutreachStatus = "draft" | "sent" | "failed" | "received";
/** Where a message sits in a follow-up sequence. */
export type OutreachIntent = "initial" | "follow_up" | "final";

/** A generated (or received) sales message in a prospect's thread. */
export interface OutreachMessage {
  id: string;
  orgId: string;
  prospectId: string;
  channel: OutreachChannel;
  direction: OutreachDirection;
  subject?: string | null;
  body: string;
  status: OutreachStatus;
  /** Position in a follow-up sequence. */
  intent: OutreachIntent;
  step: number;
  /** True when the copy was written by the AI model; false = heuristic template. */
  ai: boolean;
  sentAt?: string | null;
  createdAt: string;
}

export type ProposalStatus = "draft" | "sent" | "accepted" | "declined";

/** A tokenised sales proposal a prospect can view + accept. See lib/proposals.ts. */
export interface Proposal {
  id: string;
  orgId: string;
  prospectId: string;
  token: string;
  title: string;
  summary: string;
  deliverables: string[];
  /** One-off build fee, pence. */
  pricePence: number;
  priceNote?: string | null;
  timeline?: string | null;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Onboarding + Customer Portal (Agency OS — Phase F). The won → customer side:
// a tokenised portal for the end customer, their change requests, and the report
// the Success agent produces. See docs/AGENCY_OS.md §5 + §10.
// ---------------------------------------------------------------------------

export type CustomerPortalStatus = "active" | "revoked";

/** Capability-by-token access for an onboarded customer (one per business). */
export interface CustomerPortal {
  id: string;
  orgId: string;
  businessId: string;
  prospectId?: string | null;
  token: string;
  status: CustomerPortalStatus;
  createdAt: string;
  updatedAt: string;
}

export type ChangeRequestStatus = "open" | "in_progress" | "done" | "declined";
export const CHANGE_REQUEST_STATUSES: ChangeRequestStatus[] = [
  "open",
  "in_progress",
  "done",
  "declined",
];
export type ChangeRequestSource = "customer" | "admin";

/** An edit request raised by the customer (via the portal) or the operator. */
export interface ChangeRequest {
  id: string;
  orgId: string;
  businessId: string;
  title: string;
  detail?: string | null;
  status: ChangeRequestStatus;
  source: ChangeRequestSource;
  createdAt: string;
  updatedAt: string;
}

/** The Success agent's read-only health/performance report for a live site. */
export interface CustomerReport {
  businessId: string;
  leads: { total: number; new: number; won: number };
  /** QA re-score of the live site (0–100). */
  qaScore: number;
  qaPass: boolean;
  /** Plain-language headline for the customer/operator. */
  summary: string;
  /** Concrete next-step suggestions to keep the site performing. */
  suggestions: string[];
  /** True when the narrative was AI-written; false = deterministic heuristic. */
  ai: boolean;
  at: string;
}

// ---------------------------------------------------------------------------
// Growth — A/B experiments (Agency OS — Phase G). The Conversion Optimiser agent
// runs headline/CTA tests on live customer sites. See docs/AGENCY_OS.md §10.
// ---------------------------------------------------------------------------

export type ExperimentSlot = "headline" | "cta";
export const EXPERIMENT_SLOTS: ExperimentSlot[] = ["headline", "cta"];

export type ExperimentStatus = "running" | "stopped" | "applied";

/** One arm of an A/B test, with rolling counters. */
export interface ExperimentVariant {
  /** Stable id within the experiment (e.g. "v0", "v1"). */
  id: string;
  /** Short operator-facing label. */
  label: string;
  /** The copy shown to a bucketed visitor. */
  text: string;
  impressions: number;
  conversions: number;
  /** The original (current live) copy — exactly one variant is the control. */
  control?: boolean;
}

export interface Experiment {
  id: string;
  orgId: string;
  businessId: string;
  slot: ExperimentSlot;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  winner?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessRecord {
  id: string;
  orgId: string;
  slug: string;
  city: string;
  category: BusinessCategory;
  status: BusinessStatus;
  customDomain?: string | null;
  /** The full Business object (this file's single source of truth). */
  data: Business;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
