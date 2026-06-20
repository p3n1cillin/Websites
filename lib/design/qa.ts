/**
 * QA scoring — the automated gate (Agent 4) every generated site passes through
 * before it can be used. See docs/AGENCY_OS.md §4.4 + §10 (Phase C).
 *
 * Scoring is deterministic and dependency-free so it runs identically in the build,
 * in tests, and with no AI key — the same input always yields the same report. Four
 * sub-scores roll up to an overall 0–100, gated against a threshold:
 *
 *   completeness — does the Business have the content a credible site needs?
 *   content      — is the copy substantial and varied (not thin/placeholder)?
 *   design       — is the DNA internally coherent (palette/type/layout)?
 *   uniqueness   — is the copy meaningfully different from sibling sites?
 *
 * A candidate that scores below threshold (or trips the near-duplicate guard) fails
 * and should be regenerated. The QA agent (lib/agents/qa.ts) wraps this.
 */

import type { Business } from "@/lib/types";
import type { DesignDNA } from "./types";
import { similarityAgainst, type SimilarityHit } from "./uniqueness";
import { tasteFindings } from "./taste";

export interface QaScores {
  completeness: number;
  content: number;
  design: number;
  uniqueness: number;
  /** Data integrity ("never fake") — 100 = no fabrication; <100 hard-fails. */
  integrity: number;
}

export interface QaReport {
  overall: number;
  pass: boolean;
  threshold: number;
  scores: QaScores;
  /** Closest sibling site by content, if any were compared. */
  nearest: SimilarityHit | null;
  /** Human-readable findings (failures first), shown in the factory QA panel. */
  notes: string[];
}

/** Default pass mark. A candidate must clear this AND the duplicate guard. */
export const QA_THRESHOLD = 75;

/** Content this close to a sibling site is treated as a near-duplicate → fail. */
const DUPLICATE_LIMIT = 0.55;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function scoreCompleteness(b: Business, notes: string[]): number {
  let score = 100;
  const penalise = (cond: boolean, points: number, note: string) => {
    if (cond) {
      score -= points;
      notes.push(note);
    }
  };
  // Completeness scores the MARKETING content the template always supplies. It no
  // longer penalises missing facts (testimonials / contact / hours) — absence of an
  // unverifiable fact is honest, not a quality defect, and penalising it is what
  // pressured the generator into fabricating. Those are surfaced separately as
  // "needs verification" (see scoreIntegrity + the admin checklist), not as score loss.
  penalise(b.services.length < 3, 24, `Only ${b.services.length} service(s) — aim for 3+.`);
  penalise(b.badges.length < 2, 14, "Few trust badges — add credentials/guarantees.");
  penalise(!b.heroImage, 10, "No hero image — a category default will be used.");
  penalise(!b.established, 6, "No established year (used in trust copy).");
  return clamp(score);
}

/** Authors used by the legacy per-category templates — a fabrication fingerprint. */
const TEMPLATE_TESTIMONIAL_AUTHORS = new Set(
  [
    "Sarah M.", "David R.", "Mark T.", "James P.", "Emma L.", "Tom H.", "Rachel S.",
    "Gary W.", "Nicola B.", "Paul D.", "Helen C.", "Steve M.", "Laura K.", "Michael F.",
    "Andrew P.", "Karen S.", "Sophie A.", "Chloe R.", "Brian H.", "Diane M.",
    "Hannah W.", "Daniel O.", "Claire B.", "Mark E.",
  ].map((a) => a.toLowerCase())
);
/** Placeholder phone numbers that must never reach a client-facing site. */
const FAKE_PHONES = new Set(["01925 000 000", "01925000000"]);

/**
 * Data-integrity gate ("never fake"). Returns 100 when the site presents no
 * fabricated facts; any finding drops it to 0 and HARD-FAILS the candidate —
 * a truthful-but-sparse site is acceptable, a polished-but-false one is not.
 */
function scoreIntegrity(b: Business, notes: string[]): number {
  const issues: string[] = [];
  const v = b.verification;

  if (b.phone && FAKE_PHONES.has(b.phone.replace(/\s+/g, ""))) {
    issues.push("Fabricated phone number — leave blank until the real number is verified.");
  }
  if (b.rating && b.rating.count > 0) {
    if (b.testimonials.length === 0 || (v && v.rating !== "verified")) {
      issues.push("Aggregate rating shown without verified reviews — remove or verify it.");
    }
  }
  if (b.testimonials.length > 0) {
    const templated = b.testimonials.some((t) =>
      TEMPLATE_TESTIMONIAL_AUTHORS.has(t.author.trim().toLowerCase())
    );
    if (templated || (v && v.testimonials !== "verified")) {
      issues.push("Testimonials are not verified real reviews — remove them until confirmed.");
    }
  }

  if (issues.length) notes.unshift(...issues.map((i) => `INTEGRITY: ${i}`));
  return issues.length ? 0 : 100;
}

/** Leftover-template / placeholder copy that must never ship to a client. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /lorem ipsum/i,
  /\b(?:todo|tbd|fixme)\b/i,
  /\bplaceholder\b/i,
  /\[[^\]]{2,40}\]/, // bracketed tokens e.g. [business name], [insert service]
  /\bexample\.(?:com|org)\b/i,
  /\byour (?:business|company|brand) name\b/i,
  /\bxx+\b/i,
  /\blike you'?re a\b/i,
];

/**
 * Hygiene scan (Phase 4) — structural/placeholder defects that automated QA must
 * catch before a site is "complete": leftover template tokens, empty structured
 * fields, and missing media. Returns human-readable findings (each costs score).
 */
