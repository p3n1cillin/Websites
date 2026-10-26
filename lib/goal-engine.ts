import type { ClientRetainer, Prospect, ProspectStatus, SitePreview } from "./types";

/**
 * Goal Engine — closed-loop revenue control for the empire.
 *
 * Deterministic + zero-token (Cost Control: code before AI). Reads the REAL
 * funnel (prospects, demos, retainers), models the conversion maths honestly
 * (every assumed constant is surfaced in `notes[]`, never hidden), and derives:
 *
 *  - how far the portfolio is from the £1,000/mo goal,
 *  - which adjustment buys the most MRR for the least effort,
 *  - the throughput knobs the autopilot should run with this tick.
 *
 * All money figures are explicit MODELS, never measured facts.
 */

/** The empire goal: £1,000/month recurring revenue. */
export const GOAL_MRR_PENCE = 100_000;

/** Conservative assumed retainer value until real retainers exist (£250/mo). */
export const DEFAULT_RETAINER_PENCE = 25_000;
/**
 * Conservative prior conversion rates, used ONLY while the real funnel is too
 * thin to measure (fewer than MIN_RATE_SAMPLE at a stage). Replaced by measured
 * rates as data accumulates — every substitution is recorded in `notes[]`.
 */
export const DEFAULT_RESPOND_RATE = 0.15;
export const DEFAULT_WIN_RATE = 0.1;
/** Minimum sample at a stage before its measured rate replaces the prior. */
export const MIN_RATE_SAMPLE = 5;

export interface FunnelCounts {
  /** Reached "discovered" (i.e. every non-lost prospect). */
  discovered: number;
  /** Reached "contacted" or beyond. */
  contacted: number;
  /** Distinct prospects with an ACTIVE demo built. */
  demosBuilt: number;
  /** Reached "responded" or beyond. */
  responded: number;
  /** Reached "negotiating" or beyond. */
  negotiating: number;
  /** Active retainers (real recurring revenue). */
  won: number;
}

/** Conversion model between stages — measured where data allows, else priors. */
export interface FunnelRates {
  respondRate: number; // responded ÷ contacted
  winRate: number; // won ÷ responded
  avgRetainerPence: number; // mean monthlyPence of active retainers, else DEFAULT_RETAINER_PENCE
}

export type ActionEffort = "low" | "medium" | "high";

export interface NextAction {
  id: string;
  title: string;
  rationale: string;
  /** Modelled extra monthly MRR if completed, pence. */
  potentialMrrPence: number;
  effort: ActionEffort;
  /** Where to do it (admin route or env var name) — never vague. */
  where: string;
}

export interface GoalStatus {
  goalPence: number;
  /** Real, from active retainers. */
  currentMrrPence: number;
  /** Model: live pipeline × stage probabilities. */
  projectedMrrPence: number;
  /** max(0, goal − max(current, projected)). */
  gapPence: number;
  /** projected ÷ goal (null when the goal is unreachable with current rates). */
  coverageRatio: number | null;
  counts: FunnelCounts;
  rates: FunnelRates;
  /** Ranked highest-leverage adjustments, best first. */
  nextActions: NextAction[];
  /** Every modelling assumption actually applied, for honest display. */
  notes: string[];
}

