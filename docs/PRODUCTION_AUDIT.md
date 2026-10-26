# Production-Readiness Audit — Agency OS

> **Status (update):** All six phases of the build order below have since been **implemented**
> (build + typecheck green). Highlights: truthful generation + field provenance + integrity QA
> gate (§1/§11); Lead Intelligence Report on the prospect board (§7); tokenised-demo analytics +
> optional password (§5 shareability); QA placeholder/empty-field hardening (§6); O(batch) prospect
> dedup + audit social/tech enrichment (§2/§10); and a content-addressed AI-result cache (§12).
> **Action required:** apply migrations `0010_preview_analytics.sql` + `0011_ai_cache.sql` in the
> Supabase SQL editor — the analytics, password and cache features are inert (graceful) until then.

## Context

A complete production-readiness audit of the platform against a 13-section "agency overhaul"
brief, before paying customers see it. This pass is an audit only — no code changes: every
section is graded against the *actual* code, the real gaps are exposed, and a prioritised build
order follows to pick from. (For when we do build: unverifiable facts become **clearly-labelled
placeholders**, never invented values.)

Legend — Status: ✅ solid · 🟡 partial · 🔴 missing/broken.  Effort: S (<½ day) · M (1–2 days) · L (3+ days).

---

## Headline finding (the one that blocks revenue)

**The platform fabricates business facts on every generated site — the "Critical Rule" is violated in code.**

In `lib/previews.ts` → `draftBusinessFromProspect` (lines 293–334):
- `phone: prospect.phone?.trim() || "01925 000 000"` — a **fake phone number** when none is known.
- `email: ... || hello@<slug>.co.uk` — a **fabricated email**.
- `rating: { value: 4.9, count: 127 }` — a **hardcoded fake rating on every business**.
- `testimonials: t.testimonials` — **invented quotes from invented people** ("Sarah M.", "David R.").
- `address: { line1: "", city, postcode: "" }` — partial/empty address presented as real.

Two structural causes make this unavoidable today:
1. **The type forces it.** `Business` (lib/types.ts:143–161) makes `phone`, `email`, `address`,
   `testimonials[]`, and `rating` **non-optional**, so the scaffolder must invent values.
2. **The QA gate rewards it.** `scoreCompleteness` (lib/design/qa.ts:64,69) *penalises* missing
   testimonials and missing contact — so the system is incentivised to fill them with fakes to pass.

Fake `aggregateRating` also risks Google structured-data penalties, and fake testimonials are a
genuine legal/reputational exposure for an agency sending these to clients. **This is Phase 1.**

---

## Section-by-section grading

| # | Section | Status | Reality in the code |
|---|---------|--------|---------------------|
| 1 | Data integrity & confidence | 🔴 | Fabrication confirmed (above). No per-field confidence, no verification surface, no "prefer missing over wrong" anywhere. |
| 2 | Discovery → Lead Factory | 🟡 | Discovery works (Overpass, raced mirrors) and auto-creates scored prospects (presence/opportunity/value in `lib/prospects.ts`). But the rich "Business Profile" (tech stack, social, reputation, SEO score, AI-opportunity score, lead potential) is **not captured** — only name/category/city/contact/3 scores. `WebsiteAudit` (lib/audit.ts) exists but only runs on Analyse. |
| 3 | Industry knowledge graph | 🟡 | `lib/knowledge.ts` is real: `industry_profile` + `winning_pattern`, org-scoped, hit counts, two learning loops. Captures services/highlights/faqs/personality. Missing: competitors, customer journey, conversion data, terminology as structure; learning is **per-org**, not cross-tenant. |
| 4 | Demo experience | 🟡 | Public site is genuinely **multi-page** (`/[business]` + services/about/contact/book/blog), SSG, data-driven. Unaudited for: mobile polish, broken links, placeholder leakage, "demo tells". Largely there; needs a QA sweep (overlaps §6). |
| 5 | Client shareability | 🟡 | Tokenised `/preview/[token]`, opaque, 30-day expiry, rev/expire handling, **coarse view counter only** (`recordPreviewView`). Missing: password protection, per-page/click/time-on-page/conversion analytics. |
| 6 | Website factory pipeline | 🟡 | Pipeline exists: discovery → market (analysis+audit) → prospecting (draft + Design DNA + `scoreSite` QA gate at threshold 75 + persist preview). But QA checks completeness/content/design/uniqueness/taste — **not** broken links, missing images, placeholder text, or **incorrect business details** (ties to §1). |
| 7 | Lead intelligence report | 🟡 | Raw material exists (`WebsiteAudit.issues`, `ProspectAnalysis.summary/angle`). `lib/reports.ts` builds **customer** reports, not prospect-facing lead-intel. No consolidated "problems + lost revenue + ROI" pitch artefact. Assemblable from existing data. |
| 8 | CRM & pipeline | 🟡 | Strong: `ProspectStatus` = discovered→analysed→previewed→contacted→responded→negotiating→won/lost; outreach history; proposals. Missing: free-text notes, follow-up reminders, an explicit "meeting booked" stage, comms history beyond outreach rows. |
| 9 | AI agent system | ✅ | 10 agents through `runAgent` (audit + cost ledger + autonomy + caps). Maps cleanly to the requested Research/Industry/Architect/Copywriter/Designer/QA/Sales roles. Structured outputs, registry. This is a genuine strength. |
| 10 | Production readiness | 🟡 | **Security ✅** (server-only secrets, org-ownership on every mutation, token routes 404-not-500). **Reliability 🟡** (graceful degradation, audit rows, cost ledger — but no retry/backoff, no monitoring/alerting). **Scalability 🔴 hotspot:** `createProspects` loads *all* org prospects into memory to dedup each run (lib/prospects.ts:247) — fine at hundreds, breaks at millions. |
| 11 | Critical rule (never fake) | 🔴 | Violated — see headline. This is the same work as §1. |
| 12 | Token efficiency | 🟡 | Model tiers fast/smart/max ✅, cost ledger ✅, spend caps ✅, knowledge reuse ✅ (partial). Missing: retrieval/embeddings, **caching of AI results**, per-business/per-website token analytics, **incremental component regen** (a site regenerates the whole `Business`), prompt library + versioning. |
| 13 | Dev token efficiency | ✅ | Operating principles for *how I build* — already encoded in `CLAUDE.md` (locate-don't-sweep, edit-don't-rewrite, verify-once, file map). Will follow throughout. |

