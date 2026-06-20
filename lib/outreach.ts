import { revalidatePath } from "next/cache";
import type {
  OutreachChannel,
  OutreachDirection,
  OutreachIntent,
  OutreachMessage,
  OutreachStatus,
} from "./types";
import { sbSelect, sbInsert, sbUpdate, sbDelete } from "./supabase/client";

/**
 * Outreach data layer (Agency OS sales side). `outreach_messages` are the
 * generated sales comms + thread state for a prospect. The Sales agent (8) drafts
 * them; the operator sends (we don't ship an email provider — zero-dep principle —
 * so a draft is generated for the operator to send, and "mark sent" records it).
 */

interface OutreachRow {
  id: string;
  org_id: string;
  prospect_id: string;
  channel: OutreachChannel;
  direction: OutreachDirection;
  subject: string | null;
  body: string;
  status: OutreachStatus;
  intent: OutreachIntent;
  step: number;
  ai: boolean;
  sent_at: string | null;
  created_at: string;
}

const OUTREACH_COLS =
  "select=id,org_id,prospect_id,channel,direction,subject,body,status,intent,step,ai,sent_at,created_at";

function toOutreach(row: OutreachRow): OutreachMessage {
  return {
    id: row.id,
    orgId: row.org_id,
    prospectId: row.prospect_id,
    channel: row.channel,
    direction: row.direction,
    subject: row.subject,
    body: row.body,
    status: row.status,
    intent: row.intent ?? "initial",
    step: row.step ?? 0,
    ai: row.ai,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

export interface CreateOutreachInput {
  orgId: string;
  prospectId: string;
  channel?: OutreachChannel;
  direction?: OutreachDirection;
  subject?: string | null;
  body: string;
  status?: OutreachStatus;
  intent?: OutreachIntent;
  step?: number;
  ai?: boolean;
}

function rowFromOutreach(input: CreateOutreachInput): Record<string, unknown> {
  return {
    org_id: input.orgId,
    prospect_id: input.prospectId,
    channel: input.channel ?? "email",
    direction: input.direction ?? "outbound",
    subject: input.subject ?? null,
    body: input.body,
    status: input.status ?? "draft",
    intent: input.intent ?? "initial",
    step: input.step ?? 0,
    ai: input.ai ?? false,
  };
}

export async function createOutreachMessage(input: CreateOutreachInput): Promise<OutreachMessage> {
  const row = await sbInsert<OutreachRow>("outreach_messages", rowFromOutreach(input));
  revalidatePath("/admin/prospects");
  return toOutreach(row);
}

/** Persist a whole drafted follow-up sequence (initial → follow-up → final). */
export async function createOutreachSequence(
  messages: CreateOutreachInput[]
): Promise<OutreachMessage[]> {
  const created: OutreachMessage[] = [];
  for (const m of messages) {
    created.push(toOutreach(await sbInsert<OutreachRow>("outreach_messages", rowFromOutreach(m))));
  }
  revalidatePath("/admin/prospects");
  return created;
}

/** All messages for the org (the board groups them by prospect). */
export async function getOutreachForOrg(orgId: string): Promise<OutreachMessage[]> {
  const rows = await sbSelect<OutreachRow>({
    query: `outreach_messages?${OUTREACH_COLS}&org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
    tier: "service",
  });
  return rows.map(toOutreach);
}

export async function getOutreachRecord(id: string): Promise<OutreachMessage | null> {
  const rows = await sbSelect<OutreachRow>({
    query: `outreach_messages?${OUTREACH_COLS}&id=eq.${encodeURIComponent(id)}&limit=1`,
    tier: "service",
  });
  return rows[0] ? toOutreach(rows[0]) : null;
}

/** Mark a drafted message as sent (the operator has dispatched it). */
export async function markOutreachSent(id: string): Promise<OutreachMessage> {
  const [row] = await sbUpdate<OutreachRow>("outreach_messages", `id=eq.${encodeURIComponent(id)}`, {
    status: "sent",
    sent_at: new Date().toISOString(),
  });
  if (!row) throw new Error(`Outreach message ${id} not found.`);
  revalidatePath("/admin/prospects");
  return toOutreach(row);
}

export async function deleteOutreachMessage(id: string): Promise<void> {
  await sbDelete("outreach_messages", `id=eq.${encodeURIComponent(id)}`);
  revalidatePath("/admin/prospects");
}
