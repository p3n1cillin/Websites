import { runAgent } from "./agents/runner";
import type { MarketAgentInput } from "./agents/market";
import type { ProspectingAgentInput, ProspectingAgentOutput } from "./agents/prospecting";
import type { SalesAgentInput } from "./agents/sales";
import type { DiscoveryAgentInput, DiscoveryAgentOutput, DiscoveryCandidate } from "./agents/discovery";
import { getProspectsForOrg, getProspectRecord } from "./prospects";
import { getPreviewsForOrg } from "./previews";
import { getRetainersForOrg } from "./retainers";
import { getBusinessesForOrg } from "./businesses";
import { runDiscoveryCampaign } from "./discovery-sources/campaign";
import { buildExpansionBrief } from "./discovery-sources/expansion";
import { dispatchDueFollowUps } from "./outreach-cadence";
import { enrichOrgContacts } from "./contact-enrichment";
import { buildBusinessGraph } from "./discovery-graph";
import { buildEmpirePortfolio } from "./empire";
import { GOAL_MRR_PENCE, buildGoalStatus, deriveTuning } from "./goal-engine";
import {
  getOpportunitiesForOrg,
  pursueOpportunity,
  advanceOpportunity,
  dependenciesFor,
  OPPORTUNITY_STAGES,
} from "./opportunities";
import { SITE_URL } from "./seo";

/**
 * Autopilot — the start-to-finish empire orchestrator. One run drives every stage of
 * the funnel forward as far as it can WITHOUT a human: discover → build demos → send
 * due outreach/follow-ups → pursue + advance ventures. Bounded per run; every agent
 * step goes through `runAgent` (autonomy gates + spend caps still apply).
 *
 * Reality constraint (honest by design): it NEVER fabricates sends or payments. Steps
 * that need a human/credential/payment/legal input (real email sending without Resend,
 * card payment, deployment, owner go-ahead) are SKIPPED and reported in `blocked` —
 * so the operator sees exactly what to unblock. Idempotent: safe to run on a schedule.
 */

export interface AutopilotResult {
  discovered: number;
  demosBuilt: number;
  outreachSent: number;
  outreachSkipped: number;
  venturesPursued: number;
  venturesAdvanced: number;
  blocked: string[];
  notes: string[];
  /** Closed-loop control: where this org stands vs the £1,000/mo goal. */
  goal: {
    currentMrrPence: number;
    gapPence: number;
    topAction: string | null;
    tuning: { minActivePipeline: number; demosPerRun: number; outreachMax: number };
  };
}

const MIN_ACTIVE_PIPELINE = 15; // legacy floor — superseded by goal-engine tuning below
const DEMOS_PER_RUN = 3; // legacy bound — superseded by goal-engine tuning below

export interface AutopilotOrg {
  orgId: string;
  orgName: string;
  ownerUserId: string;
}

