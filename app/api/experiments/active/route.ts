import { NextResponse } from "next/server";
import { getBusinessRefBySlug } from "@/lib/businesses";
import { getRunningExperiment } from "@/lib/experiments";
import { EXPERIMENT_SLOTS, type ExperimentSlot } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Public: the running experiment for a business + slot, so the live site can bucket
 * a visitor client-side (see components/site/ExperimentText). Returns only what the
 * client needs (variant id + text + control flag) — never the counters. Degrades to
 * `{ experiment: null }` on any error, so the public page is never affected.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("business")?.trim();
    const slot = searchParams.get("slot") as ExperimentSlot | null;
    if (!slug || !slot || !EXPERIMENT_SLOTS.includes(slot)) {
      return NextResponse.json({ experiment: null });
    }

    const ref = await getBusinessRefBySlug(slug);
    if (!ref) return NextResponse.json({ experiment: null });

    const exp = await getRunningExperiment(ref.id, slot);
    if (!exp) return NextResponse.json({ experiment: null });

    return NextResponse.json(
      {
        experiment: {
          id: exp.id,
          slot: exp.slot,
          variants: exp.variants.map((v) => ({ id: v.id, text: v.text, control: v.control })),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ experiment: null });
  }
}