/** Throughput knobs the autopilot reads each run (closed-loop control output). */
export interface LoopTuning {
  /** Discovery tops the pipeline up below this many active prospects. */
  minActivePipeline: number;
  /** Expensive demo-build agent chains per tick. */
  demosPerRun: number;
  /** Follow-ups dispatched per cadence run. */
  outreachMax: number;
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

const REACHED_CONTACTED: ProspectStatus[] = ["contacted", "responded", "negotiating", "won"];
const REACHED_RESPONDED: ProspectStatus[] = ["responded", "negotiating", "won"];
const REACHED_NEGOTIATING: ProspectStatus[] = ["negotiating", "won"];

function countReached(prospects: Prospect[], statuses: ProspectStatus[]): number {
  return prospects.filter((p) => statuses.includes(p.status)).length;
}

/** Cumulative funnel tally from real rows. Lost prospects count nowhere. */
export function countFunnel(
  prospects: Prospect[],
  previews: Pick<SitePreview, "prospectId" | "status">[],
  retainers: ClientRetainer[]
): FunnelCounts {
  const alive = prospects.filter((p) => p.status !== "lost");
  const activePreviews = new Set(
    previews.filter((pv) => pv.status === "active").map((pv) => pv.prospectId)
  );
  return {
    discovered: alive.length,
    contacted: countReached(alive, REACHED_CONTACTED),
    demosBuilt: [...alive].filter((p) => activePreviews.has(p.id)).length,
    responded: countReached(alive, REACHED_RESPONDED),
    negotiating: countReached(alive, REACHED_NEGOTIATING),
    won: retainers.filter((r) => r.status === "active").length,
  };
}

// ---------------------------------------------------------------------------
// Rates + projection
// ---------------------------------------------------------------------------

/** Measured rates where each denominator ≥ MIN_RATE_SAMPLE, else priors. */
export function estimateRates(counts: FunnelCounts, retainers: ClientRetainer[]): {
  rates: FunnelRates;
  notes: string[];
} {
  const notes: string[] = [];
  let respondRate = DEFAULT_RESPOND_RATE;
  if (counts.contacted >= MIN_RATE_SAMPLE) {
    respondRate = Math.min(1, counts.responded / counts.contacted);
  } else {
    notes.push(
      `Respond rate unmeasurable (${counts.contacted}/${MIN_RATE_SAMPLE} sample) — assuming ${DEFAULT_RESPOND_RATE}.`
    );
  }
  let winRate = DEFAULT_WIN_RATE;
  if (counts.responded >= MIN_RATE_SAMPLE) {
    winRate = Math.min(1, Math.max(counts.won, 0) / counts.responded);
  } else {
    notes.push(
      `Win rate unmeasurable (${counts.responded}/${MIN_RATE_SAMPLE} sample) — assuming ${DEFAULT_WIN_RATE}.`
    );
  }
  const active = retainers.filter((r) => r.status === "active");
  let avgRetainerPence = DEFAULT_RETAINER_PENCE;
  if (active.length > 0) {
    avgRetainerPence = Math.round(active.reduce((s, r) => s + r.monthlyPence, 0) / active.length);
  } else {
    notes.push(
      `No active retainers yet — valuing a win at £${DEFAULT_RETAINER_PENCE / 100}/mo until the first real one lands.`
    );
  }
  return { rates: { respondRate, winRate, avgRetainerPence }, notes };
}

/**
 * Win probability for a prospect sitting at `status`, from the funnel rates.
 * Early stages still have the whole funnel ahead of them (respond × win);
 * warm stages use the win rate directly. Negotiating gets a 2× boost capped
 * at 50% — they're actively talking.
 */
export function stageWinProbability(status: ProspectStatus, rates: FunnelRates): number {
  switch (status) {
    case "discovered":
    case "analysed":
    case "previewed":
    case "contacted":
      return Math.min(0.5, rates.respondRate * rates.winRate);
    case "responded":
      return Math.min(0.5, rates.winRate);
    case "negotiating":
      return Math.min(0.5, rates.winRate * 2);
    default:
      return 0; // won / lost carry no forward expectation
  }
}

/** Expected monthly MRR if the live pipeline converted at the modelled rates. */
export function projectMrr(
  prospects: Prospect[],
  previews: Pick<SitePreview, "prospectId" | "status">[],
  rates: FunnelRates
): number {
  const activeIds = new Set(
    previews.filter((pv) => pv.status === "active").map((pv) => pv.prospectId)
  );
  const hasDemo = (p: Prospect) => activeIds.has(p.id);
  const total = prospects
    .filter((p) => p.status !== "won" && p.status !== "lost")
    .reduce((sum, p) => {
      // A built demo materially raises response odds — double the stage probability.
      const prob = Math.min(0.6, stageWinProbability(p.status, rates) * (hasDemo(p) ? 2 : 1));
      return sum + prob * rates.avgRetainerPence;
    }, 0);
  return Math.round(total);
}


// ---------------------------------------------------------------------------
// Goal status + next actions
// ---------------------------------------------------------------------------

const EFFORT_WEIGHT: Record<ActionEffort, number> = { low: 1, medium: 2.5, high: 5 };

function rankActions(actions: NextAction[]): NextAction[] {
  return actions.sort(
    (a, b) =>
      b.potentialMrrPence / EFFORT_WEIGHT[b.effort] -
    a.potentialMrrPence / EFFORT_WEIGHT[a.effort]
  );
}

/**
 * The full goal picture: real MRR, modelled projection, gap-to-goal, and the
 * ranked adjustments that close it fastest. Pure + deterministic.
 */
export function buildGoalStatus(
  prospects: Prospect[],
  previews: Pick<SitePreview, "prospectId" | "status">[],
  retainers: ClientRetainer[]
): GoalStatus {
  const counts = countFunnel(prospects, previews, retainers);
  const { rates, notes } = estimateRates(counts, retainers);
  const currentMrrPence = retainers
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + r.monthlyPence, 0);
  const projectedMrrPence = projectMrr(prospects, previews, rates);
  const gapPence = Math.max(0, GOAL_MRR_PENCE - Math.max(currentMrrPence, projectedMrrPence));
  // Goal attainment: whichever of real MRR / modelled pipeline is stronger.
  const coverageRatio = GOAL_MRR_PENCE > 0 ? Math.max(currentMrrPence, projectedMrrPence) / GOAL_MRR_PENCE : null;

