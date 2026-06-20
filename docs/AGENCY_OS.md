# Agency OS — AI Website Agency Operating System

> Production architecture for evolving the Warrington multi-tenant site generator
> into a self-operating AI agency: discover businesses → build a unique site →
> demonstrate value → sell → onboard → optimise → retain → scale.
>
> This builds **on** the existing foundation (steps 1–6). It does not replace it.

---

## 1. Where we are (the foundation this builds on)

Already shipped and build-green:

| Capability | Implementation |
|---|---|
| Multi-tenancy | `orgs` (billing tenant) → `businesses` (one website). RLS + app-layer ownership. |
| Render model | One `Business` object (`lib/types.ts`) → all pages under `app/[business]/`. |
| Data layer | Supabase via PostgREST over `fetch` (zero-dep). Anon = public/published reads, service role = server writes. ODR via `revalidateTag`. |
| Admin | `/admin` shell: dashboard, businesses CRUD, leads inbox, billing, SEO/blog. |
| Billing | Stripe over REST (`lib/stripe.ts`), plans/entitlements (`lib/plans.ts`), webhook. |
| SEO | Nightly local-page generation (`lib/seo-automation.ts`), blog at `/[business]/blog`. |
| Infra | Edge middleware custom-domain rewrite, image pipeline, in-memory rate limiting. |

**Two design principles to preserve:**

1. **Zero runtime deps for service integrations** — Stripe, Supabase, Resend, all
   reached by `fetch`. The AI layer follows the same rule: a small REST client to
   the Anthropic Messages API, no SDK. (Consistency + tiny bundle + edge-friendly.)
2. **The `Business` object stays the single source of truth.** Every agent that
   "creates a website" ultimately produces/edits a `Business` (+ a new `DesignDNA`)
   — never bespoke per-site code. This is what keeps the system scalable.

---

## 2. The 10 agents, grouped into 4 pipelines

The spec's 10 agents map onto four pipelines plus a shared substrate. Treating
them as pipelines (not 10 unrelated services) is what makes orchestration tractable.

```
                          ┌─────────────────────────────────────┐
                          │     AGENT SUBSTRATE (shared)         │
                          │  AI client · agent_runs · jobs       │
                          │  tools · cost ledger · approvals     │
                          └─────────────────────────────────────┘
   ACQUISITION              CREATION                GROWTH            LIFECYCLE
 ┌──────────────┐      ┌──────────────┐        ┌──────────────┐   ┌──────────────┐
 │ 1 Discovery  │      │ 3 Design     │        │ 5 SEO Growth │   │ 9 Onboarding │
 │ 2 Market/    │ ───▶ │   Engine     │  ───▶  │ 6 Conversion │──▶│10 Customer   │
 │   Competitor │      │ 4 QA Gate    │        │   Optimiser  │   │   Success    │
 │ 7 Prospecting│      └──────────────┘        └──────────────┘   └──────────────┘
 │ 8 Conversion │              │                       ▲                  │
 └──────────────┘              └───── preview ────────┘                  │
        │                                                                 │
        └──────────────── prospect → customer transition ────────────────┘
```

