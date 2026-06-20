import { NextResponse } from "next/server";
import { getActivePreviewByToken } from "@/lib/previews";
import { recordPreviewEvent } from "@/lib/preview-analytics";
import type { PreviewEventType } from "@/lib/types";

/**
 * Public, best-effort analytics beacon for tokenised demos (Phase 3). The demo
 * page (PreviewAnalytics) POSTs { token, type, label?, path?, valueMs? } on view,
 * dwell and conversion clicks. The token is the capability — we resolve it to the
 * preview server-side and record the event. Always returns 204; never throws.
 */
export const runtime = "nodejs";

const VALID: PreviewEventType[] = ["view", "dwell", "click", "conversion"];

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { token?: string; type?: string; label?: string; path?: string; valueMs?: number }
      | null;
    const token = body?.token?.trim();
    const type = body?.type as PreviewEventType | undefined;
    if (!token || !type || !VALID.includes(type)) {
      return new NextResponse(null, { status: 204 });
    }
    const preview = await getActivePreviewByToken(token);
    if (preview) {
      await recordPreviewEvent({
        orgId: preview.orgId,
        previewId: preview.id,
        type,
        label: body?.label ?? null,
        path: body?.path ?? null,
        valueMs: typeof body?.valueMs === "number" ? Math.min(body.valueMs, 3_600_000) : null,
      });
    }
  } catch {
    /* swallow — analytics must never error a public surface */
  }
  return new NextResponse(null, { status: 204 });
}
