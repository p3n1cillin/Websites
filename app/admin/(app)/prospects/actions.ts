"use server";

import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import {
  createProspect,
  deleteProspect,
  getProspectRecord,
  normalizeCategory,
  updateProspectStatus,
} from "@/lib/prospects";
import { runAgent } from "@/lib/agents/runner";
import type { DiscoveryAgentInput, DiscoveryAgentOutput, DiscoveryCandidate } from "@/lib/agents/discovery";
import { getDiscoverySource } from "@/lib/discovery-sources";
import type { MarketAgentInput } from "@/lib/agents/market";
import type { ProspectingAgentInput, ProspectingAgentOutput } from "@/lib/agents/prospecting";
import type { SalesAgentInput } from "@/lib/agents/sales";
import type { OnboardingAgentInput, OnboardingAgentOutput } from "@/lib/agents/onboarding";
import { getPreviewsForOrg, getPreviewRecord, revokeSitePreview, setPreviewPassword } from "@/lib/previews";
import {
  buildProposalDraft,
  createProposal,
  getProposalRecord,
  updateProposalStatus,
} from "@/lib/proposals";
import {
  getOutreachRecord,
  markOutreachSent,
  deleteOutreachMessage,
} from "@/lib/outreach";
import { SITE_URL } from "@/lib/seo";
import {
  PROSPECT_STATUSES,
  type OutreachChannel,
  type ProspectStatus,
} from "@/lib/types";

/** A prospect that belongs to the caller's org, or null. */
async function ownedProspect(id: string, orgId: string) {
  const p = await getProspectRecord(id);
  return p && p.orgId === orgId ? p : null;
}

// ---------------------------------------------------------------------------
// Manual single add (server-action form).
// ---------------------------------------------------------------------------
export async function createProspectAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const name = (formData.get("name") as string)?.trim();
  if (!name) redirect("/admin/prospects");
  const category = normalizeCategory(formData.get("category") as string);
  await createProspect({
    orgId: org.id,
    name,
    category,
    city: ((formData.get("city") as string) ?? "").trim(),
    phone: ((formData.get("phone") as string) ?? "").trim() || null,
    email: ((formData.get("email") as string) ?? "").trim() || null,
    websiteUrl: ((formData.get("website") as string) ?? "").trim() || null,
    source: { origin: "manual", at: new Date().toISOString() },
  });
  redirect("/admin/prospects");
}

// ---------------------------------------------------------------------------
// Discover many — parse pasted lines, run the Discovery agent (auto, so the
// scored prospects persist immediately for an interactive action).
// ---------------------------------------------------------------------------

/**
 * Parse one freeform line into a candidate. Email / website / phone are detected
 * by shape; the remaining free-text fields are taken POSITIONALLY — first =
 * industry/category, second = town. (Position beats shape here: "trading cards"
 * is an industry, not a town, even though it matches no known category. Mis-
 * ordering this is what once turned a collectables shop into a Warrington plumber.)
 */
