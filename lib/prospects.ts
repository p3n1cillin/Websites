import { revalidatePath } from "next/cache";
import {
  BUSINESS_CATEGORIES,
  type BusinessCategory,
  type Prospect,
  type ProspectAnalysis,
  type ProspectSource,
  type ProspectStatus,
} from "./types";
import { sbSelect, sbInsert, sbUpdate, sbDelete } from "./supabase/client";

/**
 * Prospect data layer + pure scoring helpers (Agency OS acquisition side).
 *
 * Prospects are outbound discovery targets. Inserts/updates are service-role
 * (the Discovery/Market agents and the admin CRM), and every row is org-scoped.
 * The scoring + category-normalisation helpers are deterministic and dependency-
 * free so they run identically with no AI key (the agents add the narrative).
 */

// ===========================================================================
// PURE HELPERS — scoring + normalisation (no I/O, no AI).
// ===========================================================================

/** Free-text → a known BusinessCategory. Keyword match, falls back sensibly. */
const CATEGORY_KEYWORDS: Record<string, BusinessCategory> = {
  plumb: "plumber",
  heating: "plumber",
  boiler: "plumber",
  gas: "plumber",
  barber: "barber",
  "hair": "barber",
  restaurant: "restaurant",
  cafe: "restaurant",
  bistro: "restaurant",
  takeaway: "restaurant",
  electric: "electrician",
  electrical: "electrician",
  clean: "cleaner",
  landscap: "landscaper",
  garden: "landscaper",
  "tree ": "landscaper",
  dental: "dentist",
  dentist: "dentist",
  orthodont: "dentist",
  mechanic: "mechanic",
  garage: "mechanic",
  "mot ": "mechanic",
  motor: "mechanic",
  beauty: "beauty-salon",
  salon: "beauty-salon",
  nails: "beauty-salon",
  spa: "beauty-salon",
  aesthetic: "beauty-salon",
  roof: "roofer",
  // Retail / shop signals → the broad retail bucket (the AI profiler refines copy).
  shop: "retail",
  store: "retail",
  retail: "retail",
  boutique: "retail",
  collectab: "retail",
  "card": "retail",
  gift: "retail",
  jewell: "retail",
  florist: "retail",
  grocer: "retail",
};

/**
 * Free-text → the closest design bucket. Returns a real match (exact or keyword)
 * or null when nothing matches — callers decide the fallback. The Industry
 * Profiler uses this to tell "known trade" from "needs an AI-generated profile".
 */
export function matchKnownCategory(text?: string | null): BusinessCategory | null {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return null;
  const exact = BUSINESS_CATEGORIES.find((c) => c === t || c.replace("-", " ") === t);
  if (exact) return exact;
  for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    if (t.includes(kw.trim())) return cat;
  }
  return null;
}

/**
 * Free-text → a design bucket, never failing. Crucially it NO LONGER defaults to
 * "plumber" — an unrecognised industry maps to "other" (a neutral bucket), so the
 * system never fabricates a plumber site for, say, a collectables shop. The true
 * industry is preserved in ProspectSource.industry / Business.industryLabel.
 */
export function normalizeCategory(text?: string | null): BusinessCategory {
  return matchKnownCategory(text) ?? "other";
}

/**
 * Estimated first-year value to the agency, in pence, by category — a rough
 * blend of build fee + ongoing subscription a business of that type supports.
 */
const CATEGORY_ANNUAL_VALUE_PENCE: Record<BusinessCategory, number> = {
  dentist: 180_000,
  roofer: 144_000,
  plumber: 120_000,
  electrician: 120_000,
  mechanic: 108_000,
  landscaper: 108_000,
  "beauty-salon": 96_000,
  restaurant: 96_000,
  cleaner: 84_000,
  barber: 72_000,
  retail: 96_000,
  other: 84_000,
};
const MAX_VALUE_PENCE = 180_000;

