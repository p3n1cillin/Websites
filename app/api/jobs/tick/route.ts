import { NextResponse } from "next/server";
import { tick } from "@/lib/jobs/worker";
import { supabaseWritable } from "@/lib/supabase/client";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Job worker tick — drains due agent jobs from the queue. Scheduled via
 * vercel.json (every minute) and triggerable manually for testing.
 *
 * Like /api/cron/seo, this route is NOT under the auth middleware, so the shared
 * CRON_SECRET is the only gate (Bearer token from Vercel Cron, or ?secret= for
 * manual runs).
 *
 *   GET /api/jobs/tick            (Authorization: Bearer <CRON_SECRET>)
 *   GET /api/jobs/tick?secret=... (manual)
 */
async function handle(request: Request): Promise<Response> {
  // Throttle so the shared secret can't be brute-forced at speed.
  const limit = rateLimit(`jobs:${clientIp(request)}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const fromHeader = header.replace(/^Bearer\s+/i, "");
  const fromQuery = new URL(request.url).searchParams.get("secret");
  if (fromHeader !== secret && fromQuery !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!supabaseWritable) {
    return NextResponse.json(
      { error: "Job queue requires SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const result = await tick();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
