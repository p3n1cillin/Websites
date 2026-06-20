/**
 * Taste layer — anti-slop copy rules + a deterministic taste linter.
 *
 * Distilled from the `design-taste-frontend` skill (.claude/skills/) into the two
 * forms this data-driven pipeline can actually use:
 *
 *   1. TASTE_COPY_RULES — a compact system-prompt fragment injected into the AI
 *      content steps (the Prospecting Industry Profiler writes the real client
 *      copy; the Design agent writes the art-direction note). Keeps generated copy
 *      concrete and specific rather than templated "AI slop".
 *   2. tasteFindings(business) — a pure, dependency-free linter the QA gate runs so
 *      copy that trips the skill's forbidden patterns (cheap meta-labels, clichés,
 *      em-dash flourishes, emoji, bloated headlines) scores lower and is regenerated.
 *
 * The skill's code-level rules (Motion/GSAP, bespoke React, webfonts) don't apply
 * here — sites render from data through fixed, zero-dep components — so only the
 * copy/structure rules that survive that translation are encoded.
 */

import type { Business } from "@/lib/types";

/**
 * Copy rules, ready to append to a content-generation system prompt. Phrased for an
 * AI writing local-business website copy — the Prospecting Industry Profiler.
 */
export const TASTE_COPY_RULES = `Write with taste — actively avoid generic, templated "AI slop":
- Be concrete and specific to THIS business and town. No filler, hedging or padding.
- Headlines and the tagline are punchy and short: one strong line, never a long multi-clause sentence that would wrap to many lines.
- Banned clichés — say the real, specific thing instead: "we pride ourselves", "second to none", "one-stop shop", "wide range of", "state-of-the-art", "cutting-edge", "best-in-class", "top-notch", "passionate about", "your trusted partner", "look no further", "nestled", "hassle-free", "unparalleled".
- No cheap meta-labels as heading text ("Section 01", "Feature 1", "Step 02"); headings must carry real meaning.
- No em-dashes as a stylistic flourish; use plain punctuation.
- No emoji anywhere in the copy.
- Vary sentence structure and rhythm — don't open every service description the same way.
- Never invent awards, named accreditations, review counts or specific prices you can't know.`;

/**
 * One-line design directive for the art-direction prompt — keeps the rationale (and
 * the human reading it) anchored to anti-slop, anti-templated thinking.
 */
export const TASTE_DESIGN_NOTE =
  "Favour a distinctive, non-templated direction with confident typography and generous spacing; avoid the generic three-equal-cards, centered-everything default.";

// --- Deterministic taste linter ----------------------------------------------

/** Clichés the skill bans outright (case-insensitive substring match). */
const CLICHES = [
  "we pride ourselves",
  "second to none",
  "one-stop shop",
  "one stop shop",
  "wide range of",
  "state-of-the-art",
  "state of the art",
  "cutting-edge",
  "cutting edge",
  "best-in-class",
  "best in class",
  "top-notch",
  "top notch",
  "passionate about",
  "your trusted partner",
  "look no further",
  "hassle-free",
  "hassle free",
  "unparalleled",
];

/** Cheap meta-label headings, e.g. "Section 01", "Feature 1", "Step 02". */
const META_LABEL = /\b(section|step|feature|item|question|chapter|part|no)\.?\s*0*\d+\b/i;

/** A rough emoji / pictograph range (zero-dep, no Unicode property tables needed). */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

const EM_DASH = /—/; // — used as flourish

function words(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Lint a Business's copy against the taste rules. Pure + deterministic — returns
 * human-readable findings (empty = clean). The QA gate turns these into a content
 * penalty so slop copy fails the gate and is regenerated.
 */
export function tasteFindings(b: Business): string[] {
  const findings: string[] = [];

  // Short copy where headline discipline matters most.
  const headings: string[] = [
    b.tagline,
    b.primaryService,
    ...b.services.map((s) => s.name),
    ...(b.highlights?.items.map((h) => h.title) ?? []),
  ].filter(Boolean) as string[];

  // Longer prose — scanned for clichés, emoji, meta-labels (not length).
  const prose: string[] = [
    b.about,
    ...b.services.map((s) => s.description),
    ...(b.highlights?.items.map((h) => h.description) ?? []),
    ...(b.faqs?.map((f) => `${f.question} ${f.answer}`) ?? []),
  ].filter(Boolean) as string[];

  const all = [...headings, ...prose];
  const haystack = all.join(" \n ").toLowerCase();

  // Bloated headline → would wrap to many lines (skill bans 6-line headings).
  if (words(b.tagline) > 12) {
    findings.push(`Tagline is long (${words(b.tagline)} words) — make it one punchy line.`);
  }

  // Cliché slop.
  const hits = CLICHES.filter((c) => haystack.includes(c));
  if (hits.length) findings.push(`Generic cliché copy: "${hits.slice(0, 3).join('", "')}".`);

  // Cheap meta-labels in headings.
  if (headings.some((h) => META_LABEL.test(h))) {
    findings.push('Cheap meta-label headings ("Section 01"-style) — headings should carry meaning.');
  }

  // Em-dash flourish in short copy.
  if (headings.some((h) => EM_DASH.test(h))) {
    findings.push("Em-dash used as a flourish in headline copy — use plain punctuation.");
  }

  // Emoji anywhere.
  if (all.some((t) => EMOJI.test(t))) {
    findings.push("Emoji in copy — remove for a cleaner, professional tone.");
  }

  return findings;
}