- **Acquisition** (1,2,7,8): fill the pipeline, demo value, close. Operates on
  `prospects` (outbound targets) — distinct from `leads` (a customer's inbound enquiries).
- **Creation** (3,4): turn a prospect/customer brief into a unique `Business` +
  `DesignDNA`, gated by an automated QA score. The crown jewel.
- **Growth** (5,6): continuous improvement of live customer sites. (5 already
  partly exists.)
- **Lifecycle** (9,10): convert won deals into live, monitored, retained customers.

---

## 3. Agent substrate (build this first — everything depends on it)

A uniform way to run any agent: queued, audited, cost-tracked, optionally gated by
human approval, multi-tenant-safe.

### 3.1 AI client — `lib/ai/client.ts`
Zero-dep REST wrapper over the Anthropic Messages API (mirrors `lib/stripe.ts`):
- `complete({ system, messages, tools?, maxTokens, model })` → typed result.
- `completeJson<T>(schema, ...)` → tool-use / JSON-mode helper returning validated `T`.
- Records token usage + computed cost into the **cost ledger** on every call.
- Model routing: cheap model (Haiku) for classification/scoring, capable model
  (Sonnet/Opus) for generative work (copy, Design DNA). Default to latest Claude.

### 3.2 Agent runner — `lib/agents/runner.ts`
```ts
runAgent(kind: AgentKind, input: Json, ctx: { orgId; actorUserId; autonomy })
  → { runId, status, output?, cost, needsApproval? }
```
- Writes an `agent_runs` row (kind, org, input, status, tokens, cost_pence, error).
- Each agent is a module exposing `definition` (system prompt, tool schema, model)
  + `handler(input, deps)`. The runner provides deps (AI client, data helpers).
- **Autonomy modes** per agent per org: `off | suggest | approve | auto`.
  `approve` parks output in `approvals` for a human; `auto` applies immediately.
- **Spend guardrails**: per-org daily/monthly cap checked before each run (429 if over).

### 3.3 Job queue — `lib/jobs/*` + `jobs` table
No new infra dep: a `jobs` table polled by an authenticated worker route
(`/api/jobs/tick`, hit by Vercel Cron) plus immediate inline execution for
interactive actions. Swap path to a real queue (QStash/Inngest) behind the same
`enqueue()` signature later — same pattern as the rate-limiter's Upstash note.

### 3.4 Cost & audit
- `agent_runs` = full audit trail (who/what/when/tokens/cost/outcome).
- `ai_cost_ledger` rollups power the Agent Control Centre's cost view + caps.

---

## 4. The Design DNA engine (Agent 3) — how "no two sites alike" actually works

The naive reading ("thousands of templates") is unscalable. The realistic
mechanism that satisfies *"no two client websites may appear identical"* without
per-site code:

**A site = `Business` (content) × `DesignDNA` (presentation).** Both are data.

### 4.1 `DesignDNA` shape (new, stored on the business)
```ts
interface DesignDNA {
  seed: string;                 // deterministic regeneration
  palette: { primary; accent; surface; ink; mode: "light"|"dark"|"warm" };
  typography: { heading: FontKey; body: FontKey; scale: "tight"|"editorial" };
  radius: "sharp"|"soft"|"pill"; density: "airy"|"compact"; motion: "calm"|"lively";
  layout: {                     // a variant key per section SLOT
    nav: NavVariant;            // e.g. "centered" | "split" | "minimal"
    hero: HeroVariant;          // "image-left" | "fullbleed" | "split-stat" ...
    services: ServicesVariant;  // "grid" | "list-accordion" | "cards-iconless"
    trust: TrustVariant; testimonials: TestimonialsVariant;
    gallery: GalleryVariant; pricing: PricingVariant; cta: CtaVariant;
  };
  personality: string;          // "premium-clinical" | "fast-urgent" | "warm-inviting"
}
```

### 4.2 Two-layer generation
1. **Tokens → CSS variables.** The theme (palette/type/radius/density/motion) is
   emitted as CSS custom properties on the site root. Existing components are
   refactored to read tokens (`var(--brand)`, `--radius`, …) instead of hardcoded
   Tailwind colours. One change, every component re-skins.
2. **Layout variants → component selection.** Each section SLOT gets **N concrete
   variant components** (e.g. `components/site/hero/HeroFullbleed.tsx`,
   `HeroSplitStat.tsx`, …). A registry maps `variant key → component`. The page
   renders `registry.hero[dna.layout.hero]`.

**Combinatorics:** ~5 slots × ~4 variants each = 4^5 ≈ 1,000 structural layouts,
× continuous palette/type/personality space ⇒ effectively unbounded, all from data.
No per-client code; adding a variant lifts *every* future site.

### 4.3 Personality presets steer the AI
Category + market intel → a `personality` (dentist→`premium-clinical`,
plumber→`fast-urgent`). The personality biases palette ranges, font pairings,
motion, *and* the copy prompt — so "feel premium/calm/clinical" vs
"fast/urgent" is enforced by both design tokens and content tone.

### 4.4 Content uniqueness memory
`content_fingerprints` table stores rolling hashes / embeddings of generated
headlines & paragraphs per category. The Design Engine's copy step is prompted
with "avoid these phrasings" and the QA gate (Agent 4) rejects output whose
similarity to existing sites in the same category/city exceeds a threshold →
regenerate. This is the concrete mechanism behind "content memory / no duplicates".

---

## 5. Database additions — `0002_agency_os.sql` (sketch)

New tables (all RLS-scoped to org, same pattern as existing):

```
prospects            -- outbound discovery targets (NOT leads)
  id, org_id, name, category, city, phone, email, website_url,
  presence_score int,           -- weak/none site = high opportunity
  opportunity_score int, value_estimate int,
  status text,                  -- discovered|analysed|previewed|contacted|
                               --   responded|negotiating|won|lost
  source jsonb, analysis jsonb, created_at, updated_at

site_previews        -- a generated demo for a prospect (pre-sale)
  id, org_id, prospect_id, business_draft jsonb, design_dna jsonb,
  qa_score int, qa_report jsonb, preview_token text unique, expires_at

design_dna           -- promoted from businesses.data for live sites
  (or stored as businesses.data.design — start embedded, promote if needed)

agent_runs           -- audit + cost per agent execution
  id, org_id, kind, status, input jsonb, output jsonb,
  model, input_tokens, output_tokens, cost_pence int, error, created_at

jobs                 -- durable queue
  id, org_id, kind, payload jsonb, run_after timestamptz,
  status text, attempts int, last_error, created_at

approvals            -- human-in-the-loop gate
  id, org_id, agent_run_id, kind, summary, payload jsonb,
  status text,                 -- pending|approved|rejected
  decided_by, decided_at

ai_cost_ledger       -- daily rollup per org for caps + dashboards
  org_id, day date, cost_pence int, run_count int, primary key (org_id, day)

content_fingerprints -- uniqueness memory
  id, category, city, kind, hash text, embedding vector?, created_at

outreach_messages    -- generated sales comms + thread state
  id, org_id, prospect_id, channel, direction, subject, body,
  status, sent_at, created_at

campaigns / workflows / workflow_runs  -- automation engine (Phase G)
  workflows(id, org_id, name, graph jsonb, enabled)
  workflow_runs(id, workflow_id, context jsonb, status, step, created_at)

agent_settings       -- per-org autonomy + spend caps
  org_id, kind, autonomy text, daily_cap_pence int, monthly_cap_pence int

customer_users       -- customer-portal access (separate from admin/owner)
  id, org_id, business_id, user_id, role
```

RLS: every table `org_id`-scoped via the existing `my_org_ids()` helper.
`site_previews` gets an *additional* public-read-by-token policy (so a prospect can
view their demo without auth, keyed on the unguessable `preview_token`).

---

## 6. Folder structure additions

```
lib/
  ai/         client.ts  models.ts  cost.ts  prompts/
  agents/     runner.ts  registry.ts  types.ts
              discovery.ts  market.ts  design/  qa.ts  seo-growth.ts
              conversion.ts  prospecting.ts  sales.ts  onboarding.ts  success.ts
  design/     dna.ts  tokens.ts  variants.ts  uniqueness.ts  personalities.ts
  jobs/       queue.ts  worker.ts
  prospects.ts  outreach.ts  approvals.ts  agent-settings.ts

components/site/          -- the variant library (the Design DNA render layer)
  nav/  hero/  services/  trust/  testimonials/  gallery/  pricing/  cta/
  registry.ts  ThemeProvider.tsx   -- emits CSS vars from DesignDNA

app/admin/(app)/
  prospects/   -- discovery + opportunity pipeline (CRM acquisition side)
  factory/     -- AI Website Factory: generate, preview desk/mobile, compare, regenerate sections, QA scores
  agents/      -- Agent Control Centre: status, tasks, success/cost, autonomy + caps, error logs
  workflows/   -- visual workflow builder
  (existing: businesses, leads, billing, blog, page)

app/preview/[token]/      -- public, tokenised prospect demo (the sales asset)
app/portal/               -- customer portal (stats, leads, change requests, invoices)
app/api/
  jobs/tick/  agents/[kind]/  preview/[token]/  outreach/webhook/
  (existing: enquiry, cron/seo, stripe/webhook, revalidate)
```

---

## 7. API & action surface

- **Server Actions** for all interactive admin mutations (consistent with existing
  CRUD) — generate preview, approve/reject, set autonomy, advance pipeline stage.
- **Route handlers** only for: machine callers (cron `/api/jobs/tick`,
  `/api/cron/seo`), webhooks (Stripe, email/inbound), and the public tokenised
  `/api/preview/[token]`. These stay outside the middleware auth matcher and are
  protected by secrets/tokens (same model as today).
- Every agent invocable two ways: **interactively** (action → `runAgent` inline)
  and **batch** (cron enqueues `jobs` → worker → `runAgent`).

---

## 8. Dashboard information architecture

```
Executive Dashboard   prospects · sites · customers · MRR · conv% · AI activity · health
CRM ─ Prospects       discovery list, opportunity score, pipeline kanban, outreach thread
CRM ─ Leads           (existing) customer-side inbound enquiries
Website Factory       brief → generate → desktop/mobile preview → compare 3 → QA score → publish
Agent Control Centre  per-agent status, autonomy (off/suggest/approve/auto), caps, cost, errors
Website Management     all sites · content · SEO · analytics · domains · leads · versions
Workflows             visual builder + run history
Billing               (existing) plans, invoices, portal
Customer Portal       (separate app surface) stats · leads · change requests · invoices
```

---

## 9. Security, multi-tenancy & cost guardrails

- Every new table RLS-scoped to org via `my_org_ids()`. Preview tokens are the only
  unauthenticated read, and are opaque + expiring.
- AI keys, service role, Stripe/cron secrets remain **server-only** (no `NEXT_PUBLIC_`).
- **Spend caps** enforced before each agent run (per-org daily/monthly) — prevents a
  runaway loop from costing real money. The cost ledger is the source of truth.
- **Human-in-the-loop** is first-class: any agent can be set to `approve` so nothing
  outbound (a sent email, a published site) happens without sign-off.
- The rate limiter already guards public endpoints; agent endpoints add spend caps
  on top.
- Discovery must respect source ToS / robots and store provenance in `prospects.source`.

---

## 10. Implementation roadmap (phased, each independently shippable & build-green)

| Phase | Theme | Delivers | Agents |
|---|---|---|---|
| **A** | **AI + agent substrate** | `lib/ai` client + cost ledger, `agent_runs`/`jobs`/`agent_settings`, runner, autonomy/caps, `0002` migration. *Nothing user-facing yet — the engine.* | — |
| **B** | **Design DNA engine** | `lib/design/*`, `components/site/*` variant library + ThemeProvider, refactor `[business]` render to DNA. Deterministic generator first (no AI), then AI copy. | 3 |
| **C** | **Website Factory UI + QA** | `/admin/factory`: brief → generate → desktop/mobile preview → compare → regenerate section → QA score gate. | 3, 4 |
| **D** | **Discovery + Prospect CRM** | `prospects` table, Discovery + Market agents, `/admin/prospects` pipeline kanban, opportunity scoring. | 1, 2 |
| **E** | **Sales: previews + outreach** | tokenised `/preview/[token]` demo, Prospecting + Sales agents, `outreach_messages`, proposals, pipeline → won. | 7, 8 |
| **F** | **Onboarding + Customer Portal** | won→customer transition, `/portal`, change requests, Onboarding + Success agents, reporting. | 9, 10 |
| **G** | **Growth loops** | Conversion optimiser, SEO growth agent upgrade, A/B of headlines/CTAs on live sites. | 5, 6 |
| **H** | **Workflow engine** | visual builder over `workflows`/`workflow_runs`, wiring the full find→build→sell→deploy→optimise loop. | all |
| **I** | **Agent Control Centre** | (can land alongside A and grow) cross-cutting cockpit: status, costs, autonomy, errors. | — |

**Recommended start: Phase A** — it's the substrate every agent calls, it's
testable in isolation, and it establishes the AI/cost/autonomy patterns the rest
inherit. Then **B** (Design DNA) because the unique-website engine is the product's
core differentiator and the highest-risk piece to prove.

---

## 11. Open decisions (need your input before Phase A)

1. **AI provider** — recommend Anthropic Claude via zero-dep REST (latest Sonnet for
   generative, Haiku for scoring). Need an `ANTHROPIC_API_KEY` env var.
2. **Discovery data source** — Google Places API (paid, licensed, clean) vs.
   OpenStreetMap/Overpass (free, ToS-friendly) vs. manual CSV import first.
   Affects Phase D only; can defer.
3. **Build order** — start at the recommended Phase A, or prioritise something else
   (e.g. you may want the Design DNA demo first to *see* the differentiator).
```
