# Implementation Plan

## Overview

Turn the deployed-but-idle Agency OS into a self-driving empire that reaches **£1,000/month recurring revenue** after ~5 hours of **one-off operator setup**, with all ongoing work done by the existing automation loops (discover → build demo → outreach → follow-up → proposal → paid retainer).

The codebase already contains the whole machine: an autopilot orchestrator (`lib/autopilot.ts`) driven by the daily `/api/automation/tick` cron, Resend-based outreach cadence (`lib/outreach-cadence.ts`), Stripe-paid proposals and retainer MRR tracking, and an Empire Dashboard. What stops it earning autonomously today:

1. **No goal / no feedback loop.** The autopilot uses *fixed* throughput constants (`MIN_ACTIVE_PIPELINE = 15`, `DEMOS_PER_RUN = 3`) regardless of how far the portfolio is from the revenue target. Nothing measures the gap to £1,000/mo and re-tunes the loop.
2. **Broken reply loop.** Outbound email is automated, but inbound replies are only captured if the operator manually marks them — so the cadence keeps chasing prospects who already answered, and hot leads go cold without a human watching.
3. **No single "operator cockpit".** The ~5 hours of setup work and any remaining human gates (approvals, venture go-aheads, blocked sends) are scattered across admin pages. There is no one screen that says *"here is exactly what stands between you and £1,000/mo"*.

High-level approach: add a deterministic **Goal Engine** that computes gap-to-goal and funnel projections from real data, wire it into the autopilot as **closed-loop throughput control**, close the **inbound-reply gap** with a Resend inbound webhook, and surface everything on a new **Operator Briefing** page plus a weekly digest email. Zero new runtime dependencies (per project convention). All money figures remain explicit models, never fabricated facts.

## Types

All new types live in `lib/goal-engine.ts` unless stated.

```ts
/** The empire's monthly recurring-revenue target, pence (£1,000). */
export const GOAL_MRR_PENCE = 100_000;

export interface FunnelCounts {
  discovered: number;   // prospects not yet contacted
  contacted: number;
  demosBuilt: number;   // active previews linked to prospects
  responded: number;
  negotiating: number;
  won: number;          // active retainers
}

/** Conversion model between stages — measured where data allows, else conservative defaults. */
export interface FunnelRates {
  contactRate: number;      // contacted / discovered attempts
  respondRate: number;      // responded / contacted
  winRate: number;          // won / responded
  avgRetainerPence: number; // mean monthlyPence of active retainers, else DEFAULT_RETAINER_PENCE
}

export interface NextAction {
  id: string;
  title: string;            // e.g. "Build 12 more demos"
  rationale: string;
  /** Modelled extra monthly MRR if completed, pence. */
  potentialMrrPence: number;
  effort: "low" | "medium" | "high";
  /** Where to do it (admin route or env var name) — never vague. */
  where: string;
}

export interface GoalStatus {
  goalPence: number;        // GOAL_MRR_PENCE
  currentMrrPence: number;  // real, from active retainers
  projectedMrrPence: number;// model: pipeline × funnel rates
  gapPence: number;         // max(0, goal − max(current, projected))
  coverageRatio: number | null; // projected / goal
  counts: FunnelCounts;
  rates: FunnelRates;
  /** Ranked highest-leverage adjustments, best first. */
  nextActions: NextAction[];
  notes: string[];          // modelling assumptions surfaced honestly
}

/** Throughput knobs the autopilot reads each run (closed-loop control output). */
export interface LoopTuning {
  minActivePipeline: number; // discovery top-up threshold (scaled)
  demosPerRun: number;       // bounded 1–6
  outreachMax: number;       // bounded 10–100
}
```

Modified types:
- `lib/autopilot.ts` → `AutopilotResult` gains `goal: { currentMrrPence: number; gapPence: number; topAction: string | null }`.
- New env vars documented in `.env.example`: `RESEND_INBOUND_SECRET` (server-only), `OPERATOR_NOTIFY_EMAIL` (digest recipient).

## Files

**New files**

