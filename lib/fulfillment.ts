import type { Business } from "./types";
import { hasPhone, hasEmail, hasAddress } from "./utils";

/**
 * Fulfillment / Launch-Readiness Engine (MASTER_OS — Fulfillment + QA + Deployment:
 * "nothing launches until QA passes"; manage onboarding → asset collection →
 * production → launch).
 *
 * Deterministic + dependency-free (Cost Control: code before AI — zero tokens). Turns
 * a won client's real state into a launch checklist: which steps are done, which are
 * BLOCKERS (must pass before go-live), and whether the site is ready to publish. Keeps
 * delivery honest — a site can't be "launched" with unverified facts or thin content.
 */

export interface ChecklistItem {
  label: string;
  done: boolean;
  /** A blocker must be done before launch; non-blockers are nice-to-have. */
  blocker: boolean;
  hint?: string;
}

export interface LaunchChecklist {
  businessId: string;
  items: ChecklistItem[];
  blockersRemaining: number;
  /** All blockers cleared → safe to publish. */
  readyToLaunch: boolean;
  /** Already live to the public. */
  live: boolean;
  /** 0–100 completion across all items. */
  progressPct: number;
}

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export interface LaunchInputs {
  businessId: string;
  business: Business;
  published: boolean;
  portalActive: boolean;
  customDomain?: string | null;
}

/** Build the launch-readiness checklist for a won client. Pure + deterministic. */
export function buildLaunchChecklist(input: LaunchInputs): LaunchChecklist {
  const b = input.business;
  const items: ChecklistItem[] = [];
  const add = (label: string, done: boolean, blocker: boolean, hint?: string) =>
    items.push({ label, done, blocker, hint });

  // Onboarding — client portal open for access + change requests.
  add("Client portal opened", input.portalActive, false, "Open the portal so the client can review + request changes.");

  // Asset collection / verified facts — the data-integrity gate. Blockers: a live
  // client site must carry their REAL contact details, never placeholders.
  add("Phone number verified", hasPhone(b), true, "Collect + confirm the client's real phone number.");
  add("Email collected", hasEmail(b), true, "Collect the client's real enquiry email.");
  add("Address / service area set", hasAddress(b) || (b.serviceAreas?.length ?? 0) > 0, true, "Confirm their address or the areas they serve.");

  // Production / content completeness — QA gate (no thin or empty site goes live).
  add("3+ services listed", (b.services?.length ?? 0) >= 3, true, "Add at least three services for a credible site.");
  add("About copy written", wordCount(b.about ?? "") >= 40, true, "Write a substantial About section (60+ words).");
  add("Opening hours set", (b.openingHours?.length ?? 0) > 0, false, "Add opening hours for trust + local SEO.");
  add("FAQs added", (b.faqs?.length ?? 0) > 0, false, "Add FAQs to answer common questions + win long-tail SEO.");
  add("Real reviews shown", (b.testimonials?.length ?? 0) > 0, false, "Add real customer reviews when available (never fabricate).");

  // Deployment.
  add("Site published", input.published, false, "Publish the site once all blockers are cleared.");
  add("Custom domain connected", Boolean(input.customDomain), false, "Connect the client's own domain for a professional URL.");

  const blockersRemaining = items.filter((i) => i.blocker && !i.done).length;
  const doneCount = items.filter((i) => i.done).length;
  return {
    businessId: input.businessId,
    items,
    blockersRemaining,
    readyToLaunch: blockersRemaining === 0,
    live: input.published,
    progressPct: Math.round((doneCount / items.length) * 100),
  };
}
