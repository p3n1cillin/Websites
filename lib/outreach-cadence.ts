import type { OutreachMessage, Prospect, ProspectStatus } from "./types";
import { getOutreachForOrg, markOutreachSent } from "./outreach";
import { getProspectsForOrg, updateProspectStatus } from "./prospects";
import { sendOutreachEmail, emailConfigured } from "./email";
import { PROSPECT_STATUSES } from "./types";

/**
 * Outreach follow-up cadence — "automate outreach and follow-up".
 *
 * A drafted sequence is initial → follow_up → final (all created as drafts). This
 * decides which next step is DUE: send the initial immediately, then the next step
 * once a gap has elapsed since the last send AND the prospect hasn't replied or moved
 * on. Pure selector (selectDueMessages) so it's testable + reused by the cron tick
 * and the in-app button; dispatchDueFollowUps performs the sends (Resend when
 * configured — it never fakes "sent" when it couldn't actually send).
 */

const DAY_MS = 86_400_000;
/** Days to wait before the next step, by the step's intent. */
const GAP_DAYS: Record<string, number> = { initial: 0, follow_up: 3, final: 4 };
/** Statuses where the cadence stops — they replied or the deal moved on/ended. */
const HALTED: ProspectStatus[] = ["responded", "negotiating", "won", "lost"];

export interface DueMessage {
  message: OutreachMessage;
  prospect: Prospect;
}

/** Which next-step messages are due to send right now, given the whole thread state. */
export function selectDueMessages(
  prospects: Prospect[],
  messages: OutreachMessage[],
  now: Date = new Date()
): DueMessage[] {
  const byProspect = new Map<string, OutreachMessage[]>();
  for (const m of messages) {
    const arr = byProspect.get(m.prospectId);
    if (arr) arr.push(m);
    else byProspect.set(m.prospectId, [m]);
  }

  const due: DueMessage[] = [];
  for (const p of prospects) {
    if (HALTED.includes(p.status)) continue;
    const msgs = byProspect.get(p.id);
    if (!msgs?.length) continue;
    // They replied → stop the sequence (inbound captured as direction/received).
    if (msgs.some((m) => m.direction === "inbound" || m.status === "received")) continue;

    const outbound = msgs.filter((m) => m.direction === "outbound").sort((a, b) => a.step - b.step);
    const nextDraft = outbound.find((m) => m.status === "draft");
    if (!nextDraft) continue;

    const sent = outbound.filter((m) => m.status === "sent" && m.sentAt);
    if (sent.length === 0) {
      due.push({ message: nextDraft, prospect: p }); // initial — send now
      continue;
    }
    const lastSentAt = Math.max(...sent.map((m) => new Date(m.sentAt!).getTime()));
    const gap = (GAP_DAYS[nextDraft.intent] ?? 3) * DAY_MS;
    if (now.getTime() - lastSentAt >= gap) due.push({ message: nextDraft, prospect: p });
  }
  return due;
}

export interface DispatchResult {
  due: number;
  sent: number;
  skipped: number;
  /** Skipped specifically because the prospect has no email on file. */
  skippedNoEmail: number;
  /** Had an email + Resend, but the send was REJECTED (e.g. unverified from-domain). */
  sendFailed: number;
  /** False when RESEND_API_KEY isn't set on this deployment (can't send at all). */
  emailConfigured: boolean;
}

/**
 * Send all currently-due follow-ups for an org via Resend. Marks messages sent and
 * advances the prospect to `contacted`. Skips (never fakes) when there's no email,
 * no Resend key, or a send fails — so the count reflects reality.
 */
export async function dispatchDueFollowUps(
  org: { id: string; name: string },
  opts: { max?: number } = {}
): Promise<DispatchResult> {
  const max = Math.min(Math.max(opts.max ?? 50, 1), 200);
  const [prospects, messages] = await Promise.all([
    getProspectsForOrg(org.id),
    getOutreachForOrg(org.id),
  ]);
  const due = selectDueMessages(prospects, messages);
  let sent = 0;
  let skipped = 0;
  let skippedNoEmail = 0;
  let sendFailed = 0;

  for (const { message, prospect } of due.slice(0, max)) {
    // Can't send at all without Resend, or for non-email channels.
    if (message.channel !== "email" || !emailConfigured) {
      skipped += 1;
      continue;
    }
    // Have Resend, but this prospect has no address — skip (never fake a recipient).
    if (!prospect.email) {
      skipped += 1;
      skippedNoEmail += 1;
      continue;
    }
    const ok = await sendOutreachEmail({
      to: prospect.email,
      subject: message.subject || `A quick idea for ${prospect.name}`,
      body: message.body,
      fromName: org.name,
    });
    if (!ok) {
      skipped += 1;
      sendFailed += 1; // Resend rejected it (often an unverified from-domain)
      continue;
    }
    await markOutreachSent(message.id);
    const cur = PROSPECT_STATUSES.indexOf(prospect.status);
    if (cur < PROSPECT_STATUSES.indexOf("contacted")) {
      await updateProspectStatus(prospect.id, "contacted");
    }
    sent += 1;
  }
  return { due: due.length, sent, skipped, skippedNoEmail, sendFailed, emailConfigured };
}
