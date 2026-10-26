import { NextResponse } from "next/server";
import { parseKitInput } from "@/lib/kit/catalog";
import { generateFreeSample } from "@/lib/kit/content";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendTransactionalEmail, emailConfigured } from "@/lib/email";
import { SITE_URL } from "@/lib/seo";
import { normalizeCategory } from "@/lib/prospects";
import { sbInsert, sbSelect } from "@/lib/supabase/client";

/**
 * POST /api/free-tools/gbp — the free lead-magnet generator: a Google Business
 * Profile description + 3 sample posts. Cheap fast-tier call, bounded per IP and
 * by a per-instance daily ceiling (FREE_TOOL_DAILY_LIMIT) so it can't run up a bill.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DAILY = Math.max(1, Number(process.env.FREE_TOOL_DAILY_LIMIT) || 300);

export async function POST(request: Request) {
  const ip = clientIp(request);
  const perIp = rateLimit(`free-gbp:${ip}`, { limit: 4, windowMs: 24 * 3600_000 });
  if (!perIp.ok) {
    return NextResponse.json(
      { error: "You've used today's free generations. The full kit has a year of posts written for you." },
      { status: 429 }
    );
  }
  const global = rateLimit("free-gbp:global", { limit: DAILY, windowMs: 24 * 3600_000 });
  if (!global.ok) {
    return NextResponse.json({ error: "The free tool is very busy today. Please try again tomorrow." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body.website_url) return NextResponse.json({ error: "Invalid request." }, { status: 400 }); // honeypot

  const parsed = parseKitInput({ ...body, tone: body.tone ?? "friendly" });
  if (!parsed.ok || !parsed.input) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.input;

  try {
    const { content } = await generateFreeSample(input);

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (emailConfigured) {
        sendTransactionalEmail({
          to: email,
          subject: `Your Free Google Business Profile Copy for ${input.businessName}`,
          text: [
            `Hi,`,
            ``,
            `Here is the Google Business Profile copy generated for ${input.businessName}:`,
            ``,
            `=== 750-CHARACTER BUSINESS DESCRIPTION ===`,
            content.description,
            ``,
            `=== 3 SAMPLE GOOGLE POSTS ===`,
            ...content.posts.map((p, i) => `\n[Post #${i + 1}: ${p.title}]\n${p.body}`),
            ``,
            `=== READY TO PUT GOOGLE MAPS ON AUTOPILOT? ===`,
            `Get all 52 dated weekly posts, 15 review replies, and Q&As tailored for ${input.businessName}:`,
            `${SITE_URL}/map-pack-kit?businessName=${encodeURIComponent(input.businessName)}&trade=${encodeURIComponent(input.trade)}&town=${encodeURIComponent(input.town)}&services=${encodeURIComponent(input.services)}#order`,
            ``,
            `Best,`,
            `Empire Agencies`,
          ].join("\n"),
        }).catch((err) => console.error("[free-tool] email send error:", err));
      }

      // Record lead in CRM for follow-up
      sbSelect<{ id: string }>({ query: "orgs?select=id&limit=1", tier: "service" })
        .then(async (orgs) => {
          if (orgs.length > 0) {
            const orgId = orgs[0].id;
            const cat = normalizeCategory(input.trade);
            await sbInsert("prospects", {
              org_id: orgId,
              name: input.businessName,
              category: cat,
              city: input.town,
              email,
              status: "discovered",
              source: { origin: "free_tool_lead", industry: input.trade },
              presence_score: 50,
              opportunity_score: 85,
              value_estimate: 2900,
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    return NextResponse.json({ result: content });
  } catch (err) {
    console.error("[free-tool] generation failed:", err);
    return NextResponse.json({ error: "Something went wrong generating your copy. Please try again." }, { status: 500 });
  }
}