export async function runAutopilot(org: AutopilotOrg): Promise<AutopilotResult> {
  const res: AutopilotResult = {
    discovered: 0,
    demosBuilt: 0,
    outreachSent: 0,
    outreachSkipped: 0,
    venturesPursued: 0,
    venturesAdvanced: 0,
    blocked: [],
    notes: [],
    goal: {
      currentMrrPence: 0,
      gapPence: GOAL_MRR_PENCE,
      topAction: null,
      tuning: { minActivePipeline: MIN_ACTIVE_PIPELINE, demosPerRun: DEMOS_PER_RUN, outreachMax: 50 },
    },
  };

  const [prospects, previews, retainers, businesses] = await Promise.all([
    getProspectsForOrg(org.orgId),
    getPreviewsForOrg(org.orgId),
    getRetainersForOrg(org.orgId),
    getBusinessesForOrg(org.orgId),
  ]);

  // --- 0. GOAL ENGINE — closed-loop control -----------------------------------
  // Measure gap-to-goal from the REAL funnel, then let it set this run's
  // throughput (discovery headroom, demo builds, outreach batch size). Far from
  // goal → the loop pushes harder; at/near goal → it throttles to save spend.
  const status = buildGoalStatus(prospects, previews, retainers);
  const tuning = deriveTuning(status);
  res.goal = {
    currentMrrPence: status.currentMrrPence,
    gapPence: status.gapPence,
    topAction: status.nextActions[0]?.title ?? null,
    tuning,
  };

  const active = prospects.filter((p) => p.status !== "won" && p.status !== "lost");

  // --- 1. DISCOVERY — top the pipeline up by expanding existing footholds -------
  if (active.length < tuning.minActivePipeline && prospects.length > 0) {
    try {
      const brief = buildExpansionBrief(prospects, { minOpportunity: 40 });
      if (brief.areas.length > 0) {
        const camp = await runDiscoveryCampaign(brief);
        if (camp.candidates.length > 0) {
          const out = await runAgent<DiscoveryAgentOutput>({
            kind: "discovery",
            orgId: org.orgId,
            actorUserId: org.ownerUserId,
            autonomyOverride: "auto",
            input: {
              orgId: org.orgId,
              candidates: camp.candidates as DiscoveryCandidate[],
              note: "Autopilot competitor expansion",
            } as DiscoveryAgentInput,
          });
          res.discovered = out.output?.created ?? 0;
        }
      }
    } catch {
      res.notes.push("Discovery step failed this run.");
    }
  } else if (prospects.length === 0) {
    res.blocked.push("Seed discovery: run a discovery campaign once so autopilot has footholds to expand.");
  }

  // --- 2. DEMOS — build sellable demos for the top opportunities ----------------
  const hasActivePreview = new Set(
    previews.filter((p) => p.status === "active").map((p) => p.prospectId)
  );
  const demoTargets = active
    .filter((p) => !hasActivePreview.has(p.id))
    .slice(0, tuning.demosPerRun);
  for (const p of demoTargets) {
    try {
      await runAgent({
        kind: "market",
        orgId: org.orgId,
        actorUserId: org.ownerUserId,
        autonomyOverride: "auto",
        input: { prospect: p } as MarketAgentInput,
      });
      const fresh = (await getProspectRecord(p.id)) ?? p;
      const built = await runAgent<ProspectingAgentOutput>({
        kind: "prospecting",
        orgId: org.orgId,
        actorUserId: org.ownerUserId,
        autonomyOverride: "auto",
        input: { prospect: fresh } as ProspectingAgentInput,
      });
      if (built.status !== "completed") continue;
      res.demosBuilt += 1;
      // Draft first-touch outreach with the new demo link.
      const afterBuild = await getPreviewsForOrg(org.orgId);
      const hit = afterBuild.find((pv) => pv.prospectId === p.id && pv.status === "active");
      const previewUrl = hit ? `${SITE_URL}/preview/${hit.token}` : null;
      await runAgent({
        kind: "sales",
        orgId: org.orgId,
        actorUserId: org.ownerUserId,
        autonomyOverride: "auto",
        input: { prospect: fresh, previewUrl, channel: "email" } as SalesAgentInput,
      });
    } catch {
      /* one prospect failing never stops the run */
    }
  }

  // --- 2b. CONTACT BACKFILL — scrape missing email/phone so outreach has somewhere
  // to go (reaches prospects at any stage, incl. demos built before scraping). ----
  try {
    await enrichOrgContacts(org.orgId, 10);
  } catch {
    res.notes.push("Contact enrichment step failed this run.");
  }

  // --- 3. OUTREACH — send everything that's due (never fakes a send) ------------
  try {
    const dispatch = await dispatchDueFollowUps({ id: org.orgId, name: org.orgName }, { max: tuning.outreachMax });
    res.outreachSent = dispatch.sent;
    res.outreachSkipped = dispatch.skipped;
    if (dispatch.skipped > 0) {
      // Name the ACTUAL cause so the operator fixes the right thing.
      if (!dispatch.emailConfigured) {
        res.blocked.push(
          `${dispatch.skipped} message(s) ready, but email isn't configured on this deployment — set RESEND_API_KEY + OUTREACH_FROM_EMAIL and redeploy.`
        );
      } else if (dispatch.sendFailed > 0) {
        res.blocked.push(
          `${dispatch.sendFailed} send(s) rejected by Resend — check your sending domain is verified and OUTREACH_FROM_EMAIL is an address on it.`
        );
      } else if (dispatch.skippedNoEmail > 0) {
        res.blocked.push(
          `${dispatch.skippedNoEmail} due prospect(s) have no email yet — run "Find contacts" to scrape more.`
        );
      }
    }
  } catch {
    res.notes.push("Outreach step failed this run.");
  }

  // --- 4. VENTURES — pursue the best opportunity + advance what isn't gated -----
  try {
    const ventures = await getOpportunitiesForOrg(org.orgId);
    if (ventures.length === 0) {
      const graph = buildBusinessGraph(prospects);
      const portfolio = buildEmpirePortfolio({
        clusters: graph.clusters,
        retainers,
        liveSites: businesses.filter((b) => b.status === "published").length,
        prospectCount: prospects.length,
        orgName: org.orgName,
      });
      const top = portfolio.opportunities[0];
      if (top) {
        const v = await pursueOpportunity(org.orgId, top);
        if (v) {
          res.venturesPursued = 1;
          res.blocked.push(`Venture "${top.title}" started — needs your go-ahead to leave validation.`);
        }
      }
    } else {
      for (const v of ventures) {
        const deps = dependenciesFor(v.category, v.stage);
        if (deps.length > 0) {
          res.blocked.push(`Venture "${v.title}" (${v.stage}) needs you: ${deps.map((d) => d.label).join(", ")}.`);
          continue;
        }
        const idx = OPPORTUNITY_STAGES.indexOf(v.stage);
        if (idx < OPPORTUNITY_STAGES.length - 1) {
          const adv = await advanceOpportunity(v.id);
          if (adv.ok) res.venturesAdvanced += 1;
        }
      }
    }
  } catch {
    res.notes.push("Ventures step failed this run.");
  }

  return res;
}
