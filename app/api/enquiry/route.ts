import { NextResponse } from "next/server";
import { getBusinessBySlug, getBusinessRefBySlug } from "@/lib/businesses";
import { createLead } from "@/lib/leads";
import { sendLeadNotification } from "@/lib/email";
import { supabaseWritable } from "@/lib/supabase/client";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getExperimentsForBusiness, incrementMetric } from "@/lib/experiments";

export const runtime = "nodejs";

// Cap form submissions per IP — a public, unauthenticated write path.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

interface EnquiryPayload {
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  message?: string;
  preferredDate?: string;
  businessSlug?: string;
  businessName?: string;
  type?: "enquiry" | "booking";
  company?: string; // honeypot
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Read the `expv` A/B assignment cookie (map of experimentId → variantId). */
function parseExpCookie(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const m = cookieHeader.match(/(?:^|;\s*)expv=([^;]+)/);
  if (!m) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(m[1])) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  // Throttle abusive senders before doing any work.
  const limit = rateLimit(`enquiry:${clientIp(request)}`, {
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit, RATE_LIMIT) }
    );
  }

  let payload: EnquiryPayload;
  try {
    payload = (await request.json()) as EnquiryPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Silently accept honeypot hits so bots think they succeeded.
  if (payload.company) {
    return NextResponse.json({ ok: true });
  }

  const errors: string[] = [];
  if (!payload.name?.trim()) errors.push("Name is required.");
  if (!payload.phone?.trim()) errors.push("Phone is required.");
  if (!payload.email?.trim() || !EMAIL_RE.test(payload.email)) {
    errors.push("A valid email is required.");
  }
  if (!payload.businessSlug?.trim()) errors.push("Missing business reference.");

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 422 });
  }

  const business = await getBusinessBySlug(payload.businessSlug as string);
  if (!business) {
    return NextResponse.json(
      { error: "Unknown business." },
      { status: 404 }
    );
  }

  const lead = {
    receivedAt: new Date().toISOString(),
    type: payload.type ?? "enquiry",
    business: { slug: business.slug, name: business.name, email: business.email },
    contact: {
      name: payload.name?.trim(),
      email: payload.email?.trim(),
      phone: payload.phone?.trim(),
    },
    details: {
      service: payload.service?.trim() || "Not specified",
      preferredDate: payload.preferredDate || null,
      message: payload.message?.trim() || "",
    },
  };

  // Persist the lead + notify the business when Supabase is configured. The
  // public read returns only the Business data, so resolve its DB id by slug.
  if (supabaseWritable) {
    const ref = await getBusinessRefBySlug(business.slug);
    if (ref) {
      try {
        await createLead({
          businessId: ref.id,
          type: lead.type,
          name: lead.contact.name as string,
          email: lead.contact.email,
          phone: lead.contact.phone as string,
          service: lead.details.service,
          message: lead.details.message,
          preferredDate: lead.details.preferredDate,
          sourcePath: request.headers.get("referer"),
        });
      } catch (err) {
        // Don't fail the visitor's submission if persistence hiccups.
        console.error("[enquiry] lead persistence failed:", err);
      }

      // A lead IS the conversion event — credit it to this business's running A/B
      // experiments the visitor was bucketed into (from the `expv` cookie). Best-
      // effort: a tracking hiccup must never affect lead capture.
      try {
        const assignments = parseExpCookie(request.headers.get("cookie"));
        const ids = Object.keys(assignments);
        if (ids.length > 0) {
          const running = (await getExperimentsForBusiness(ref.id)).filter(
            (e) => e.status === "running"
          );
          const runningIds = new Set(running.map((e) => e.id));
          for (const expId of ids) {
            if (runningIds.has(expId)) {
              await incrementMetric(expId, assignments[expId], "conversions");
            }
          }
        }
      } catch (err) {
        console.error("[enquiry] conversion attribution failed:", err);
      }

      await sendLeadNotification({
        to: ref.email,
        businessName: ref.name,
        type: lead.type,
        name: lead.contact.name as string,
        phone: lead.contact.phone as string,
        email: lead.contact.email,
        service: lead.details.service,
        message: lead.details.message,
        preferredDate: lead.details.preferredDate ?? undefined,
      });
    }
  }

  // Forward to a webhook (email service, CRM, Zapier, Slack…) if configured.
  const webhook = process.env.ENQUIRY_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch (err) {
      // Never lose the lead because of a webhook failure — log and continue.
      console.error("[enquiry] webhook delivery failed:", err);
    }
  } else {
    // No webhook configured: still a fully working endpoint — record the lead.
    console.info("[enquiry] new lead received:", JSON.stringify(lead));
  }

  return NextResponse.json({ ok: true });
}
