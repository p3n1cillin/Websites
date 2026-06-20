import { NextResponse } from "next/server";
import { confirmProposalPaymentBySession } from "@/lib/payments";
import { SITE_URL } from "@/lib/seo";

/**
 * Stripe success redirect for a paid proposal. Stripe sends the buyer here with
 * `?session_id=...`; we verify the session server-side (route handlers may write +
 * revalidate, unlike a page render), close the deal, then bounce to the proposal
 * with a paid confirmation. Works on localhost — no public webhook required.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
): Promise<Response> {
  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (sessionId) {
    await confirmProposalPaymentBySession(sessionId);
  }
  return NextResponse.redirect(`${SITE_URL}/proposal/${params.token}?paid=1`);
}
