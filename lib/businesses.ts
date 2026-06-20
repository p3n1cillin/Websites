import { revalidateTag } from "next/cache";
import type { Business, BusinessRecord, BusinessStatus } from "./types";
import { LOCAL_BUSINESSES } from "./data";
import { CATALOGUE_TAG, tenantTag } from "./cache-tags";
import {
  sbSelect,
  sbInsert,
  sbUpdate,
  sbDelete,
  supabaseConfigured,
  supabaseWritable,
} from "./supabase/client";

/**
 * Data-access layer.
 *
 * Reads:  default to the bundled local registry (lib/data) so the project runs
 *         with zero configuration. When Supabase is configured, *published*
 *         businesses are loaded from the `businesses` table via PostgREST.
 * Writes: require the service role key (admin actions / webhooks). Every write
 *         calls `revalidateTag(...)` so the affected live site refreshes on
 *         demand — replacing the old time-based `revalidate: 3600`.
 *
 * Every page imports from here, so the source can scale from 3 local businesses
 * to 100+ tenants without touching any component or route.
 */

// ---------------------------------------------------------------------------
// Row shape returned by PostgREST (snake_case columns).
// ---------------------------------------------------------------------------
interface BusinessRow {
  id: string;
  org_id: string;
  slug: string;
  city: string;
  category: Business["category"];
  status: BusinessStatus;
  custom_domain: string | null;
  data: Business;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLS =
  "select=id,org_id,slug,city,category,status,custom_domain,data,published_at,created_at,updated_at";

function toRecord(row: BusinessRow): BusinessRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    slug: row.slug,
    city: row.city,
    category: row.category,
    status: row.status,
    customDomain: row.custom_domain,
    data: row.data,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Local data has no DB columns — treat each bundled business as published. */
function localRecord(b: Business): BusinessRecord {
  return {
    id: `local:${b.slug}`,
    orgId: "local",
    slug: b.slug,
    city: b.address.city,
    category: b.category,
    status: "published",
    customDomain: null,
    data: b,
  };
}

// ===========================================================================
// READS  (public — anon key, RLS-limited to published)
// ===========================================================================

/** Load every published tenant. Tagged for on-demand revalidation. */
async function loadAllRecords(): Promise<BusinessRecord[]> {
  if (supabaseConfigured) {
    try {
      const rows = await sbSelect<BusinessRow>({
        query: `businesses?${SELECT_COLS}&status=eq.published`,
        tags: [CATALOGUE_TAG],
      });
      if (rows.length > 0) return rows.map(toRecord);
    } catch (err) {
      console.warn("[businesses] Supabase load failed, using local data:", err);
    }
  }
  return LOCAL_BUSINESSES.map(localRecord);
}

async function loadAll(): Promise<Business[]> {
  return (await loadAllRecords()).map((r) => r.data);
}

export async function getAllBusinesses(): Promise<Business[]> {
  const all = await loadAll();
  return [...all].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllSlugs(): Promise<string[]> {
  return (await loadAllRecords()).map((r) => r.slug);
}

export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  if (supabaseConfigured) {
    try {
      const rows = await sbSelect<BusinessRow>({
        query: `businesses?${SELECT_COLS}&status=eq.published&slug=eq.${encodeURIComponent(
          slug
        )}&limit=1`,
        tags: [CATALOGUE_TAG, tenantTag(slug)],
      });
      if (rows.length > 0) return rows[0].data;
      // Fall through to local data if the slug isn't in Supabase.
    } catch (err) {
      console.warn(`[businesses] Supabase lookup failed for "${slug}":`, err);
    }
  }
  return LOCAL_BUSINESSES.find((b) => b.slug === slug) ?? null;
}

/**
 * Minimal published-business reference by slug, including the DB `id`.
 * Used by the enquiry endpoint to attach a lead to the right tenant.
 * Returns null when Supabase isn't configured (no persistable id exists).
 */
export async function getBusinessRefBySlug(
  slug: string
): Promise<{ id: string; name: string; email: string } | null> {
  if (!supabaseConfigured) return null;
  try {
    const rows = await sbSelect<Pick<BusinessRow, "id" | "data">>({
      query: `businesses?select=id,data&status=eq.published&slug=eq.${encodeURIComponent(
        slug
      )}&limit=1`,
      tags: [tenantTag(slug)],
    });
    if (!rows[0]) return null;
    return { id: rows[0].id, name: rows[0].data.name, email: rows[0].data.email };
  } catch (err) {
    console.warn(`[businesses] ref lookup failed for "${slug}":`, err);
    return null;
  }
}

export async function getRelatedBusinesses(
  slug: string,
  limit = 3
): Promise<Business[]> {
  const all = await loadAll();
  const current = all.find((b) => b.slug === slug);
  if (!current) return [];
  const sameCategory = all.filter(
    (b) => b.slug !== slug && b.category === current.category
  );
  const others = all.filter(
    (b) => b.slug !== slug && b.category !== current.category
  );
  return [...sameCategory, ...others].slice(0, limit);
}

// ===========================================================================
// ADMIN READS  (service role — includes drafts; scoped by org at the app layer)
// ===========================================================================

/** Every business for one org, including drafts. For the admin dashboard. */
export async function getBusinessesForOrg(orgId: string): Promise<BusinessRecord[]> {
  const rows = await sbSelect<BusinessRow>({
    query: `businesses?${SELECT_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=updated_at.desc`,
    tier: "service",
  });
  return rows.map(toRecord);
}

/**
 * Every published business across all orgs, with real DB ids. Service-role read
 * for infrastructure jobs (the SEO-automation cron) that act on all tenants and
 * need the persistable id, not the anon/local fallback view.
 */
export async function getAllPublishedRecords(): Promise<BusinessRecord[]> {
  if (!supabaseWritable) return [];
  const rows = await sbSelect<BusinessRow>({
    query: `businesses?${SELECT_COLS}&status=eq.published`,
    tier: "service",
  });
  return rows.map(toRecord);
}

/** A single record by id, including drafts. For the admin editor. */
export async function getBusinessRecord(id: string): Promise<BusinessRecord | null> {
  const rows = await sbSelect<BusinessRow>({
    query: `businesses?${SELECT_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toRecord(rows[0]) : null;
}

// ===========================================================================
// WRITES  (service role required; each revalidates the affected pages)
// ===========================================================================

interface CreateBusinessInput {
  orgId: string;
  data: Business;
  status?: BusinessStatus;
  city?: string;
  customDomain?: string | null;
}

function assertWritable(): void {
  if (!supabaseWritable) {
    throw new Error(
      "Writes require SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL). " +
        "Set them to enable the admin/data write path."
    );
  }
}

/** Refresh the catalogue and (optionally) a single tenant's pages. */
function revalidateBusiness(slug?: string): void {
  revalidateTag(CATALOGUE_TAG);
  if (slug) revalidateTag(tenantTag(slug));
}

export async function createBusiness(
  input: CreateBusinessInput
): Promise<BusinessRecord> {
  assertWritable();
  const status = input.status ?? "draft";
  const row = await sbInsert<BusinessRow>("businesses", {
    org_id: input.orgId,
    slug: input.data.slug,
    city: input.city ?? input.data.address.city,
    category: input.data.category,
    status,
    custom_domain: input.customDomain ?? null,
    data: input.data,
    published_at: status === "published" ? new Date().toISOString() : null,
  });
  if (status === "published") revalidateBusiness(row.slug);
  return toRecord(row);
}

/** Update a business's content/branding. Revalidates if it's published. */
export async function updateBusiness(
  id: string,
  data: Business
): Promise<BusinessRecord> {
  assertWritable();
  const [row] = await sbUpdate<BusinessRow>("businesses", `id=eq.${encodeURIComponent(id)}`, {
    slug: data.slug,
    city: data.address.city,
    category: data.category,
    data,
  });
  if (!row) throw new Error(`Business ${id} not found.`);
  if (row.status === "published") revalidateBusiness(row.slug);
  return toRecord(row);
}

/**
 * Persist a chosen Design DNA onto a business (embedded in `data.design`). The
 * Website Factory calls this via the `design` agent. Revalidates the live site if
 * published so the new look ships immediately.
 */
export async function updateBusinessDesign(
  id: string,
  design: import("./design/types").DesignDNA
): Promise<BusinessRecord> {
  assertWritable();
  const existing = await getBusinessRecord(id);
  if (!existing) throw new Error(`Business ${id} not found.`);
  const data: Business = { ...existing.data, design };
  const [row] = await sbUpdate<BusinessRow>("businesses", `id=eq.${encodeURIComponent(id)}`, {
    data,
  });
  if (!row) throw new Error(`Business ${id} not found.`);
  if (row.status === "published") revalidateBusiness(row.slug);
  return toRecord(row);
}

/** Publish or unpublish; both transitions affect what the public can see. */
export async function setBusinessStatus(
  id: string,
  status: BusinessStatus
): Promise<BusinessRecord> {
  assertWritable();
  const [row] = await sbUpdate<BusinessRow>("businesses", `id=eq.${encodeURIComponent(id)}`, {
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
  });
  if (!row) throw new Error(`Business ${id} not found.`);
  revalidateBusiness(row.slug);
  return toRecord(row);
}

/**
 * Set (or clear, with null) a business's custom domain. Service-role write —
 * the caller must have already confirmed ownership and plan entitlement. The DB
 * enforces global uniqueness on `custom_domain`.
 */
export async function setCustomDomain(
  id: string,
  domain: string | null
): Promise<BusinessRecord> {
  assertWritable();
  const [row] = await sbUpdate<BusinessRow>(
    "businesses",
    `id=eq.${encodeURIComponent(id)}`,
    { custom_domain: domain }
  );
  if (!row) throw new Error(`Business ${id} not found.`);
  if (row.status === "published") revalidateBusiness(row.slug);
  return toRecord(row);
}

export async function deleteBusiness(id: string): Promise<void> {
  assertWritable();
  // Fetch the slug first so we can revalidate the now-removed pages.
  const record = await getBusinessRecord(id);
  await sbDelete("businesses", `id=eq.${encodeURIComponent(id)}`);
  revalidateBusiness(record?.slug);
}
