/**
 * Transactional email via Resend's REST API — no npm package, optional.
 * If RESEND_API_KEY is unset, sending is skipped (the caller still persists the
 * lead and forwards any webhook), so the system stays fully functional.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.LEAD_NOTIFY_FROM || "Leads <onboarding@resend.dev>";
// The address outreach is SENT FROM — must be on a Resend-verified domain to reach
// real prospects. Falls back to Resend's shared test sender (own-account only) when
// unset. Set OUTREACH_FROM_EMAIL=you@yourdomain.com once your domain is verified.
const OUTREACH_FROM_EMAIL = process.env.OUTREACH_FROM_EMAIL || "onboarding@resend.dev";
// Where prospect replies land (your inbox). Optional.
const OUTREACH_REPLY_TO = process.env.OUTREACH_REPLY_TO || process.env.NEXT_PUBLIC_BRAND_EMAIL;

export const emailConfigured = Boolean(RESEND_API_KEY);

export interface LeadEmail {
  to: string;
  businessName: string;
  type: "enquiry" | "booking";
  name: string;
  phone: string;
  email?: string;
  service?: string;
  message?: string;
  preferredDate?: string;
}

export async function sendLeadNotification(lead: LeadEmail): Promise<void> {
  if (!RESEND_API_KEY) return;

  const subject = `New ${lead.type} for ${lead.businessName} — ${lead.name}`;
  const lines = [
    `<h2>New ${lead.type}</h2>`,
    `<p><strong>Name:</strong> ${esc(lead.name)}</p>`,
    `<p><strong>Phone:</strong> ${esc(lead.phone)}</p>`,
    lead.email ? `<p><strong>Email:</strong> ${esc(lead.email)}</p>` : "",
    lead.service ? `<p><strong>Service:</strong> ${esc(lead.service)}</p>` : "",
    lead.preferredDate ? `<p><strong>Preferred date:</strong> ${esc(lead.preferredDate)}</p>` : "",
    lead.message ? `<p><strong>Message:</strong><br/>${esc(lead.message)}</p>` : "",
  ].filter(Boolean);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [lead.to],
        reply_to: lead.email,
        subject,
        html: lines.join("\n"),
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend send failed:", res.status, await safeText(res));
    }
  } catch (err) {
    // Never lose the lead because email failed.
    console.error("[email] Resend send threw:", err);
  }
}

/**
 * Send a drafted outreach message to a PROSPECT (acquisition). Returns true only
 * when Resend accepted it. No key / no recipient → false (caller falls back to the
 * manual "mark sent" flow), so the funnel still works without email configured.
 */
export async function sendOutreachEmail(input: {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
}): Promise<boolean> {
  if (!RESEND_API_KEY || !input.to) return false;
  const from = input.fromName ? `${input.fromName} <${OUTREACH_FROM_EMAIL}>` : FROM;
  // Plain-text body → simple HTML (preserve line breaks).
  const html = input.body.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`).join("\n");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        reply_to: OUTREACH_REPLY_TO || undefined,
        subject: input.subject,
        html,
        text: input.body,
      }),
    });
    if (!res.ok) {
      console.error("[email] outreach send failed:", res.status, await safeText(res));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] outreach send threw:", err);
    return false;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
