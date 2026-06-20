import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { Proposal, ProposalStatus, Prospect } from "./types";
import { sbSelect, sbInsert, sbUpdate } from "./supabase/client";

/**
 * Proposal data layer + a deterministic draft builder (Agency OS — Agent 8++).
 *
 * A proposal is the closing asset: scope, price and timeline a prospect views at
 * /proposal/[token] and can accept. The draft is built deterministically from what
 * we already know (the opportunity analysis + the per-category value estimate), so
 * it needs no AI and is a sensible starting point the operator can edit. Public read
 * is server-side by opaque token, like previews/portals.
 */

export function generateProposalToken(): string {
  return randomBytes(24).toString("base64url");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export interface ProposalDraft {
  title: string;
  summary: string;
  deliverables: string[];
  pricePence: number;
  priceNote: string;
  timeline: string;
}

/** Build a proposal draft from a prospect's known attributes + opportunity. */
export function buildProposalDraft(prospect: Prospect): ProposalDraft {
  const industry = prospect.source?.industry?.trim() || prospect.category;
  const city = prospect.city?.trim() || "your area";
  // Build fee scaled off the per-category first-year value estimate, in a sane band.
  const pricePence = clamp(Math.round(prospect.valueEstimate * 0.4), 39900, 99900);

  const summary =
    prospect.analysis?.angle?.trim() ||
    `A fast, modern, conversion-focused website that wins ${prospect.name} more local customers in ${city}.`;

  return {
    title: `Website proposal for ${prospect.name}`,
    summary,
    deliverables: [
      `A bespoke, mobile-first ${industry} website designed around your customers`,
      "Local SEO setup so you're found on Google in your area",
      "Lead capture — enquiry & quote forms wired to your inbox",
      "Click-to-call, opening hours and Google Maps built in",
      "Fast, secure hosting with ongoing updates & support",
    ],
    pricePence,
    priceNote: "+ £39/month for hosting, updates & support (cancel anytime)",
    timeline: "Your new site live within 2 weeks of go-ahead.",
  };
}

// ---------------------------------------------------------------------------
// Data layer (service role — org-scoped at the app layer).
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  org_id: string;
  prospect_id: string;
  token: string;
  title: string;
  summary: string;
  deliverables: string[];
  price_pence: number;
  price_note: string | null;
  timeline: string | null;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
}

const COLS =
  "select=id,org_id,prospect_id,token,title,summary,deliverables,price_pence,price_note,timeline,status,created_at,updated_at";

function toProposal(row: Row): Proposal {
  return {
    id: row.id,
    orgId: row.org_id,
    prospectId: row.prospect_id,
    token: row.token,
    title: row.title,
    summary: row.summary,
    deliverables: Array.isArray(row.deliverables) ? row.deliverables : [],
    pricePence: row.price_pence,
    priceNote: row.price_note,
    timeline: row.timeline,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createProposal(input: {
  orgId: string;
  prospectId: string;
  draft: ProposalDraft;
}): Promise<Proposal> {
  const row = await sbInsert<Row>("proposals", {
    org_id: input.orgId,
    prospect_id: input.prospectId,
    token: generateProposalToken(),
    title: input.draft.title,
    summary: input.draft.summary,
    deliverables: input.draft.deliverables,
    price_pence: input.draft.pricePence,
    price_note: input.draft.priceNote,
    timeline: input.draft.timeline,
    status: "sent",
  });
  revalidatePath("/admin/prospects");
  return toProposal(row);
}

export async function getProposalsForOrg(orgId: string): Promise<Proposal[]> {
  const rows = await sbSelect<Row>({
    query: `proposals?${COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toProposal);
}

export async function getProposalRecord(id: string): Promise<Proposal | null> {
  const rows = await sbSelect<Row>({
    query: `proposals?${COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toProposal(rows[0]) : null;
}

/** Public capability read for /proposal/[token]. Never throws. */
export async function getProposalByToken(token: string): Promise<Proposal | null> {
  if (!token) return null;
  try {
    const rows = await sbSelect<Row>({
      query: `proposals?${COLS}&token=eq.${encodeURIComponent(token)}&limit=1`,
      tier: "service",
    });
    return rows[0] ? toProposal(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function updateProposalStatus(id: string, status: ProposalStatus): Promise<void> {
  await sbUpdate("proposals", `id=eq.${encodeURIComponent(id)}`, { status });
  revalidatePath("/admin/prospects");
}

/** Record the Stripe session opened for a proposal (best-effort; needs 0014). */
export async function setProposalSession(id: string, sessionId: string): Promise<void> {
  try {
    await sbUpdate("proposals", `id=eq.${encodeURIComponent(id)}`, { stripe_session_id: sessionId });
  } catch {
    /* column may not exist until migration 0014 — non-fatal */
  }
}

/**
 * Mark a proposal PAID (real cash collected via Stripe) — also flips it to accepted.
 * Best-effort on the paid_* columns so it still closes the deal before 0014.
 */
export async function markProposalPaid(id: string, paidPence: number): Promise<void> {
  try {
    await sbUpdate("proposals", `id=eq.${encodeURIComponent(id)}`, {
      status: "accepted",
      paid_pence: paidPence,
      paid_at: new Date().toISOString(),
    });
  } catch {
    // Fall back to just closing it if the paid_* columns aren't there yet.
    await sbUpdate("proposals", `id=eq.${encodeURIComponent(id)}`, { status: "accepted" });
  }
  revalidatePath("/admin/prospects");
  revalidatePath("/admin");
}

/** Total real cash collected across paid proposals, pence. Returns 0 on any failure. */
export async function getCollectedTotalForOrg(orgId: string): Promise<number> {
  try {
    const rows = await sbSelect<{ paid_pence: number | null }>({
      query: `proposals?select=paid_pence&org_id=eq.${encodeURIComponent(orgId)}&paid_at=not.is.null`,
      tier: "service",
    });
    return rows.reduce((s, r) => s + (r.paid_pence ?? 0), 0);
  } catch {
    return 0;
  }
}
