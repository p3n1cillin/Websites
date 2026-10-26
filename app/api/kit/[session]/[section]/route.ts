import { NextResponse } from "next/server";
import { isSectionId } from "@/lib/kit/catalog";
import { fulfilSection, getPaidKitOrder } from "@/lib/kit/order";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/kit/<sessionId>/<section>[?regenerate=1]
 * Generates (or returns the stored) section for a PAID Map Pack Kit order. The
 * client kit page calls this per missing section so each request stays short.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ session: string; section: string }> }
) {
  const { session, section } = await params;
  const rl = rateLimit(`kit:${clientIp(request)}`, { limit: 40, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ status: "error", message: "Too many requests, slow down." }, { status: 429 });
  if (!isSectionId(section)) return NextResponse.json({ status: "error", message: "Unknown section." }, { status: 404 });

  const order = await getPaidKitOrder(session);
  if (!order) return NextResponse.json({ status: "error", message: "Order not found or not paid." }, { status: 404 });

  const regenerate = new URL(request.url).searchParams.get("regenerate") === "1";
  const result = await fulfilSection(order, section, { regenerate });
  const code = result.status === "ready" ? 200 : result.status === "busy" ? 202 : 500;
  return NextResponse.json(result, { status: code });
}