export interface ProspectScores {
  presenceScore: number;
  opportunityScore: number;
  valueEstimate: number;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/**
 * Deterministic opportunity scoring from the attributes we know at discovery.
 *
 * Presence is a heuristic from whether a site URL is on file — a known site
 * means *some* presence (less opportunity); no site is the strongest signal of
 * an under-served business. (Deep crawl-based presence assessment is a later
 * enhancement; the Market agent refines the narrative, not the crawl.)
 */
export function scoreProspect(input: {
  category: BusinessCategory;
  websiteUrl?: string | null;
  /**
   * Real presence (0–100) from a website audit. When provided it replaces the
   * crude has-site-or-not heuristic — a polished existing site scores high (less
   * opportunity); a broken or absent one scores low (big opportunity).
   */
  presenceScore?: number;
}): ProspectScores {
  const valueEstimate = CATEGORY_ANNUAL_VALUE_PENCE[input.category] ?? 96_000;
  const valueIndex = (valueEstimate / MAX_VALUE_PENCE) * 100;
  const presenceScore =
    input.presenceScore ?? (input.websiteUrl?.trim() ? 60 : 15);
  // High opportunity = weak presence + high value.
  const opportunityScore = clamp((100 - presenceScore) * 0.6 + valueIndex * 0.4);
  return { presenceScore: clamp(presenceScore), opportunityScore, valueEstimate };
}

// ===========================================================================
// DATA LAYER (service role — org-scoped at the app layer).
// ===========================================================================

interface ProspectRow {
  id: string;
  org_id: string;
  name: string;
  category: string;
  city: string;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  presence_score: number;
  opportunity_score: number;
  value_estimate: number;
  status: ProspectStatus;
  source: ProspectSource | null;
  analysis: ProspectAnalysis | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS =
  "select=id,org_id,name,category,city,phone,email,website_url,presence_score,opportunity_score,value_estimate,status,source,analysis,created_at,updated_at";

function toProspect(row: ProspectRow): Prospect {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    category: normalizeCategory(row.category),
    city: row.city,
    phone: row.phone,
    email: row.email,
    websiteUrl: row.website_url,
    presenceScore: row.presence_score,
    opportunityScore: row.opportunity_score,
    valueEstimate: row.value_estimate,
    status: row.status,
    source: row.source,
    analysis: row.analysis,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateProspectInput {
  orgId: string;
  name: string;
  category: BusinessCategory;
  city?: string;
  phone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  status?: ProspectStatus;
  source?: ProspectSource | null;
  presenceScore?: number;
  opportunityScore?: number;
  valueEstimate?: number;
}

function rowFromInput(input: CreateProspectInput): Record<string, unknown> {
  const scores = scoreProspect({ category: input.category, websiteUrl: input.websiteUrl });
  return {
    org_id: input.orgId,
    name: input.name,
    category: input.category,
    city: input.city ?? "",
    phone: input.phone ?? null,
    email: input.email ?? null,
    website_url: input.websiteUrl ?? null,
    presence_score: input.presenceScore ?? scores.presenceScore,
    opportunity_score: input.opportunityScore ?? scores.opportunityScore,
    value_estimate: input.valueEstimate ?? scores.valueEstimate,
    status: input.status ?? "discovered",
    source: input.source ?? { origin: "manual" },
  };
}

export async function createProspect(input: CreateProspectInput): Promise<Prospect> {
  const row = await sbInsert<ProspectRow>("prospects", rowFromInput(input));
  return toProspect(row);
}

/**
 * Insert many, skipping duplicates (same org + name + city). Returns only the rows
 * actually created. Used by Discovery so re-running a brief is idempotent.
 *
 * SCALABILITY: this no longer loads the org's entire prospect table to dedup (that
 * was O(all prospects) per run and broke at scale). Instead it dedups WITHIN the
 * incoming batch (bounded) and leans on the `prospects_org_name_city_uniq` index
 * to reject anything already stored — a failed insert is simply counted as skipped.
 * Cost is therefore O(batch), independent of how many millions are already on file.
 */
export async function createProspects(
  inputs: CreateProspectInput[]
): Promise<{ created: Prospect[]; skipped: number }> {
  if (inputs.length === 0) return { created: [], skipped: 0 };
  const batchSeen = new Set<string>();
  const created: Prospect[] = [];
  let skipped = 0;
  for (const input of inputs) {
    const key = `${input.name.toLowerCase()}|${(input.city ?? "").toLowerCase()}`;
    if (batchSeen.has(key)) {
      skipped += 1; // duplicate within this batch
      continue;
    }
    batchSeen.add(key);
    try {
      created.push(await createProspect(input));
    } catch {
      // The unique index rejected an already-stored (org, name, city) — idempotent
      // re-run. Count as skipped and keep going. (No table-wide read needed.)
      skipped += 1;
    }
  }
  return { created, skipped };
}

export async function getProspectsForOrg(orgId: string): Promise<Prospect[]> {
  const rows = await sbSelect<ProspectRow>({
    query: `prospects?${SELECT_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=opportunity_score.desc,created_at.desc`,
    tier: "service",
  });
  return rows.map(toProspect);
}

export async function getProspectRecord(id: string): Promise<Prospect | null> {
  const rows = await sbSelect<ProspectRow>({
    query: `prospects?${SELECT_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toProspect(rows[0]) : null;
}

export async function updateProspectStatus(id: string, status: ProspectStatus): Promise<Prospect> {
  const [row] = await sbUpdate<ProspectRow>("prospects", `id=eq.${encodeURIComponent(id)}`, {
    status,
  });
  if (!row) throw new Error(`Prospect ${id} not found.`);
  revalidatePath("/admin/prospects");
  return toProspect(row);
}

/** Persist the Market agent's verdict + refreshed scores onto a prospect. */
export async function updateProspectAnalysis(
  id: string,
  patch: {
    analysis: ProspectAnalysis;
    presenceScore?: number;
    opportunityScore?: number;
    valueEstimate?: number;
    status?: ProspectStatus;
  }
): Promise<Prospect> {
  const fields: Record<string, unknown> = { analysis: patch.analysis };
  if (patch.presenceScore !== undefined) fields.presence_score = patch.presenceScore;
  if (patch.opportunityScore !== undefined) fields.opportunity_score = patch.opportunityScore;
  if (patch.valueEstimate !== undefined) fields.value_estimate = patch.valueEstimate;
  if (patch.status !== undefined) fields.status = patch.status;
  const [row] = await sbUpdate<ProspectRow>(
    "prospects",
    `id=eq.${encodeURIComponent(id)}`,
    fields
  );
  if (!row) throw new Error(`Prospect ${id} not found.`);
  revalidatePath("/admin/prospects");
  return toProspect(row);
}

export async function deleteProspect(id: string): Promise<void> {
  await sbDelete("prospects", `id=eq.${encodeURIComponent(id)}`);
  revalidatePath("/admin/prospects");
}
