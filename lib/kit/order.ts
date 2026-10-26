/**
 * Map Pack Kit — order lookup + idempotent section fulfilment.
 *
 * The Stripe Checkout session IS the order: its id is the capability token in the
 * customer's kit URL (/kit/<cs_...>), its metadata holds the inputs, and
 * `payment_status` proves payment. Nothing is generated unless Stripe says paid
 * (or `no_payment_required`, e.g. a 100%-off launch/promo code).
 */

import { getCheckoutSession, stripeConfigured } from "../stripe";
import { emailConfigured, sendTransactionalEmail } from "../email";
import { SITE_URL } from "../seo";
import { TIERS, isTier, parseKitInput, type KitInput, type KitTier, type SectionId } from "./catalog";
import { generateSection, type StoredSection } from "./content";
import { getKitJson, putKitJson } from "./storage";

export interface KitOrder {
  sessionId: string;
  tier: KitTier;
  input: KitInput;
  email: string | null;
  orderDate: Date;
  amountPence: number;
  livemode: boolean;
}

const SESSION_RE = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
export const isSessionId = (v: string) => SESSION_RE.test(v);

const orderCache = new Map<string, { at: number; order: KitOrder }>();
const ORDER_TTL = 10 * 60_000;

/** Resolve a PAID kit order from Stripe, or null (unknown / unpaid / not a kit). */
export async function getPaidKitOrder(sessionId: string): Promise<KitOrder | null> {
  if (!isSessionId(sessionId) || !stripeConfigured) return null;
  const hit = orderCache.get(sessionId);
  if (hit && Date.now() - hit.at < ORDER_TTL) return hit.order;
  try {
    const s = await getCheckoutSession(sessionId);
    const md = s.metadata ?? {};
    if (md.kind !== "map_pack_kit") return null;
    if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") return null;
    const parsed = parseKitInput(md);
    if (!parsed.ok || !parsed.input) return null;
    const order: KitOrder = {
      sessionId,
      tier: isTier(md.tier ?? "") ? (md.tier as KitTier) : "starter",
      input: parsed.input,
      email: s.customer_details?.email ?? s.customer_email ?? null,
      orderDate: new Date((s.created ?? Date.now() / 1000) * 1000),
      amountPence: s.amount_total ?? 0,
      livemode: Boolean(s.livemode),
    };
    orderCache.set(sessionId, { at: Date.now(), order });
    return order;
  } catch {
    return null;
  }
}

const sectionPath = (sessionId: string, section: SectionId) => `orders/${sessionId}/${section}.json`;
const lockPath = (sessionId: string, section: SectionId) => `orders/${sessionId}/${section}.lock.json`;

/** All stored sections for an order (missing ones omitted). */
export async function loadKitSections(order: KitOrder): Promise<Partial<Record<SectionId, StoredSection>>> {
  const ids = TIERS[order.tier].sections;
  const rows = await Promise.all(ids.map((id) => getKitJson<StoredSection>(sectionPath(order.sessionId, id))));
  const out: Partial<Record<SectionId, StoredSection>> = {};
  ids.forEach((id, i) => {
    if (rows[i]) out[id] = rows[i]!;
  });
  return out;
}

export const MAX_REGENS = 2;
const LOCK_MS = 75_000;

export type FulfilResult =
  | { status: "ready"; section: StoredSection }
  | { status: "busy" }
  | { status: "error"; message: string };

/**
 * Generate + store one section if it doesn't exist (or regenerate within the cap).
 * Idempotent: an existing section is returned without another model call, and a
 * short-lived lock stops concurrent tabs paying twice for the same section.
 */
export async function fulfilSection(
  order: KitOrder,
  section: SectionId,
  opts: { regenerate?: boolean } = {}
): Promise<FulfilResult> {
  if (!TIERS[order.tier].sections.includes(section)) {
    return { status: "error", message: "That section isn't part of this kit." };
  }
  const existing = await getKitJson<StoredSection>(sectionPath(order.sessionId, section));
  if (existing && !opts.regenerate) return { status: "ready", section: existing };
  if (existing && opts.regenerate && existing.regens >= MAX_REGENS) {
    return { status: "error", message: `This section has already been regenerated ${MAX_REGENS} times.` };
  }

  const lock = await getKitJson<{ at: number }>(lockPath(order.sessionId, section));
  if (lock && Date.now() - lock.at < LOCK_MS) return { status: "busy" };
  await putKitJson(lockPath(order.sessionId, section), { at: Date.now() });

  try {
    const { content, usage } = await generateSection(section, order.input, order.orderDate);
    const stored: StoredSection = {
      id: section,
      generatedAt: new Date().toISOString(),
      model: usage.model,
      costPence: usage.costPence + (existing?.costPence ?? 0),
      regens: existing ? existing.regens + 1 : 0,
      content,
    };
    await putKitJson(sectionPath(order.sessionId, section), stored);
    await putKitJson(lockPath(order.sessionId, section), { at: 0 });
    if (section === "profile" && !existing) await sendKitReadyEmail(order);
    return { status: "ready", section: stored };
  } catch (err) {
    await putKitJson(lockPath(order.sessionId, section), { at: 0 }).catch(() => {});
    console.error(`[kit] section ${section} failed for ${order.sessionId}:`, err);
    return { status: "error", message: "Generation hit a snag. Please try again." };
  }
}

export const kitUrl = (sessionId: string) => `${SITE_URL}/kit/${sessionId}`;

/** Email the buyer their permanent kit link (best-effort; needs RESEND_API_KEY). */
async function sendKitReadyEmail(order: KitOrder): Promise<void> {
  if (!emailConfigured || !order.email) return;
  try {
    const url = kitUrl(order.sessionId);
    await sendTransactionalEmail({
      to: order.email,
      subject: `Your Map Pack Kit for ${order.input.businessName} is ready`,
      text: [
        `Hi,`,
        ``,
        `Thanks for your order. Your ${TIERS[order.tier].name} for ${order.input.businessName} is ready here:`,
        url,
        ``,
        `Bookmark that link: it's your permanent copy. You can copy each piece straight into your Google Business Profile, download everything as a text file, or print it.`,
        ``,
        `Any questions, just reply to this email.`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("[kit] ready email failed:", err);
  }
}