| Path | Purpose |
|---|---|
| `lib/goal-engine.ts` | Deterministic, zero-token Goal Engine: funnel counting, conversion-rate estimation, projection, gap-to-goal, ranked next-actions, loop-tuning derivation. |
| `lib/setup-checklist.ts` | Detects completion of the one-off "~5 hour" setup: Supabase migrations 0010–0015 probed, Resend configured + from-domain, Stripe keys, CRON_SECRET, prospects seeded, autopilot enabled. Returns typed tasks with exact fix instructions. |
| `lib/operator-digest.ts` | Builds + sends the weekly operator briefing email over the existing Resend client (`lib/email.ts`). Best-effort: never throws into the tick. |
| `app/admin/(app)/briefing/page.tsx` | Operator Briefing — the one screen for 5-hour mode: goal ring (current vs £1,000), funnel bars, blockers from recent `agent_runs`, setup checklist, approvals queue, next-action cards wired to existing admin actions. |
| `app/api/webhooks/resend/route.ts` | Resend Inbound Email receiver: verifies secret, matches sender → prospect, records inbound `OutreachMessage`, advances prospect to `responded`. Mirrors the Stripe webhook's auth/validation pattern. |
| `supabase/migrations/0016_loop_state.sql` | Tiny `loop_state` key-value table (`key text pk, value jsonb, updated_at timestamptz`) for `last_digest_at` + weekly funnel snapshots (trend data for briefing/digest). |
| `test/goal-engine.test.ts` | Unit tests for all pure Goal Engine maths (see Testing). |
| `test/setup-checklist.test.ts` | Unit tests for checklist detection over injected config/state fixtures. |

**Modified files**

| Path | Change |
|---|---|
| `lib/autopilot.ts` | Step 0 computes `GoalStatus` → derives `LoopTuning`; replace the two fixed constants (`MIN_ACTIVE_PIPELINE`, `DEMOS_PER_RUN`) with tuned values; append `goal` summary to result; write weekly funnel snapshot to `loop_state`. |
| `app/api/automation/tick/route.ts` | After autopilot per org: call `maybeSendOperatorDigest` (weekly gate via `loop_state`); include goal summary in response JSON. |
| `lib/outreach.ts` | Add `createInboundOutreach(input)` (inserts `direction:"inbound", status:"received"`) and `getLatestOutboundForProspect(prospectId)`. |
| `lib/prospects.ts` | Add `findProspectByEmail(email)` (service-tier select, latest-first) for reply matching. |
| `.env.example` | Document `RESEND_INBOUND_SECRET`, `OPERATOR_NOTIFY_EMAIL`, plus external-scheduler instructions (Vercel Hobby cron is daily-only; an hourly external cron hitting `/api/automation/tick?secret=` speeds the loop). |
| `app/admin/(app)/AdminNav.tsx` | Add "Briefing" nav entry linking `/admin/briefing`. |
| `CLAUDE.md` | Map entries for new files + established fact about the goal engine. |
| `docs/PRODUCTION_AUDIT.md` | Short status appendix: reply-capture gap closed by the inbound webhook. |

No files deleted or moved.


## Functions

**New functions**

- `countFunnel(prospects, previews, retainers): FunnelCounts` — in `lib/goal-engine.ts`. Pure stage tallying from real rows.
- `estimateRates(counts: FunnelCounts, prior?: FunnelRates): FunnelRates` — measured rates where denominators ≥ 5, else conservative defaults (`respondRate 0.15`, `winRate 0.10`, `DEFAULT_RETAINER_PENCE = 25_000` = £250/mo); every substitution recorded in `notes[]` (honesty rule).
- `projectMrr(counts: FunnelCounts, rates: FunnelRates): number` — expected MRR if the live pipeline converted (pence).
- `buildGoalStatus(prospects, previews, retainers, opts?): GoalStatus` — composition root; ranks `nextActions` by `potentialMrrPence / effortWeight`.
- `deriveTuning(status: GoalStatus): LoopTuning` — pipeline below need → raise discovery threshold + demos/run; large outreach backlog → raise `outreachMax`; at/near goal → throttle down to protect AI spend caps. Hard-bounded.
- `getSetupChecklist(state): SetupTask[]` — in `lib/setup-checklist.ts`. Pure over injected env/config probes; each task carries exact fix text.
- `createInboundOutreach(input)` — in `lib/outreach.ts`. Persists a received reply.
- `findProspectByEmail(email: string)` — in `lib/prospects.ts`.
- `maybeSendOperatorDigest(org: {id, name})` — in `lib/operator-digest.ts`. Sends only if ≥ 7 days since `last_digest_at` in `loop_state`; digest = goal progress + what the loop did + blockers from `agent_runs` + open approvals count. Best-effort.
- `POST handler(request)` — in `app/api/webhooks/resend/route.ts`. Secret-gated (Bearer/`?secret=`, same pattern as automation tick); parses Resend inbound payload (`from`, `subject`, `text`), matches sender email via `findProspectByEmail`, dedupes best-effort by `(prospect_id, subject, day)`, inserts inbound message, sets prospect status forward-only to `responded` (never regresses `negotiating`/`won`/`lost`). Public route added to middleware's allowlist like other webhook/cron endpoints.