function parseLine(line: string): DiscoveryCandidate | null {
  const parts = line
    .split(/[,\t;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const c: DiscoveryCandidate = { name: parts[0] };
  const rest: string[] = [];
  for (const part of parts.slice(1)) {
    const lower = part.toLowerCase();
    if (!c.email && part.includes("@")) c.email = part;
    else if (!c.websiteUrl && (lower.startsWith("http") || /\.[a-z]{2,}($|\/)/.test(lower)))
      c.websiteUrl = part;
    else if (!c.phone && /^[\d +()\-]{7,}$/.test(part)) c.phone = part;
    else rest.push(part);
  }
  if (rest[0]) c.category = rest[0]; // industry text (mapped to a bucket later)
  if (rest[1]) c.city = rest[1];
  return c;
}

export async function discoverAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const raw = (formData.get("list") as string) ?? "";
  const candidates = raw
    .split(/\r?\n/)
    .map(parseLine)
    .filter((c): c is DiscoveryCandidate => Boolean(c && c.name));
  if (candidates.length === 0) redirect("/admin/prospects");

  const input: DiscoveryAgentInput = {
    orgId: org.id,
    candidates,
    note: "Discovered from pasted list",
  };
  await runAgent({
    kind: "discovery",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto", // interactive run → persist now
    input,
  });
  redirect("/admin/prospects");
}

// ---------------------------------------------------------------------------
// Discover live — pull real local businesses from a discovery source (Overpass),
// then run them through the Discovery agent (auto) exactly like a pasted list.
// ---------------------------------------------------------------------------
export async function discoverLiveAction(formData: FormData): Promise<void> {
  const org = await requireOrg();
  const area = ((formData.get("area") as string) ?? "").trim() || "Warrington";
  const limit = Math.min(Math.max(Number(formData.get("limit")) || 25, 1), 60);

  const source = getDiscoverySource("overpass");
  let candidates: DiscoveryCandidate[] = [];
  try {
    candidates = await source.search({ area, limit });
  } catch {
    candidates = [];
  }
  if (candidates.length === 0) redirect("/admin/prospects?found=0&seen=0");

  const input: DiscoveryAgentInput = {
    orgId: org.id,
    candidates,
    note: `Discovered live via ${source.label} — ${area}`,
  };
  const res = await runAgent<DiscoveryAgentOutput>({
    kind: "discovery",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto",
    input,
  });
  // Report both new (created) and total seen, so "found businesses but all are
  // already in your pipeline" reads differently from "found nothing there".
  const created = res.output?.created ?? 0;
  redirect(`/admin/prospects?found=${created}&seen=${candidates.length}`);
}

// ---------------------------------------------------------------------------
// Analyse (Market agent) — callable from the board client.
// ---------------------------------------------------------------------------
export async function analyseProspectAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const prospect = await ownedProspect(id, org.id);
  if (!prospect) return { ok: false, error: "Prospect not found." };

  const input: MarketAgentInput = { prospect };
  const res = await runAgent({
    kind: "market",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto", // analysis is internal (no outbound) → safe to apply
    input,
  });
  if (res.status === "failed") return { ok: false, error: res.error || "Analysis failed." };
  if (res.status === "blocked") return { ok: false, error: res.summary || "Spend cap reached." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Move pipeline stage — callable from the board client.
// ---------------------------------------------------------------------------
export async function setProspectStatusAction(
  id: string,
  status: ProspectStatus
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  if (!PROSPECT_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  const prospect = await ownedProspect(id, org.id);
  if (!prospect) return { ok: false, error: "Prospect not found." };
  await updateProspectStatus(id, status);
  return { ok: true };
}

export async function deleteProspectAction(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const prospect = await ownedProspect(id, org.id);
  if (!prospect) return { ok: false, error: "Prospect not found." };
  await deleteProspect(id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sales (Phase E) — generate a demo preview, draft outreach, send, revoke.
// ---------------------------------------------------------------------------

/** Build a tokenised demo site for a prospect (Prospecting agent). */
export async function generatePreviewAction(
  id: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const org = await requireOrg();
  const prospect = await ownedProspect(id, org.id);
  if (!prospect) return { ok: false, error: "Prospect not found." };

  const input: ProspectingAgentInput = { prospect };
  const res = await runAgent<ProspectingAgentOutput>({
    kind: "prospecting",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto", // interactive build → persist the preview now
    input,
  });
  if (res.status === "failed") return { ok: false, error: res.error || "Preview build failed." };
  if (res.status === "blocked") return { ok: false, error: res.summary || "Spend cap reached." };
  return { ok: true, url: res.output?.url };
}

/** Latest active preview URL for a prospect, if any (used to seed outreach). */
async function latestPreviewUrl(prospectId: string, orgId: string): Promise<string | null> {
  const previews = await getPreviewsForOrg(orgId); // ordered newest-first
  const hit = previews.find((p) => p.prospectId === prospectId && p.status === "active");
  return hit ? `${SITE_URL}/preview/${hit.token}` : null;
}

/** Draft first-touch outreach (Sales agent), linking the demo if one exists. */
export async function draftOutreachAction(
  id: string,
  channel: OutreachChannel = "email"
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const prospect = await ownedProspect(id, org.id);
  if (!prospect) return { ok: false, error: "Prospect not found." };

  const previewUrl = await latestPreviewUrl(id, org.id);
  const input: SalesAgentInput = { prospect, previewUrl, channel };
  const res = await runAgent({
    kind: "sales",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto", // drafting is internal (not sending) → safe to apply
    input,
  });
  if (res.status === "failed") return { ok: false, error: res.error || "Drafting failed." };
  if (res.status === "blocked") return { ok: false, error: res.summary || "Spend cap reached." };
  return { ok: true };
}

/**
 * Mark a drafted outreach message as sent (the operator dispatched it) and move
 * the prospect into `contacted`. Sending itself is a human step — no email
 * provider is wired (zero-dep). Never regresses a deal already further along.
 */
export async function markOutreachSentAction(
  messageId: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const message = await getOutreachRecord(messageId);
  if (!message || message.orgId !== org.id) return { ok: false, error: "Message not found." };

  await markOutreachSent(messageId);

  const prospect = await ownedProspect(message.prospectId, org.id);
  if (prospect) {
    const current = PROSPECT_STATUSES.indexOf(prospect.status);
    const contacted = PROSPECT_STATUSES.indexOf("contacted");
    if (current < contacted) await updateProspectStatus(prospect.id, "contacted");
  }
  return { ok: true };
}

export async function deleteOutreachAction(
  messageId: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const message = await getOutreachRecord(messageId);
  if (!message || message.orgId !== org.id) return { ok: false, error: "Message not found." };
  await deleteOutreachMessage(messageId);
  return { ok: true };
}

/**
 * Onboard a won prospect: provision a real (draft) site from its demo + open a
 * customer portal (Onboarding agent). Idempotent — re-running returns the portal.
 */
export async function onboardProspectAction(
  id: string
): Promise<{ ok: boolean; portalUrl?: string; error?: string }> {
  const org = await requireOrg();
  const prospect = await ownedProspect(id, org.id);
  if (!prospect) return { ok: false, error: "Prospect not found." };

  const input: OnboardingAgentInput = { prospect };
  const res = await runAgent<OnboardingAgentOutput>({
    kind: "onboarding",
    orgId: org.id,
    actorUserId: org.ownerUserId,
    autonomyOverride: "auto", // interactive close → provision now
    input,
  });
  if (res.status === "failed") return { ok: false, error: res.error || "Onboarding failed." };
  if (res.status === "blocked") return { ok: false, error: res.summary || "Spend cap reached." };
  return { ok: true, portalUrl: res.output?.portalUrl };
}

// ---------------------------------------------------------------------------
// Proposals (Phase #7) — draft a tokenised proposal, mark it sent.
// ---------------------------------------------------------------------------

/** Advance a prospect to `to` only if it isn't already at/after that stage. */
async function advanceProspect(id: string, to: ProspectStatus): Promise<void> {
  const prospect = await getProspectRecord(id);
  if (!prospect) return;
  const current = PROSPECT_STATUSES.indexOf(prospect.status);
  const target = PROSPECT_STATUSES.indexOf(to);
  if (current < target) await updateProspectStatus(id, to);
}

/**
 * Build + persist a proposal for a prospect (deterministic draft from what we
 * know), then move the deal into `negotiating`. Returns the public token so the
 * board can surface the /proposal/[token] link.
 */
export async function createProposalAction(
  prospectId: string
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const org = await requireOrg();
  const prospect = await ownedProspect(prospectId, org.id);
  if (!prospect) return { ok: false, error: "Prospect not found." };

  const draft = buildProposalDraft(prospect);
  const proposal = await createProposal({ orgId: org.id, prospectId, draft });
  await advanceProspect(prospectId, "negotiating");
  return { ok: true, token: proposal.token };
}

/** Mark a proposal as sent (operator dispatched the link) and move to negotiating. */
export async function sendProposalAction(
  proposalId: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const proposal = await getProposalRecord(proposalId);
  if (!proposal || proposal.orgId !== org.id) return { ok: false, error: "Proposal not found." };

  await updateProposalStatus(proposalId, "sent");
  await advanceProspect(proposal.prospectId, "negotiating");
  return { ok: true };
}

/**
 * Admin shortcut: mark a proposal accepted on the prospect's behalf (e.g. they
 * said yes over the phone) and close the deal (→ won). The public-token path is
 * acceptProposalAction in the /proposal route; this is the org-scoped equivalent.
 */
export async function markProposalAcceptedAction(
  proposalId: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const proposal = await getProposalRecord(proposalId);
  if (!proposal || proposal.orgId !== org.id) return { ok: false, error: "Proposal not found." };

  await updateProposalStatus(proposalId, "accepted");
  await advanceProspect(proposal.prospectId, "won");
  return { ok: true };
}

/** Revoke a prospect's demo (its token stops working immediately). */
export async function revokePreviewAction(
  previewId: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const preview = await getPreviewRecord(previewId);
  if (!preview || preview.orgId !== org.id) return { ok: false, error: "Preview not found." };
  await revokeSitePreview(previewId);
  return { ok: true };
}

/** Set (or clear) a demo's private-share password. Empty string removes the gate. */
export async function setPreviewPasswordAction(
  previewId: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const org = await requireOrg();
  const preview = await getPreviewRecord(previewId);
  if (!preview || preview.orgId !== org.id) return { ok: false, error: "Preview not found." };
  try {
    await setPreviewPassword(previewId, password);
  } catch {
    return { ok: false, error: "Couldn't save — apply migration 0010 first." };
  }
  return { ok: true };
}