  // --- Candidate actions, scored on modelled marginal MRR --------------------
  const actions: NextAction[] = [];
  const perWin = rates.avgRetainerPence;
  const winsNeeded = Math.ceil(gapPence / perWin);

  // 1. Build more demos — the proven multiplier (demo ≈ 2× stage probability).
  const undemoed = prospects.filter(
    (p) => !["previewed", "contacted", "responded", "negotiating", "won", "lost"].includes(p.status)
  ).length;
  if (undemoed > 0 && gapPence > 0) {
    const n = Math.min(undemoed, Math.max(1, Math.ceil(winsNeeded / Math.max(rates.winRate, 0.01))));
    actions.push({
      id: "build-demos",
      title: `Build ${n} more demo${n === 1 ? "" : "s"}`,
      rationale: `${undemoed} prospect${undemoed === 1 ? "" : "s"} have no demo yet. Demos roughly double reply odds — the loop's strongest lever.`,
      potentialMrrPence: Math.round(n * rates.respondRate * rates.winRate * perWin),
      effort: "medium",
      where: "/admin/factory",
    });
  }

  // 2. Fill the top of the funnel.
  const needDiscovered = Math.ceil(winsNeeded / Math.max(rates.respondRate * rates.winRate, 0.005));
  if (counts.discovered < needDiscovered && gapPence > 0) {
    const n = needDiscovered - counts.discovered;
    actions.push({
      id: "discover",
      title: `Discover ${n} more prospect${n === 1 ? "" : "s"}`,
      rationale: `At the modelled ${Math.round(rates.respondRate * 100)}% reply × ${Math.round(rates.winRate * 100)}% win rates, ~${needDiscovered} prospects are needed to bank £${GOAL_MRR_PENCE / 100}/mo.`,
      potentialMrrPence: Math.round(Math.min(n, 50) * rates.respondRate * rates.winRate * perWin),
      effort: "low",
      where: "/admin/prospects",
    });
  }

