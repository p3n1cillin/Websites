import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type {
  Business,
  BusinessCategory,
  OpeningHour,
  Prospect,
  Service,
  SitePreview,
  SitePreviewStatus,
  Testimonial,
} from "./types";
import type { DesignDNA } from "./design/types";
import { sbSelect, sbInsert, sbUpdate, sbDelete } from "./supabase/client";

/**
 * Site-preview data layer + the Business-draft scaffolder (Agency OS sales side).
 *
 * A `site_preview` is the demo site we generate for a prospect before any deal —
 * the sales asset, viewable at /preview/[token] via an opaque, expiring token.
 *
 * The scaffolder (`draftBusinessFromProspect`) is pure + deterministic: it turns
 * the handful of attributes we know about a prospect into a complete, credible
 * Business using per-category templates, personalised by name + town. It runs with
 * no AI key (the Prospecting agent can enrich the headline copy when one is set,
 * but the baseline is always real — never empty placeholder). The result is rich
 * enough to clear the QA gate (3+ services, 2+ testimonials, badges, hours, about).
 */

// ===========================================================================
// PURE: Business-draft scaffolding from a prospect.
// ===========================================================================

interface CategoryTemplate {
  label: string;
  primary: string;
  /** Second sentence of the about copy (after the generic opener). */
  pitch: string;
  services: Service[];
  badges: string[];
  /** Testimonials sans location (the town is injected at draft time). */
  testimonials: Array<Omit<Testimonial, "location">>;
  /** Whether the trade runs emergency / out-of-hours cover (affects hours copy). */
  emergency?: boolean;
}

const STANDARD_HOURS: OpeningHour[] = [
  { day: "Monday", hours: "08:00 – 18:00" },
  { day: "Tuesday", hours: "08:00 – 18:00" },
  { day: "Wednesday", hours: "08:00 – 18:00" },
  { day: "Thursday", hours: "08:00 – 18:00" },
  { day: "Friday", hours: "08:00 – 18:00" },
  { day: "Saturday", hours: "09:00 – 13:00" },
  { day: "Sunday", hours: "Closed" },
];

