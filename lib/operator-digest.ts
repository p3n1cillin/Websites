import { sbSelect, sbUpdate, sbInsert, supabaseWritable } from "./supabase/client";
import { getProspectsForOrg } from "./prospects";
import { getPreviewsForOrg } from "./previews";
import { getRetainersForOrg } from "./retainers";
import { buildGoalStatus } from "./goal-engine";
import { getRecentAgentRuns } from "./agent-runs";
import { getPendingApprovals } from "./approvals";
import { emailConfigured, sendOutreachEmail } from "./email";

/**
 * Operator digest — the "one email a week" layer of 5-hour empire mode.
 *
 * Once a week (gated by `last_digest_at` in loop_state) the automation tick
 * sends the owner a single honest briefing: goal progress, what the loops did,
 * what's blocked and what needs a human. Best-effort throughout — any failure
 * degrades to "no digest this week", never breaks the tick.
 */

const DIGEST_INTERVAL_MS = 7 * 86_400_000;

// ---------------------------------------------------------------------------
// loop_state helpers (migration 0016; everything degrades gracefully before)
// ---------------------------------------------------------------------------

interface LoopStateRow {
  key: string;
  value: unknown;
}

/** Read a loop-state value, or null when absent/unreadable (e.g. pre-0016). */
export async function readLoopState<T>(orgId: string, key: string): Promise<T | null> {
  if (!supabaseWritable) return null;
  try {
    const rows = await sbSelect<LoopStateRow>({
      query: `loop_state?select=key,value&org_id=eq.${encodeURIComponent(orgId)}&key=eq.${encodeURIComponent(key)}&limit=1`,
      tier: "service",
    });
    return rows.length > 0 ? (rows[0].value as T) : null;
  } catch {
    return null;
  }
}

/** Cheap probe for the setup checklist: is migration 0016 applied? */
export async function loopStateTableReadable(): Promise<boolean | null> {
  if (!supabaseWritable) return false;
  try {
    await sbSelect<LoopStateRow>({
      query: "loop_state?select=key&limit=1",
      tier: "service",
    });
    return true;
  } catch {
    return null;
  }
}

/** Write a loop-state value (update-then-insert; no PostgREST upsert header needed). */
async function writeLoopState(orgId: string, key: string, value: unknown): Promise<void> {
  if (!supabaseWritable) return;
  const enc = encodeURIComponent(orgId);
  const encKey = encodeURIComponent(key);
  const patched = await sbUpdate<LoopStateRow>(
    "loop_state",
    `org_id=eq.${enc}&key=eq.${encKey}`,
    { value, updated_at: new Date().toISOString() }
  );
  if (patched.length === 0) {
    await sbInsert("loop_state", { org_id: orgId, key, value });
  }
}

// ---------------------------------------------------------------------------
// Weekly digest
// ---------------------------------------------------------------------------

const gbp = (pence: number) => `£${(pence / 100).toLocaleString("en-GB")}`;

export interface DigestResult {
  sent: boolean;
  reason: string;
}

