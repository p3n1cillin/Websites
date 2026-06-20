import { NextResponse } from "next/server";
import { supabaseWritable } from "@/lib/supabase/client";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { listEnabledWorkflowsAllOrgs } from "@/lib/workflows";
import { executeWorkflowForSeed, prospectEntryStatus } from "@/lib/workflow-engine";
import { getProspectsForOrg } from "@/lib/prospects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Automation tick — the unattended layer of Automation Modes. For every ENABLED
 * workflow, it runs the pipeline over a few eligible prospects (those in the status
 * its first step consumes), so the find→build→sell loop advances with no human in
 * the loop. Pipeline steps advance prospect status, so work isn't re-done.
 *
 * Safety: bounded per tick, and every agent step still runs through `runAgent` —
 * so per-agent autonomy gates and spend caps apply. An `approve` step pauses its
 * run for a human rather than acting. NOT under auth middleware; CRON_SECRET gates
 * it (Bearer from Vercel Cron, or ?secret= for manual runs).
 */
const MAX_PER_WORKFLOW = 5;

async function handle(request: Request): Promise<Response> {
  const limit = rateLimit(`automation:${clientIp(request)}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  const header = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const fromQuery = new URL(request.url).searchParams.get("secret");
  if (header !== secret && fromQuery !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!supabaseWritable) {
    return NextResponse.json({ error: "Automation requires SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  const workflows = await listEnabledWorkflowsAllOrgs();
  let runs = 0;
  for (const wf of workflows) {
    const status = prospectEntryStatus(wf);
    if (!status || wf.steps.length === 0) continue;
    // getProspectsForOrg is ordered by opportunity desc — chase the best first.
    const eligible = (await getProspectsForOrg(wf.orgId))
      .filter((p) => p.status === status)
      .slice(0, MAX_PER_WORKFLOW);
    for (const p of eligible) {
      try {
        await executeWorkflowForSeed(wf, wf.orgId, { prospectId: p.id });
        runs += 1;
      } catch {
        /* one prospect failing must not stop the tick */
      }
    }
  }

  return NextResponse.json({ ok: true, workflows: workflows.length, runs });
}

export const GET = handle;
export const POST = handle;
