import { NextResponse } from "next/server";
import { getAllPublishedRecords } from "@/lib/businesses";
import { runSeoGeneration } from "@/lib/blog";
import { supabaseWritable } from "@/lib/supabase/client";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SEO-automation cron — generates a fresh batch of locally-targeted articles for
 * every published business, nightly. Idempotent (skips slugs that already exist),
 * so a missed or repeated run is harmless.
 *
 * Scheduled via vercel.json. Vercel Cron sends a GET with
 * `Authorization: Bearer ${CRON_SECRET}`; we also accept `?secret=` for manual
 * triggers (curl / external schedulers). This route is NOT under the auth
 * middleware, so the shared secret is the only gate.
 *
 *   GET /api/cron/seo            (Authorization: Bearer <CRON_SECRET>)
 *   GET /api/cron/seo?secret=... (manual)
 */
async function handle(request: Request): Promise<Response> {
  // Throttle attempts so the shared secret can't be brute-forced at speed.
  const limit = rateLimit(`cron:${clientIp(request)}`, { limit: 10, windowMs: 60_000 });
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
      { error: "SEO generation requires SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const records = await getAllPublishedRecords();
  const result = await runSeoGeneration(records);

  return NextResponse.json({
    ok: true,
    businesses: records.length,
    created: result.created,
    perBusiness: result.perBusiness,
  });
}

export const GET = handle;
export const POST = handle;