const CATEGORY_DRAFT: Record<BusinessCategory, CategoryTemplate> = {
  plumber: {
    label: "Emergency Plumber & Heating Engineer",
    primary: "Plumber",
    pitch:
      "From burst pipes and blocked drains to full boiler installations, our Gas Safe registered engineers offer honest pricing, tidy work and a guarantee on every job.",
    services: [
      { name: "Emergency Plumbing", description: "Burst pipes, leaks and no hot water sorted fast, day or night.", price: "From £75", icon: "wrench" },
      { name: "Boiler Installation", description: "A-rated boilers supplied and fitted by Gas Safe engineers, fully guaranteed.", price: "From £1,800", icon: "flame" },
      { name: "Boiler Servicing & Repair", description: "Annual servicing and same-day repairs to keep your heating safe and efficient.", price: "From £69", icon: "shield" },
      { name: "Bathroom Installation", description: "Complete bathroom design and fitting, from a new shower to a full refit.", price: "Free quote", icon: "sparkles" },
    ],
    badges: ["Gas Safe Registered", "12-Month Guarantee", "No Call-Out Fee"],
    testimonials: [
      { author: "Sarah M.", rating: 5, quote: "Called with a burst pipe and they were here within the hour. Polite, tidy and a fair price." },
      { author: "David R.", rating: 5, quote: "New boiler fitted in a single day with no mess. The quote was the price I paid — no surprises." },
    ],
    emergency: true,
  },
  barber: {
    label: "Traditional & Modern Barbershop",
    primary: "Barber",
    pitch:
      "Skin fades, classic cuts, beard trims and hot-towel shaves from skilled barbers in a relaxed, welcoming shop. Walk in or book online in seconds.",
    services: [
      { name: "Skin Fade", description: "A crisp, tapered fade finished exactly how you like it.", price: "From £18", icon: "scissors" },
      { name: "Cut & Style", description: "A classic or modern cut tailored to you, washed and styled.", price: "From £15", icon: "scissors" },
      { name: "Beard Trim & Shape", description: "Sharp lines and a clean shape, finished with hot towel and oil.", price: "From £10", icon: "sparkles" },
      { name: "Hot-Towel Shave", description: "A traditional cut-throat shave — the ultimate grooming treat.", price: "From £20", icon: "star" },
    ],
    badges: ["Walk-Ins Welcome", "Online Booking", "5-Star Rated"],
    testimonials: [
      { author: "Mark T.", rating: 5, quote: "Best fade in town and a proper friendly atmosphere. Wouldn't go anywhere else." },
      { author: "James P.", rating: 5, quote: "Booked online, in and out in 20 minutes, sharpest cut I've had in years." },
    ],
  },
  restaurant: {
    label: "Local Restaurant & Kitchen",
    primary: "Restaurant",
    pitch:
      "Fresh, seasonal dishes made from scratch with locally sourced ingredients, served in a warm and welcoming dining room. Book a table or order to collect.",
    services: [
      { name: "À La Carte Menu", description: "Seasonal plates cooked to order from the best local produce.", price: "Menu online", icon: "star" },
      { name: "Set Lunch", description: "Two or three courses at a great price, served weekday lunchtimes.", price: "From £14", icon: "sparkles" },
      { name: "Private Dining", description: "Celebrations, parties and corporate events catered for groups.", price: "Enquire", icon: "star" },
      { name: "Collection & Takeaway", description: "Your favourites freshly prepared to collect.", price: "Order online", icon: "leaf" },
    ],
    badges: ["Locally Sourced", "Vegan Options", "Table Booking"],
    testimonials: [
      { author: "Emma L.", rating: 5, quote: "Genuinely the best meal we've had locally. Every plate was beautiful and the service was lovely." },
      { author: "Tom H.", rating: 5, quote: "A hidden gem. Booked for an anniversary and they made it really special." },
    ],
  },
  electrician: {
    label: "Approved Domestic & Commercial Electrician",
    primary: "Electrician",
    pitch:
      "Fully qualified, NICEIC-approved electricians for everything from a single socket to a full rewire — safe, certified work with no mess left behind.",
    services: [
      { name: "Fault Finding & Repairs", description: "Tripping circuits and faults diagnosed and fixed fast.", price: "From £60", icon: "bolt" },
      { name: "Fuse Board Upgrades", description: "Modern consumer units installed and certified for safety.", price: "From £350", icon: "shield" },
      { name: "Rewiring", description: "Full or partial rewires with minimal disruption and full certification.", price: "Free quote", icon: "bolt" },
      { name: "EV Charger Installation", description: "Home and workplace EV charge points fitted by approved installers.", price: "From £800", icon: "sparkles" },
    ],
    badges: ["NICEIC Approved", "Part P Registered", "Fully Insured"],
    testimonials: [
      { author: "Rachel S.", rating: 5, quote: "Turned up on time, explained everything clearly and left the place spotless. Highly recommend." },
      { author: "Gary W.", rating: 5, quote: "Sorted a fault three others couldn't find. Fair price and proper certificate provided." },
    ],
    emergency: true,
  },
  cleaner: {
    label: "Professional Cleaning Services",
    primary: "Cleaner",
    pitch:
      "Reliable, fully insured cleaners for homes and businesses — regular cleans, one-off deep cleans and end-of-tenancy work, all to a checklist you can trust.",
    services: [
      { name: "Domestic Cleaning", description: "Regular weekly or fortnightly cleans by the same trusted cleaner.", price: "From £15/hr", icon: "sparkles" },
      { name: "Deep Cleaning", description: "Top-to-bottom one-off cleans that bring a property back to life.", price: "From £120", icon: "shield" },
      { name: "End of Tenancy", description: "Landlord-ready cleans with a bond-back guarantee.", price: "From £150", icon: "star" },
      { name: "Commercial Cleaning", description: "Offices and premises kept spotless on a schedule that suits you.", price: "Free quote", icon: "leaf" },
    ],
    badges: ["Fully Insured", "DBS-Checked Staff", "Satisfaction Guarantee"],
    testimonials: [
      { author: "Nicola B.", rating: 5, quote: "The house has never looked better. Trustworthy, thorough and always on time." },
      { author: "Paul D.", rating: 5, quote: "Use them for our office and the difference is night and day. Brilliant service." },
    ],
  },
  landscaper: {
    label: "Garden Design & Landscaping",
    primary: "Landscaper",
    pitch:
      "From regular garden maintenance to complete redesigns, patios and fencing, we create and care for outdoor spaces you'll love to spend time in.",
    services: [
      { name: "Garden Maintenance", description: "Mowing, hedges, borders and seasonal tidy-ups kept under control.", price: "From £30", icon: "leaf" },
      { name: "Patios & Paving", description: "Quality patios, paths and driveways built to last.", price: "Free quote", icon: "shield" },
      { name: "Fencing & Decking", description: "Sturdy fencing and decking supplied and installed.", price: "Free quote", icon: "wrench" },
      { name: "Garden Design", description: "Full design and planting schemes to transform your space.", price: "Enquire", icon: "sparkles" },
    ],
    badges: ["Free Quotes", "Waste Carrier Licensed", "Fully Insured"],
    testimonials: [
      { author: "Helen C.", rating: 5, quote: "Transformed an overgrown jungle into a garden we actually use. Tidy and professional." },
      { author: "Steve M.", rating: 5, quote: "New patio looks fantastic and was finished ahead of schedule. Top job." },
    ],
  },
  dentist: {
    label: "Family & Cosmetic Dental Practice",
    primary: "Dentist",
    pitch:
      "Gentle, modern dentistry for the whole family — from routine check-ups to cosmetic treatments — in a calm, welcoming practice with the latest technology.",
    services: [
      { name: "Routine Check-Ups", description: "Thorough exams and hygiene to keep your smile healthy.", price: "From £45", icon: "tooth" },
      { name: "Cosmetic Dentistry", description: "Whitening, veneers and smile makeovers tailored to you.", price: "Enquire", icon: "sparkles" },
      { name: "Dental Implants", description: "Permanent, natural-looking replacements for missing teeth.", price: "From £1,950", icon: "star" },
      { name: "Emergency Appointments", description: "Same-day care when you're in pain.", price: "From £65", icon: "shield" },
    ],
    badges: ["GDC Registered", "New Patients Welcome", "Finance Available"],
    testimonials: [
      { author: "Laura K.", rating: 5, quote: "Nervous patient and they couldn't have been more patient and gentle. Completely changed my view of the dentist." },
      { author: "Michael F.", rating: 5, quote: "Fantastic results from my whitening and the whole team is lovely. Highly recommend." },
    ],
  },
  mechanic: {
    label: "MOT, Servicing & Car Repairs",
    primary: "Mechanic",
    pitch:
      "Honest, independent garage offering MOTs, servicing and repairs on all makes — clear pricing, no jargon and no work done without your say-so.",
    services: [
      { name: "MOT Testing", description: "Class 4 MOTs with free retest and clear, honest advice.", price: "From £45", icon: "car" },
      { name: "Full & Interim Servicing", description: "Manufacturer-standard servicing that protects your warranty.", price: "From £99", icon: "shield" },
      { name: "Diagnostics & Repairs", description: "Engine, brakes and electronics diagnosed and fixed right.", price: "From £50", icon: "wrench" },
      { name: "Tyres & Brakes", description: "Competitively priced tyres and brakes fitted while you wait.", price: "Free quote", icon: "bolt" },
    ],
    badges: ["All Makes Welcome", "Free Retest", "12-Month Warranty"],
    testimonials: [
      { author: "Andrew P.", rating: 5, quote: "Finally a garage I trust. Talked me through everything and never overcharged. Won't go anywhere else." },
      { author: "Karen S.", rating: 5, quote: "Honest, quick and half the price the main dealer quoted. Brilliant." },
    ],
    emergency: true,
  },
  "beauty-salon": {
    label: "Beauty Salon & Aesthetics",
    primary: "Beauty Salon",
    pitch:
      "A relaxing, modern salon offering facials, nails, brows, lashes and advanced skincare from fully qualified therapists who put you at ease.",
    services: [
      { name: "Facials & Skincare", description: "Tailored treatments that leave skin glowing and refreshed.", price: "From £40", icon: "sparkles" },
      { name: "Manicure & Pedicure", description: "Flawless nails with gel, acrylic and classic finishes.", price: "From £25", icon: "star" },
      { name: "Brows & Lashes", description: "Tints, lifts, extensions and shaping for a polished look.", price: "From £20", icon: "sparkles" },
      { name: "Advanced Aesthetics", description: "Skin treatments delivered safely by trained practitioners.", price: "Consultation", icon: "shield" },
    ],
    badges: ["Fully Qualified", "Online Booking", "5-Star Rated"],
    testimonials: [
      { author: "Sophie A.", rating: 5, quote: "Always leave feeling amazing. The girls are so talented and the salon is gorgeous." },
      { author: "Chloe R.", rating: 5, quote: "Best facial I've ever had and my skin has never looked better. Booked my next three already." },
    ],
  },
  roofer: {
    label: "Roofing & Roof Repairs",
    primary: "Roofer",
    pitch:
      "From a slipped tile to a complete new roof, our experienced roofers deliver safe, weatherproof work backed by a guarantee and free, no-obligation quotes.",
    services: [
      { name: "Roof Repairs", description: "Leaks, slipped tiles and storm damage fixed fast.", price: "From £95", icon: "shield" },
      { name: "New Roofs & Re-Roofing", description: "Full roof replacements built to last with quality materials.", price: "Free quote", icon: "wrench" },
      { name: "Flat Roofing", description: "Durable, modern flat-roof systems with long guarantees.", price: "Free quote", icon: "star" },
      { name: "Gutters & Fascias", description: "Cleaning, repair and replacement to protect your home.", price: "From £60", icon: "wrench" },
    ],
    badges: ["Free Quotes", "Fully Insured", "Workmanship Guarantee"],
    testimonials: [
      { author: "Brian H.", rating: 5, quote: "Fixed a leak two others gave up on, fair price and cleaned up after themselves. First class." },
      { author: "Diane M.", rating: 5, quote: "New roof fitted in three days, no fuss, looks superb. Couldn't be happier." },
    ],
    emergency: true,
  },
  // Broad retail bucket — a credible independent-shop baseline. The AI Industry
  // Profiler replaces these with copy specific to the actual shop (e.g. a
  // collectables / trading-card store) when a key is configured.
  retail: {
    label: "Independent Local Shop",
    primary: "Shop",
    pitch:
      "A friendly independent shop with a hand-picked range, genuine expert advice and that personal service the big chains can't match. Pop in, browse, or order and collect.",
    services: [
      { name: "In-Store Browsing", description: "A carefully curated range to discover in person, with staff who know it inside out.", price: "Visit us", icon: "sparkles" },
      { name: "Expert Advice", description: "Honest, knowledgeable recommendations to help you find exactly what you're after.", price: "Free", icon: "star" },
      { name: "Order & Collect", description: "Reserve online or by phone and pick up in store when it suits you.", price: "Free", icon: "shield" },
      { name: "Gifts & Special Orders", description: "Gift ideas for every occasion, plus special orders for the hard-to-find.", price: "Enquire", icon: "leaf" },
    ],
    badges: ["Independent & Local", "Friendly Expert Staff", "Quality Guaranteed"],
    testimonials: [
      { author: "Hannah W.", rating: 5, quote: "Lovely shop with a brilliant selection and staff who really know their stuff. My go-to now." },
      { author: "Daniel O.", rating: 5, quote: "Found exactly what I wanted and got proper advice, not a hard sell. Highly recommend." },
    ],
  },
  // Last-resort neutral bucket for an unclassified business — honest and generic,
  // never a wrong trade. The profiler tailors it when AI is available.
  other: {
    label: "Local Business",
    primary: "Service",
    pitch:
      "A trusted local business built on doing right by its customers — friendly service, fair prices and real care in everything we do.",
    services: [
      { name: "What We Offer", description: "A full range of services tailored to what you need, done properly.", price: "Enquire", icon: "star" },
      { name: "Friendly Advice", description: "Talk to a real local person who'll point you in the right direction.", price: "Free", icon: "sparkles" },
      { name: "Quality You Can Trust", description: "Dependable work and a focus on getting the details right.", price: "Free quote", icon: "shield" },
    ],
    badges: ["Locally Owned", "Trusted & Reliable", "Customer-First"],
    testimonials: [
      { author: "Claire B.", rating: 5, quote: "Genuinely friendly, professional and great value. Couldn't ask for more." },
      { author: "Mark E.", rating: 5, quote: "First-class service from start to finish. Would happily recommend to anyone local." },
    ],
  },
};