function hygieneIssues(b: Business): string[] {
  const issues: string[] = [];

  // Placeholder / leftover copy across the key client-facing fields.
  const copy = [
    b.name,
    b.tagline,
    b.about,
    b.categoryLabel,
    ...b.services.flatMap((s) => [s.name, s.description]),
    ...(b.faqs?.flatMap((f) => [f.question, f.answer]) ?? []),
    ...(b.highlights?.items.flatMap((h) => [h.title, h.description]) ?? []),
  ].join("  ");
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(copy))) {
    issues.push("Placeholder/template text detected in copy — replace before publishing.");
  }

  // Empty structured fields (a card with no name/description reads as broken).
  if (b.services.some((s) => !s.name.trim() || !s.description.trim())) {
    issues.push("A service is missing a name or description.");
  }
  if (b.faqs?.some((f) => !f.question.trim() || !f.answer.trim())) {
    issues.push("An FAQ is missing its question or answer.");
  }
  if (b.menu?.sections.some((sec) => !sec.name.trim() || sec.items.some((i) => !i.name.trim()))) {
    issues.push("A menu section or item is missing a name.");
  }
  if (b.highlights?.items.some((h) => !h.title.trim() || !h.description.trim())) {
    issues.push("A highlight is missing a title or description.");
  }

  // (Hero imagery is handled by scoreCompleteness — not re-penalised here.)
  return issues;
}

function scoreContent(b: Business, notes: string[]): number {
  let score = 100;
  const aboutWords = wordCount(b.about);
  if (aboutWords < 40) {
    score -= 25;
    notes.push(`About copy is thin (${aboutWords} words) — aim for 60+.`);
  } else if (aboutWords < 60) {
    score -= 10;
  }
  if (wordCount(b.tagline) < 3) {
    score -= 10;
    notes.push("Tagline is very short.");
  }
  const thinServices = b.services.filter((s) => wordCount(s.description) < 5).length;
  if (thinServices > 0) {
    score -= Math.min(20, thinServices * 6);
    notes.push(`${thinServices} service description(s) are thin.`);
  }
  // Reward variety: distinct service names vs total.
  const distinct = new Set(b.services.map((s) => s.name.toLowerCase())).size;
  if (distinct < b.services.length) {
    score -= 10;
    notes.push("Duplicate service names detected.");
  }
  // Taste: penalise the skill's anti-slop violations (clichés, meta-labels,
  // bloated headlines, em-dash flourishes, emoji) so templated copy fails the gate.
  const taste = tasteFindings(b);
  if (taste.length) {
    score -= Math.min(24, taste.length * 8);
    notes.push(...taste);
  }
  // Hygiene: placeholder text + structural defects. Placeholder copy is severe
  // (it's the most embarrassing thing to ship), so it carries the biggest penalty.
  const hygiene = hygieneIssues(b);
  for (const issue of hygiene) {
    score -= /placeholder|template text/i.test(issue) ? 40 : 8;
    notes.push(issue);
  }
  return clamp(score);
}

function scoreDesign(b: Business, dna: DesignDNA, notes: string[]): number {
  let score = 100;
  // Coherence guards: combinations that read as "off-brief" for the personality.
  if (dna.density === "compact" && dna.typography.scale === "editorial") {
    score -= 8;
    notes.push("Editorial type at compact density can feel cramped.");
  }
  if (dna.palette.mode === "dark" && dna.personality === "warm-inviting") {
    score -= 8;
    notes.push("Dark mode fights the warm-inviting personality.");
  }
  // Heading/body should differ enough to create hierarchy.
  if (dna.typography.heading === dna.typography.body) {
    score -= 6;
    notes.push("Heading and body fonts are identical — weak hierarchy.");
  }
  return clamp(score);
}

/**
 * Score one candidate (a Business × DesignDNA) against its siblings. Pure +
 * deterministic. `siblings` are other sites to de-duplicate copy against (typically
 * the org's other businesses).
 */
export function scoreSite(
  business: Business,
  dna: DesignDNA,
  siblings: Business[] = [],
  threshold: number = QA_THRESHOLD
): QaReport {
  const notes: string[] = [];

  const completeness = scoreCompleteness(business, notes);
  const content = scoreContent(business, notes);
  const design = scoreDesign(business, dna, notes);
  const integrity = scoreIntegrity(business, notes);

  const nearest = similarityAgainst(business, siblings);
  const uniqueness = nearest ? clamp(100 - nearest.score * 100) : 100;
  const isDuplicate = nearest !== null && nearest.score >= DUPLICATE_LIMIT;
  if (isDuplicate) {
    notes.unshift(
      `Copy is ${Math.round(nearest!.score * 100)}% similar to "${nearest!.name}" — regenerate to keep sites distinct.`
    );
  }

  // Weighted overall: completeness + content carry the most, design + uniqueness temper it.
  const overall = clamp(
    completeness * 0.3 + content * 0.3 + design * 0.2 + uniqueness * 0.2
  );

  // Integrity is a HARD gate, not a weight: any fabrication fails the candidate
  // regardless of how polished it is ("never fake" beats "looks complete").
  const integrityFail = integrity < 100;
  const pass = overall >= threshold && !isDuplicate && !integrityFail;
  if (pass && notes.length === 0) notes.push("No issues found.");

  return {
    overall,
    pass,
    threshold,
    scores: { completeness, content, design, uniqueness, integrity },
    nearest,
    notes,
  };
}
