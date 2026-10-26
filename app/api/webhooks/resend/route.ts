import { NextResponse } from "next/server";
import { supabaseWritable } from "@/lib/supabase/client";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findProspectByEmail, updateProspectStatus } from "@/lib/prospects";
import { createInboundOutreach } from "@/lib/outreach";
import { PROSPECT_STATUSES } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resend Inbound Email receiver — closes the reply loop.
 *
 * When a prospect replies to outreach, Resend forwards the email here; we match
 * the sender to a prospect, record the reply as an inbound `outreach_messages`
 * row (so the thread is visible in the CRM), and advance the prospect to
 * `responded` — which stops the follow-up cadence from chasing someone who has
 * already answered.
 *
 * Safety: gated by RESEND_INBOUND_SECRET (Bearer or ?secret=), same pattern as
 * the automation tick. FORWARD-ONLY status moves: a reply never regresses a
 * prospect out of negotiating/won/lost. Unknown senders are ignored (202) rather
 * than erroring — inbound noise must not look like an outage.
 */

/** "Name <addr@host>" | "<addr@host>" | "addr@host" → "addr@host". */
function extractAddress(from: string): string {
  const angled = from.match(/<([^>]+)>/);
  return (angled ? angled[1] : from).trim();
}

async function handle(request: Request): Promise<Response> {
  const limit = rateLimit(`resend-inbound:${clientIp(request)}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const secret = process.env.RESEND_INBOUND_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RESEND_INBOUND_SECRET is not configured." }, { status: 500 });
  }
  const header = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const fromQuery = new URL(request.url).searchParams.get("secret");
  if (header !== secret && fromQuery !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!supabaseWritable) {
    return NextResponse.json({ error: "Reply capture requires SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  let payload: { from?: string; subject?: string; text?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sender = payload.from ? extractAddress(payload.from) : "";
  const prospect = sender ? await findProspectByEmail(sender) : null;
  if (!prospect) {
    // Not a (known) prospect — accept silently so Resend doesn't retry forever.
    return NextResponse.json({ ok: true, matched: false });
  }

  // Record the real reply in the thread.
  await createInboundOutreach({
    orgId: prospect.orgId,
    prospectId: prospect.id,
    subject: payload.subject ?? null,
    body: (payload.text ?? "").trim() || "(empty body)",
  });

  // Advance forward-only to `responded`.
  const cur = PROSPECT_STATUSES.indexOf(prospect.status);
  const target = PROSPECT_STATUSES.indexOf("responded");
  let advanced = false;
  if (cur >= 0 && cur < target && prospect.status !== "lost") {
    await updateProspectStatus(prospect.id, "responded");
    advanced = true;
  }

  return NextResponse.json({ ok: true, matched: true, prospectId: prospect.id, advanced });
}

export const GET = handle;
export const POST = handle;