/** Build the plain-text digest body (also used as the email text part). */
export function buildDigestBody(input: {
  orgName: string;
  currentMrrPence: number;
  gapPence: number;
  projectedMrrPence: number;
  counts: { discovered: number; contacted: number; demosBuilt: number; responded: number; won: number };
  nextActions: { title: string; rationale: string; where: string }[];
  runsLastWeek: number;
  failuresLastWeek: string[];
  pendingApprovals: number;
}): string {
  const lines: string[] = [];
  lines.push(`Weekly empire briefing — ${input.orgName}`);
  lines.push("");
  lines.push(
    `Goal £1,000/mo recurring revenue: ${gbp(input.currentMrrPence)} banked` +
      (input.gapPence > 0 ? `, ${gbp(input.gapPence)} to go.` : " — GOAL REACHED.")
  );
  lines.push(`Pipeline model projects ${gbp(input.projectedMrrPence)}/mo if current prospects convert.`);
  lines.push("");
  lines.push(
    `Funnel: ${input.counts.discovered} discovered · ${input.counts.contacted} contacted · ` +
      `${input.counts.demosBuilt} demos · ${input.counts.responded} replied · ${input.counts.won} won`
  );
  lines.push("");
  if (input.nextActions.length > 0) {
    lines.push("Highest-leverage moves right now:");
    for (const a of input.nextActions.slice(0, 3)) {
      lines.push(`  • ${a.title} — ${a.rationale} (${a.where})`);
    }
    lines.push("");
  }
  lines.push(`The loops ran ${input.runsLastWeek} agent run(s) in the last 7 days.`);
  if (input.pendingApprovals > 0) {
    lines.push(`${input.pendingApprovals} action(s) are waiting for your approval (/admin/agents).`);
  }
  if (input.failuresLastWeek.length > 0) {
    lines.push("Failures worth a look:");
    for (const f of input.failuresLastWeek.slice(0, 3)) lines.push(`  • ${f}`);
  }
  lines.push("");
  lines.push("Full picture: /admin/briefing");
  return lines.join("\n");
}

/**
 * Send the weekly digest if one is due (≥7 days since the last). Returns why
 * nothing happened when it didn't send — never throws into the tick.
 */
export async function maybeSendOperatorDigest(org: {
  id: string;
  name: string;
}): Promise<DigestResult> {
  const to = process.env.OPERATOR_NOTIFY_EMAIL;
  if (!to) return { sent: false, reason: "OPERATOR_NOTIFY_EMAIL not set." };
  if (!emailConfigured) return { sent: false, reason: "RESEND_API_KEY not set." };

  const last = await readLoopState<{ at: string }>(org.id, "last_digest_at");
  if (last?.at && Date.now() - new Date(last.at).getTime() < DIGEST_INTERVAL_MS) {
    return { sent: false, reason: "Not due yet." };
  }

  try {
    const [prospects, previews, retainers, runs, approvals] = await Promise.all([
      getProspectsForOrg(org.id),
      getPreviewsForOrg(org.id),
      getRetainersForOrg(org.id),
      getRecentAgentRuns(org.id, 200),
      getPendingApprovals(org.id),
    ]);
    const status = buildGoalStatus(prospects, previews, retainers);

    const WEEK = 7 * 86_400_000;
    const since = Date.now() - WEEK;
    const recent = runs.filter((r) => new Date(r.createdAt).getTime() >= since);
    const failures = [
      ...new Set(
        recent
          .filter((r) => r.status === "failed" && r.error)
          .map((r) => `${r.kind}: ${r.error}`)
      ),
    ];

    // Weekly funnel snapshot for trend lines on the Briefing page.
    await writeLoopState(org.id, "weekly_snapshot", {
      at: new Date().toISOString(),
      currentMrrPence: status.currentMrrPence,
      projectedMrrPence: status.projectedMrrPence,
      counts: status.counts,
    });

    const body = buildDigestBody({
      orgName: org.name,
      currentMrrPence: status.currentMrrPence,
      gapPence: status.gapPence,
      projectedMrrPence: status.projectedMrrPence,
      counts: status.counts,
      nextActions: status.nextActions,
      runsLastWeek: recent.length,
      failuresLastWeek: failures,
      pendingApprovals: approvals.length,
    });

    const ok = await sendOutreachEmail({
      to,
      subject: `Empire briefing — ${gbp(status.currentMrrPence)}/mo · ${gbp(status.gapPence)} to goal`,
      body,
      fromName: org.name,
    });
    if (!ok) return { sent: false, reason: "Resend rejected the digest (check sending domain)." };

    await writeLoopState(org.id, "last_digest_at", { at: new Date().toISOString() });
    return { sent: true, reason: "Sent." };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "Digest build failed." };
  }
}