---

## Cross-cutting issues (ranked)

1. **Fabricated facts** (§1/§11) — CRITICAL, blocks sending to paying clients.
2. **QA gate rewards fabrication** (§6) — must invert: fail on fake facts, stop penalising honest gaps.
3. **Discovery dedup won't scale** (§2/§10) — in-memory full-table load per run.
4. **Shareability analytics too shallow to sell on** (§5) — only a view tally.
5. **No retry/monitoring** (§10) — discovery/AI failures degrade silently.

---

## Recommended build order

| Phase | Theme | Effort | Why this order |
|-------|-------|--------|----------------|
| **1** | **Data integrity & confidence** (truthful generation) | **S–M** | The Critical Rule + recurring real-world pain; unblocks "send to a client". |
| 2 | Lead Intelligence Report for prospects | M | High sales value, reuses existing `WebsiteAudit` + analysis. |
| 3 | Shareability analytics + optional password | M | Makes demos sellable ("they viewed it 3×, 2m on pricing"). |
| 4 | QA hardening (links/images/placeholder/detail checks) | M | Guarantees the §1 win can't regress; closes §6. |
| 5 | Discovery profile enrichment + scalable dedup | L | The "Business Profile" wishlist (§2) + the scalability hotspot (§10). |
| 6 | Knowledge depth + AI-result caching + incremental regen + token analytics | L | The §3/§12 scale-economics layer. |

---

## Phase 1 detail (the concrete fix, for when building is approved)

**Principle: truthful by default. Marketing copy may be a clearly-editable draft; *facts* are verified or absent.**

- **Field provenance.** Tag each field on a preview as `verified` (from OSM/manual), `template`
  (generic marketing draft — fine, clearly editable), or `missing`. Surface it as a verification
  checklist on the factory/preview admin screen; nothing is "client-ready" until facts are `verified`.
- **Stop inventing facts** in `draftBusinessFromProspect`:
  - phone/email/address — set only from real prospect data; when absent, render a **labelled
    placeholder** ("Add your phone number") and flag it in admin. (Make these optional on `Business`
    or treat empty-string as "show placeholder, omit from schema".)
  - **rating** — remove the hardcoded `4.9/127`; make optional; render hides the stars and JSON-LD
    omits `aggregateRating` when absent (also fixes a real SEO-penalty risk).
  - **testimonials** — drop the template fakes from the default; render a labelled
    "your reviews appear here" block; QA stops treating absence as a defect.
- **Invert the QA gate** (`lib/design/qa.ts`): add a `dataIntegrity` sub-score that **fails** a
  preview containing fabrication sentinels (e.g. `01925 000 000`, template testimonial authors),
  and **stop penalising** honest missing facts in `scoreCompleteness`.
- **Files:** `lib/previews.ts` (draft), `lib/types.ts` (optional fact fields + a `Verification`
  type), `lib/design/qa.ts` (integrity sub-score; drop fabrication rewards), `components/site/*`
  (graceful placeholders for rating/testimonials/contact + JSON-LD guard), the factory/preview
  admin surface (verification checklist).

---

## Verification (when Phase 1 is built)

1. `npm run typecheck` then `npm run build` (Node prefix per CLAUDE.md).
2. Generate a preview for a prospect **with no phone and no reviews** → confirm the site shows
   **no `01925 000 000`, no `4.9/127`, no invented testimonials**, and labelled placeholders instead.
3. Confirm the QA panel **flags** the unverified facts and the verification checklist lists them.
4. Generate for a prospect **with** real phone/email → confirm those render as normal.

---

## Status update — reply-capture gap closed (Goal Engine phase)

The cadence previously only stopped when the OPERATOR manually marked a prospect as
replied — hot leads went cold unattended and follow-ups chased prospects who had already
answered. Now closed: Resend Inbound → `POST /api/webhooks/resend` (secret-gated,
`RESEND_INBOUND_SECRET`) records the real reply as an inbound `outreach_messages` row and
advances the prospect forward-only to `responded`, which halts the sequence (`selectDueMessages`
already halts on inbound/received). Related: the autopilot now runs closed-loop throughput
control off `lib/goal-engine.ts` (gap-to-£1,000/mo), the operator cockpit is `/admin/briefing`,
and migration `0016_loop_state.sql` gates the weekly digest + funnel snapshots.
