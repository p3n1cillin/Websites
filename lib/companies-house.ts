/**
 * UK Companies House enrichment (free public API, optional).
 *
 * Adds AUTHORITATIVE company facts to a prospect: registered legal name, registered-
 * office address, incorporation date (→ established year), status and SIC codes
 * (industry). It does NOT hold email/phone — contact details come from the website
 * scrape (lib/audit). Sole traders / partnerships aren't registered here, so this
 * enriches limited companies only.
 *
 * Zero runtime deps (fetch + Basic auth). Inert without COMPANIES_HOUSE_API_KEY and
 * never throws — degrades to null so callers carry on. Only ever returns verified
 * data; never fabricates.
 */

const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;
const BASE = "https://api.company-information.service.gov.uk";
const TIMEOUT_MS = 8_000;

export const companiesHouseConfigured = Boolean(API_KEY);

export interface CompanyRecord {
  companyNumber: string;
  legalName: string;
  status: string; // "active", "dissolved", ...
  established?: number; // year from date_of_creation
  address?: { line1: string; city: string; postcode: string };
  sicCodes?: string[];
}

interface SearchResp {
  items?: Array<{
    title?: string;
    company_number?: string;
    company_status?: string;
    address_snippet?: string;
  }>;
}
interface ProfileResp {
  company_name?: string;
  company_number?: string;
  company_status?: string;
  date_of_creation?: string;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
  };
  sic_codes?: string[];
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${API_KEY}:`).toString("base64")}`;
}

async function chFetch<T>(path: string): Promise<T | null> {
  if (!API_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: authHeader(), Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Normalise a business name for matching (drop suffixes/punctuation/case). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(ltd|limited|llp|plc|the|co|company)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Look up a company by name (city helps disambiguate). Returns the best ACTIVE
 * match whose name plausibly matches, with structured profile data — or null.
 */
export async function lookupCompany(name: string, city?: string): Promise<CompanyRecord | null> {
  if (!API_KEY || !name.trim()) return null;
  const q = encodeURIComponent(city ? `${name} ${city}` : name);
  const search = await chFetch<SearchResp>(`/search/companies?q=${q}&items_per_page=5`);
  const items = search?.items ?? [];
  if (items.length === 0) return null;

  const want = norm(name);
  const cityLc = city?.toLowerCase().trim();
  // Prefer an active company whose name matches and (if known) whose address mentions the city.
  const ranked = items
    .filter((it) => it.company_number && it.title)
    .map((it) => {
      const t = norm(it.title!);
      const nameMatch = t === want || t.includes(want) || want.includes(t);
      const cityMatch = cityLc ? (it.address_snippet ?? "").toLowerCase().includes(cityLc) : false;
      const active = it.company_status === "active";
      const score = (nameMatch ? 2 : 0) + (active ? 1 : 0) + (cityMatch ? 1 : 0);
      return { it, nameMatch, score };
    })
    .filter((r) => r.nameMatch)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.it;
  if (!best?.company_number) return null;

  const profile = await chFetch<ProfileResp>(`/company/${encodeURIComponent(best.company_number)}`);
  if (!profile) {
    return {
      companyNumber: best.company_number,
      legalName: best.title!.trim(),
      status: best.company_status ?? "unknown",
    };
  }

  const roa = profile.registered_office_address;
  const year = profile.date_of_creation ? Number(profile.date_of_creation.slice(0, 4)) : undefined;
  const address =
    roa?.locality && roa?.postal_code
      ? {
          line1: [roa.address_line_1, roa.address_line_2].filter(Boolean).join(", "),
          city: roa.locality,
          postcode: roa.postal_code,
        }
      : undefined;

  return {
    companyNumber: profile.company_number ?? best.company_number,
    legalName: (profile.company_name ?? best.title!).trim(),
    status: profile.company_status ?? best.company_status ?? "unknown",
    established: year && year > 1800 ? year : undefined,
    address,
    sicCodes: profile.sic_codes,
  };
}