/** A URL-safe slug from a business name (deduplicated by the prospect id tail). */
function slugifyName(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "demo"}-${suffix}`;
}

/**
 * Scaffold a complete, credible Business from a prospect. Pure + deterministic:
 * per-category templates personalised with the prospect's name + town. The demo
 * is honest baseline content (clearly a draft for a sales conversation), never
 * empty placeholder — and rich enough to clear the QA gate.
 */
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function draftBusinessFromProspect(prospect: Prospect): Business {
  const t = CATEGORY_DRAFT[prospect.category] ?? CATEGORY_DRAFT.other;
  const city = prospect.city?.trim() || "your area";
  const idTail = prospect.id.slice(0, 8);

  // For broad buckets (retail/other), lead with the real industry text so the
  // copy reads correctly ("Trading Cards in Warrington", not "Local Business").
  const rawIndustry = prospect.source?.industry?.trim();
  const broad = prospect.category === "retail" || prospect.category === "other";
  const label = broad && rawIndustry ? titleCase(rawIndustry) : t.label;
  const primary = broad && rawIndustry ? titleCase(rawIndustry) : t.primary;

  const about = `${prospect.name} is a trusted ${primary.toLowerCase()} serving ${city} and the surrounding area. ${t.pitch} We're proud to be a local business that treats every customer the way we'd want to be treated.`;

  // DATA INTEGRITY ("never fake"). Facts come ONLY from the prospect record
  // (discovery/manual). Anything we can't verify is left empty — the render shows
  // a clearly-labelled placeholder and the admin flags it for human verification,
  // rather than inventing a phone number, email, rating or testimonials. Marketing
  // copy (services/about/badges) is a per-category template the operator edits —
  // that's a draft, not a false factual claim, so it's allowed.
  const phone = prospect.phone?.trim() || "";
  const email = prospect.email?.trim() || "";
  const townKnown = Boolean(prospect.city?.trim());

  return {
    slug: slugifyName(prospect.name, idTail),
    name: prospect.name,
    category: prospect.category,
    categoryLabel: label,
    primaryService: primary,
    industryLabel: rawIndustry || undefined,
    tagline: `${primary} in ${city}, done properly and priced fairly.`,
    about,
    phone,
    email,
    address: { line1: "", city: prospect.city?.trim() || "", postcode: "" },
    serviceAreas: townKnown ? [prospect.city!.trim()] : [],
    services: t.services,
    openingHours: STANDARD_HOURS,
    // Never fabricate social proof: no invented testimonials, no aggregate rating.
    testimonials: [],
    // rating intentionally omitted (no real reviews) — see Business.rating.
    badges: t.badges,
    verification: {
      phone: phone ? "verified" : "missing",
      email: email ? "verified" : "missing",
      address: townKnown ? "template" : "missing",
      rating: "missing",
      testimonials: "missing",
    },
    enableBooking: true,
    // Baseline FAQs (genuinely useful, not a duplicate of Services). The AI
    // Industry Profiler replaces these with tailored ones + adds highlights/menu.
    faqs: [
      { question: `Do you cover ${city}?`, answer: `Yes — we serve ${city} and the surrounding area. Get in touch and we'll confirm we can help.` },
      { question: "How do I get a quote?", answer: "Call us or send an enquiry through the website and we'll come back to you quickly with a free, no-obligation quote." },
      { question: "What are your opening hours?", answer: "Our hours are listed above — and we'll always do our best to fit around you." },
    ],
  };
}