**Modified functions**

- `runAutopilot(org)` in `lib/autopilot.ts` — insert Step 0 (goal status + tuning), swap constants for tuned locals, pass `outreachMax` into `dispatchDueFollowUps({ max })`, return `goal` field. Signature unchanged.
- `handle(request)` in `app/api/automation/tick/route.ts` — add per-org digest step + richer JSON response.

**Removed functions:** none.

## Classes

None added or modified — the codebase is functionally organised; this plan follows that convention. New UI is a server component page following the existing `app/admin/(app)/*/page.tsx` pattern.


## Dependencies

**None added.** Everything uses existing zero-dep patterns: PostgREST-over-fetch for `loop_state` (`lib/supabase/client.ts` helpers), the existing Resend REST client (`lib/email.ts`) for the digest. Resend *Inbound* receiving is a dashboard/domain configuration task (manual, listed in the setup checklist), not a package. Node crypto continues to handle any secret comparison.

## Testing

- **New unit tests** (Node built-in runner via tsx, matching `npm test`):
  - `test/goal-engine.test.ts`: funnel counting across mixed statuses; rate estimation falls back to defaults under thin data and measures under sufficient data; projection arithmetic; gap clamped at 0; next-action ranking order (higher leverage first); `deriveTuning` bounds (never exceeds caps, scales up when far from goal, throttles at goal); `notes[]` populated for every assumed constant ("never fake" rule applied to the maths, not just facts).
  - `test/setup-checklist.test.ts`: each checklist item flips correctly based on injected env/state fixtures.
- **Existing tests untouched** — they cover cadence selection (`selectDueMessages`), CRM, economics. The inbound webhook must respect cadence semantics (HALTED statuses still stop sequences; a reply arriving after `won` must not regress status).
- **Validation commands** (Node not on PATH — prefix from CLAUDE.md):
  `$env:Path = "C:\Users\lukem\nodejs;$env:Path"` then `npm run typecheck`, `npm test`, `npm run build`.
- **Manual verification:** POST a fake Resend inbound payload with the secret → confirm inbound message row + prospect moved to `responded`; load `/admin/briefing` with Supabase configured → real MRR/funnel numbers render; without Supabase → honest empty states, never 500.

## Implementation Order

1. **Types + Goal Engine core** — `lib/goal-engine.ts` (pure, zero side effects) + `test/goal-engine.test.ts`. Tests green before anything consumes it.
2. **Setup checklist** — `lib/setup-checklist.ts` + tests. Defines the concrete 5-hour one-off path; independent of step 1.
3. **Closed-loop autopilot** — integrate goal status + `deriveTuning` into `lib/autopilot.ts`; extend `AutopilotResult`.
4. **Migration 0016** (`loop_state`) — note: manual execution in Supabase SQL editor; graceful degradation until applied (digest/snapshots inert, same as 0010–0015 today).
5. **Reply capture** — `lib/prospects.findProspectByEmail`, `lib/outreach.createInboundOutreach`, then `app/api/webhooks/resend/route.ts` (+ middleware allowlist).
6. **Operator Briefing page** — `app/admin/(app)/briefing/page.tsx` + AdminNav entry; composes outputs of steps 1, 2, 5 with existing approvals/agent-runs data.
7. **Weekly digest** — `lib/operator-digest.ts`, wired into `app/api/automation/tick/route.ts`.
8. **Config + docs** — `.env.example`, external-scheduler notes, `CLAUDE.md` map, audit-doc appendix.
9. **Final verification** — full `typecheck` + `test` + `build`; manual webhook + briefing smoke checks.

Steps 2, 4 and 5 are parallelisable once step 1 lands.

---

## Appendix: the "~5 hours" one-off setup path (what the checklist encodes)

1. Apply migrations `0010`–`0016` in the Supabase SQL editor (~30 min).
2. Verify a sending domain in Resend + set `OUTREACH_FROM_EMAIL`; configure Resend Inbound webhook → `/api/webhooks/resend?secret=…` (~45 min).
3. Confirm Stripe live keys/prices + webhook endpoint for paid proposals/retainers (~30 min).
4. Set `OPERATOR_NOTIFY_EMAIL`; optionally register an hourly external cron for `/api/automation/tick` (~20 min).
5. Seed the first discovery campaign / review autopilot settings + AI spend caps in Agent Control Centre, then clear any remaining red items on the Briefing page (~2–3 h).

From then on: the tick discovers, builds demos, sends outreach, chases follow-ups, captures replies, and collects payments autonomously; the operator reads one weekly digest email and visits the Briefing page only when something needs a human (approvals, venture go-ahead, blocked-send fixes).

