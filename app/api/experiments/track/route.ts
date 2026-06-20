import { NextResponse } from "next/server";
import { incrementMetric } from "@/lib/experiments";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// A public write path — throttle per IP. Impressions are also deduped per visitor
// client-side, so legitimate traffic stays well under this.
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

interface TrackPayload {
  experimentId?: string;
  variantId?: string;
  type?: "impression" | "conversion";
}

/**
 * Public: record an A/B impression or conversion. Best-effort and capability-free
 * — the worst a bad actor can do is skew one experiment's counts, which only the
 * owning operator ever sees. incrementMetric validates the experiment is running.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`exp:${clientIp(request)}`, { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS });
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429 });

  let payload: TrackPayload;
  try {
    payload = (await request.json()) as TrackPayload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { experimentId, variantId, type } = payload;
  if (!experimentId || !variantId || (type !== "impression" && type !== "conversion")) {
    return NextResponse.json({ ok: false }, { status: 422 });
  }

  await incrementMetric(experimentId, variantId, type === "impression" ? "impressions" : "conversions");
  return NextResponse.json({ ok: true });
}