// ===========================================================================
// Token generation.
// ===========================================================================

/** An opaque, unguessable URL-safe token — the capability to view a preview. */
export function generatePreviewToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Default preview lifetime: 30 days from creation. */
export function defaultPreviewExpiry(from: Date = new Date()): string {
  return new Date(from.getTime() + 30 * 86_400_000).toISOString();
}

// ===========================================================================
// DATA LAYER (service role — org-scoped at the app layer).
// ===========================================================================

interface SitePreviewRow {
  id: string;
  org_id: string;
  prospect_id: string;
  business_draft: Business;
  design_dna: DesignDNA;
  qa_score: number;
  qa_report: unknown;
  preview_token: string;
  status: SitePreviewStatus;
  views: number;
  last_viewed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// NOTE: `password` (migration 0010) is intentionally NOT in this shared select —
// it's read in isolation by `getPreviewGate` so the board/portal keep working even
// before 0010 is applied. See lib/preview-analytics.ts for events (also best-effort).
const PREVIEW_COLS =
  "select=id,org_id,prospect_id,business_draft,design_dna,qa_score,qa_report,preview_token,status,views,last_viewed_at,expires_at,created_at,updated_at";

function toSitePreview(row: SitePreviewRow): SitePreview {
  return {
    id: row.id,
    orgId: row.org_id,
    prospectId: row.prospect_id,
    businessDraft: row.business_draft,
    designDna: row.design_dna,
    qaScore: row.qa_score,
    qaReport: row.qa_report,
    token: row.preview_token,
    status: row.status,
    views: row.views,
    lastViewedAt: row.last_viewed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateSitePreviewInput {
  orgId: string;
  prospectId: string;
  businessDraft: Business;
  designDna: DesignDNA;
  qaScore: number;
  qaReport?: unknown;
  token: string;
  expiresAt?: string | null;
}

export async function createSitePreview(input: CreateSitePreviewInput): Promise<SitePreview> {
  const row = await sbInsert<SitePreviewRow>("site_previews", {
    org_id: input.orgId,
    prospect_id: input.prospectId,
    business_draft: input.businessDraft,
    design_dna: input.designDna,
    qa_score: input.qaScore,
    qa_report: input.qaReport ?? null,
    preview_token: input.token,
    status: "active",
    expires_at: input.expiresAt ?? null,
  });
  revalidatePath("/admin/prospects");
  return toSitePreview(row);
}

/** Latest preview per prospect, for the whole org (for the CRM board). */
export async function getPreviewsForOrg(orgId: string): Promise<SitePreview[]> {
  const rows = await sbSelect<SitePreviewRow>({
    query: `site_previews?${PREVIEW_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toSitePreview);
}

export async function getPreviewRecord(id: string): Promise<SitePreview | null> {
  const rows = await sbSelect<SitePreviewRow>({
    query: `site_previews?${PREVIEW_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toSitePreview(rows[0]) : null;
}

/**
 * Public, capability-by-token read for /preview/[token]. Service role (the token
 * IS the authorization); returns null unless the preview is active and unexpired.
 */
export async function getActivePreviewByToken(token: string): Promise<SitePreview | null> {
  if (!token) return null;
  // Public route: degrade to "not found" (not a 500) when Supabase isn't
  // configured or the read fails — the token is unverifiable, so there's no demo.
  let preview: SitePreview | null = null;
  try {
    const rows = await sbSelect<SitePreviewRow>({
      query: `site_previews?${PREVIEW_COLS}&preview_token=eq.${encodeURIComponent(token)}&status=eq.active&limit=1`,
      tier: "service",
    });
    preview = rows[0] ? toSitePreview(rows[0]) : null;
  } catch {
    return null;
  }
  if (!preview) return null;
  if (preview.expiresAt && new Date(preview.expiresAt).getTime() < Date.now()) return null;
  return preview;
}

/** Best-effort open counter (never throws — a view tally must not break a demo). */
export async function recordPreviewView(id: string, currentViews: number): Promise<void> {
  try {
    await sbUpdate("site_previews", `id=eq.${encodeURIComponent(id)}`, {
      views: currentViews + 1,
      last_viewed_at: new Date().toISOString(),
    });
  } catch {
    /* ignore — the demo renders regardless */
  }
}

/**
 * Set or clear a demo's private-share password (migration 0010). Pass null/"" to
 * remove the gate. Throws if the column isn't migrated yet — the caller surfaces it.
 */
export async function setPreviewPassword(id: string, password: string | null): Promise<void> {
  await sbUpdate("site_previews", `id=eq.${encodeURIComponent(id)}`, {
    password: password && password.trim() ? password.trim() : null,
  });
  revalidatePath("/admin/prospects");
}

export async function revokeSitePreview(id: string): Promise<void> {
  await sbUpdate("site_previews", `id=eq.${encodeURIComponent(id)}`, { status: "revoked" });
  revalidatePath("/admin/prospects");
}

export async function deleteSitePreview(id: string): Promise<void> {
  await sbDelete("site_previews", `id=eq.${encodeURIComponent(id)}`);
  revalidatePath("/admin/prospects");
}
