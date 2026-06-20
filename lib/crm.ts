import type {
  OutreachMessage,
  Proposal,
  Prospect,
  ProspectStatus,
  SitePreview,
} from "./types";

/**
 * CRM Engine (MASTER_OS — "every record has a current stage, next action and last
 * activity; no lead becomes inactive without a defined reason").
 *
 * Deterministic + dependency-free (spec Cost Control: code before AI — zero tokens).
 * For each prospect it computes the single best NEXT ACTION from its real pipeline
 * state (status + whether a demo/outreach/proposal exists + engagement + recency),
 * the LAST ACTIVITY across all its records, and whether it's gone STALE for its
 * stage — so nothing falls through the cracks.
 */

export type NextActionKind =
  | "analyse"
  | "build_demo"
  | "send_outreach"
  | "follow_up"
  | "send_proposal"
  | "chase_proposal"
  | "book_call"
  | "onboard"
  | "nurture"
  | "none";

export interface CrmState {
  prospectId: string;
  stage: ProspectStatus;
  nextAction: string;
  nextActionKind: NextActionKind;
  lastActivityAt: string;
  daysSinceActivity: number;
  stale: boolean;
  urgency: "high" | "medium" | "low";
  /** Why it's flagged (stale reason) or why this is the next move. */
  reason: string;
}

export interface CrmInputs {
  preview?: SitePreview | null;
  outreach?: OutreachMessage[];
  proposal?: Proposal | null;
  /** True when a customer portal already exists (won → onboarded). */
  onboarded?: boolean;
}

const DAY_MS = 86_400_000;
/** Days a stage can sit untouched before it's "stale" and needs a nudge. */
const STALE_DAYS: Record<ProspectStatus, number> = {
  discovered: 3,
  analysed: 3,
  previewed: 2,
  contacted: 4,
  responded: 1, // hot — chase fast
  negotiating: 3,
  won: 7,
  lost: Infinity,
};

function mostRecent(...iso: (string | null | undefined)[]): string {
  let best = 0;
  let bestIso = "";
  for (const s of iso) {
    if (!s) continue;
    const t = new Date(s).getTime();
    if (t > best) {
      best = t;
      bestIso = s;
    }
  }
  return bestIso;
}

/** Compute the next action + activity/staleness for one prospect. Pure. */
export function crmStateFor(
  prospect: Prospect,
  inputs: CrmInputs = {},
  now: Date = new Date()
): CrmState {
  const { preview, outreach = [], proposal, onboarded } = inputs;
  const sent = outreach.filter((m) => m.status === "sent");
  const lastSentAt = mostRecent(...sent.map((m) => m.sentAt));
  const replied = outreach.some((m) => m.direction === "inbound" || m.status === "received");
  const demoViewed = (preview?.views ?? 0) > 0;

  const lastActivityAt =
    mostRecent(prospect.updatedAt, lastSentAt, preview?.lastViewedAt, proposal?.updatedAt) ||
    prospect.createdAt;
  const daysSinceActivity = Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / DAY_MS);

  let nextActionKind: NextActionKind = "none";
  let nextAction = "";
  let urgency: CrmState["urgency"] = "low";
  let reason = "";

  switch (prospect.status) {
    case "discovered":
      nextActionKind = "analyse";
      nextAction = "Analyse their site to score the opportunity";
      urgency = "low";
      break;
    case "analysed":
      nextActionKind = "build_demo";
      nextAction = "Build a demo site to show the upgrade";
      urgency = "medium";
      break;
    case "previewed":
      if (outreach.length === 0) {
        nextActionKind = "send_outreach";
        nextAction = "Draft + send first-touch outreach with the demo link";
      } else if (sent.length === 0) {
        nextActionKind = "send_outreach";
        nextAction = "Send the drafted outreach";
      } else {
        nextActionKind = "follow_up";
        nextAction = "Follow up — no reply yet";
      }
      urgency = "medium";
      break;
    case "contacted":
      if (demoViewed) {
        nextActionKind = "book_call";
        nextAction = "They opened the demo — call/message to book a chat";
        urgency = "high";
        reason = "Demo opened — buying signal";
      } else {
        nextActionKind = "follow_up";
        nextAction = "Follow up on the outreach";
        urgency = "medium";
      }
      break;
    case "responded":
      nextActionKind = proposal ? "chase_proposal" : "send_proposal";
      nextAction = proposal ? "They replied — chase the proposal to close" : "They replied — send a proposal now";
      urgency = "high";
      reason = "Replied — hottest stage";
      break;
    case "negotiating":
      if (!proposal || proposal.status === "draft") {
        nextActionKind = "send_proposal";
        nextAction = "Send the proposal";
      } else {
        nextActionKind = "chase_proposal";
        nextAction = "Chase the sent proposal to a decision";
      }
      urgency = "high";
      break;
    case "won":
      if (!onboarded) {
        nextActionKind = "onboard";
        nextAction = "Onboard the client — open their portal + build the live site";
        urgency = "high";
        reason = "Won but not onboarded";
      } else {
        nextActionKind = "nurture";
        nextAction = "Check in — review results + look for upsells";
        urgency = "low";
      }
      break;
    case "lost":
      nextActionKind = "none";
      nextAction = "No action — marked lost";
      urgency = "low";
      reason = "Closed lost";
      break;
  }

  const threshold = STALE_DAYS[prospect.status];
  const stale = nextActionKind !== "none" && daysSinceActivity >= threshold;
  if (stale && !reason) {
    reason = `No activity for ${daysSinceActivity} day${daysSinceActivity === 1 ? "" : "s"} (stage limit ${threshold})`;
  }
  // A replied-to thread that's been left is the most urgent leak of all.
  if (replied && prospect.status !== "won" && prospect.status !== "lost") {
    urgency = "high";
    if (!reason) reason = "Customer replied — don't leave them waiting";
  }

  return {
    prospectId: prospect.id,
    stage: prospect.status,
    nextAction,
    nextActionKind,
    lastActivityAt,
    daysSinceActivity,
    stale,
    urgency,
    reason,
  };
}

/** Build CRM states for many prospects, keyed by prospect id. */
export function buildCrmStates(
  prospects: Prospect[],
  lookups: {
    previewByProspect?: Record<string, SitePreview>;
    outreachByProspect?: Record<string, OutreachMessage[]>;
    proposalByProspect?: Record<string, Proposal>;
    onboardedProspectIds?: Set<string>;
  } = {},
  now: Date = new Date()
): Record<string, CrmState> {
  const out: Record<string, CrmState> = {};
  for (const p of prospects) {
    out[p.id] = crmStateFor(
      p,
      {
        preview: lookups.previewByProspect?.[p.id] ?? null,
        outreach: lookups.outreachByProspect?.[p.id] ?? [],
        proposal: lookups.proposalByProspect?.[p.id] ?? null,
        onboarded: lookups.onboardedProspectIds?.has(p.id) ?? false,
      },
      now
    );
  }
  return out;
}

/** Prospects that need attention now — stale or high-urgency — worst first. */
export function needsAttention(states: CrmState[]): CrmState[] {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return states
    .filter((s) => s.nextActionKind !== "none" && (s.stale || s.urgency === "high"))
    .sort((a, b) => rank[a.urgency] - rank[b.urgency] || b.daysSinceActivity - a.daysSinceActivity);
}