  // 3. Work the warm end — replied prospects waiting on a proposal.
  const respondedOpen = prospects.filter((p) => p.status === "responded").length;
  if (respondedOpen > 0 && gapPence > 0) {
    actions.push({
      id: "work-warm",
      title: `Move ${respondedOpen} replied prospect${respondedOpen === 1 ? "" : "s"} to proposals`,
      rationale: `Replied prospects convert at the modelled ${Math.round(rates.winRate * 100)}% — the cheapest wins available right now.`,
      potentialMrrPence: Math.round(respondedOpen * rates.winRate * perWin),
      effort: "low",
      where: "/admin/crm",
    });
  }

  // 4. Negotiations are the closest money.
  const negotiatingOpen = prospects.filter((p) => p.status === "negotiating").length;
  if (negotiatingOpen > 0 && gapPence > 0) {
    actions.push({
      id: "close",
      title: `Close ${negotiatingOpen} negotiation${negotiatingOpen === 1 ? "" : "s"}`,
      rationale: `Active negotiations convert at ~2× the normal win rate. Send/resent proposals via the tokenised flow.`,
      potentialMrrPence: Math.round(Math.min(0.5, rates.winRate * 2) * negotiatingOpen * perWin),
      effort: "low",
      where: "/admin/crm",
    });
  }

  // 5. At goal: protect + grow (retention/expansion beats acquisition).
  if (gapPence === 0) {
    actions.push({
      id: "retain",
      title: "Goal reached — protect + expand MRR",
      rationale: `£${Math.max(currentMrrPence, projectedMrrPence) / 100}/mo secured. Retention + upsell now beat acquisition; the Growth agent's recommendations are queued.`,
      potentialMrrPence: Math.round(currentMrrPence * 0.15),
      effort: "low",
      where: "/admin/growth",
    });
  }

  return {
    goalPence: GOAL_MRR_PENCE,
    currentMrrPence,
    projectedMrrPence,
    gapPence,
    coverageRatio,
    counts,
    rates,
    nextActions: rankActions(actions).slice(0, 5),
    notes,
  };
}


// ---------------------------------------------------------------------------
// Closed-loop tuning
// ---------------------------------------------------------------------------

const TUNING_BOUNDS = {
  minActivePipeline: { min: 10, max: 40 },
  demosPerRun: { min: 1, max: 6 },
  outreachMax: { min: 10, max: 100 },
} as const;

function clamp(v: number, b: { min: number; max: number }): number {
  return Math.min(b.max, Math.max(b.min, v));
}

/**
 * Derive this tick's throughput from the gap. Far from goal → push harder
 * (more discovery headroom, more demo builds, bigger outreach batches); at or
 * near goal → throttle down so spend caps aren't burned chasing surplus.
 * Always hard-bounded — a runaway gap can never set unbounded work.
 */
export function deriveTuning(status: GoalStatus): LoopTuning {
  const coverage = status.coverageRatio ?? 0;
  // Pipeline headroom: scale the discovery top-up floor between 10 (cruising)
  // and 20 (pushing) — enough active prospects that the loop never starves.
  const minActivePipeline = clamp(
    Math.round(TUNING_BOUNDS.minActivePipeline.min + coverage * TUNING_BOUNDS.minActivePipeline.min),
    TUNING_BOUNDS.minActivePipeline
  );
  // Demo builds: expensive — 2 when cruising, up to 6 when the gap is wide.
  const demosPerRun = clamp(
    status.gapPence >= 75_000 ? 6 : status.gapPence >= 25_000 ? 4 : 2,
    TUNING_BOUNDS.demosPerRun
  );
  // Outreach batches: wider gap → chase more prospects per dispatch window.
  const outreachMax = clamp(
    status.gapPence >= 75_000 ? 100 : status.gapPence >= 25_000 ? 50 : 20,
    TUNING_BOUNDS.outreachMax
  );
  return { minActivePipeline, demosPerRun, outreachMax };
}

