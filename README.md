# Warrington Local Business Website Generator

A scalable system that automatically generates complete, **local-SEO-optimised,
conversion-focused websites** for local businesses in Warrington, UK — from a
single structured data object per business. Add a business, get a full website
(homepage, services, about, contact, booking) with zero per-business code.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion**,
statically generated and **deployment-ready for Vercel**.

---

## ✨ What each generated site includes

| Requirement | How it's delivered |
|---|---|
| **Homepage** | Hero + trust bar + services + about preview + testimonials + map + CTAs |
| **Services page** | Full service grid, local area coverage, reviews, CTA |
| **About page** | Story, trust badges, rating, opening hours |
| **Contact page** | Validated form, click-to-call/email cards, Google Map, hours |
| **Booking page** | Optional online booking/enquiry flow (per-business toggle) |
| **Local SEO** | `Service in Warrington \| Business` titles, CTR meta descriptions, H1/H2 structure, `LocalBusiness` + `BreadcrumbList` JSON-LD, internal linking, local alt text, sitemap + robots |
| **Conversion** | Above-the-fold CTA, sticky mobile call/book bar, click-to-call, repeated CTA bands, forms, testimonials, map |
| **UI/UX** | Clean, mobile-first, fast, per-business brand colours, scroll-reveal + hover animations |

---

## 🚀 Quick start

```bash
npm install
cp .env.example .env.local   # optional — sensible defaults work out of the box
npm run dev
```

Open <http://localhost:3000>:

- `/` — directory of every generated business site
- `/elite-plumbing-warrington` — example plumber site
- `/sharp-cuts-barbers-warrington` — example barbershop
- `/olive-tree-kitchen-warrington` — example restaurant

Production build:

```bash
npm run build && npm start
```

---

## 🧱 Architecture

```
app/
  layout.tsx                 Root layout, fonts, base metadata
  page.tsx                   Directory of all businesses
  sitemap.ts / robots.ts     Auto SEO files (covers every business)
  not-found.tsx
  api/enquiry/route.ts       Contact + booking form handler (validated)
  [business]/
    layout.tsx               Injects brand colours, nav, footer, JSON-LD, SSG params
    page.tsx                 Homepage
    services/page.tsx
    about/page.tsx
    contact/page.tsx
    book/page.tsx            Optional (per-business)
components/                  Reusable UI (Hero, ServicesGrid, ContactForm, …)
lib/
  types.ts                   The Business data model (single source of truth)
  businesses.ts              Data-access layer (local data OR Supabase)
  branding.ts                Auto brand-colour generation
  seo.ts                     Metadata + JSON-LD builders
  utils.ts                   Helpers (maps, addresses, hero images, …)
  data/                      One file per business + registry (index.ts)
scripts/new-business.mjs     CLI scaffolder for new businesses
```

**Single source of truth:** every page renders purely from a `Business` object
(`lib/types.ts`). Components never hard-code business specifics, so one codebase
serves unlimited businesses, each with its own content, branding and SEO.

**Dynamic routing:** `app/[business]/…` + `generateStaticParams` pre-renders a
static site for every business at build time — fast and fully indexable.

**Per-business branding:** `lib/branding.ts` derives a stable, distinct colour
palette from the business name + category (or uses supplied brand colours),
injected as CSS variables on the business layout. Tailwind utilities like
`bg-brand` / `text-brand-fg` then "just work" per business from one static build.

---

## ➕ Adding a business (no coding required)

### Option A — scaffold script (fastest)

```bash
npm run new-business -- "Aqua Flow Plumbing" plumber
```

This creates `lib/data/aqua-flow-plumbing.ts` pre-filled with a valid template.
Then:

1. Edit the generated file's details (phone, services, reviews, etc.).
2. Register it in `lib/data/index.ts` (import it and add to `LOCAL_BUSINESSES`).
3. Done — the full site is live at `/aqua-flow-plumbing-warrington`.

Categories: `plumber`, `barber`, `restaurant`, `electrician`, `cleaner`,
`landscaper`, `dentist`, `mechanic`, `beauty-salon`, `roofer`.

### Option B — copy an existing data file

Copy `lib/data/elite-plumbing.ts`, change the values, and register it in
`lib/data/index.ts`. That's the only edit needed for a brand-new website.

---

## 📈 Scaling to 100+ businesses with Supabase

The data layer (`lib/businesses.ts`) automatically switches from local files to
**Supabase** when these env vars are set — **no extra npm packages** (it uses
Supabase's REST API):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Create one table that stores each `Business` object as JSON:

```sql
create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  data jsonb not null,            -- the full Business object (see lib/types.ts)
  created_at timestamptz default now()
);

-- Read-only public access for the published sites:
alter table businesses enable row level security;
create policy "public read" on businesses for select using (true);
```

Insert a row per business (`data` = the same shape as the TS objects in
`lib/data`). The site then builds every business from the database. With
Incremental Static Regeneration (the REST fetch uses `revalidate: 3600`), new
businesses appear without redeploying.

> Prefer Firebase? Swap the `fetchFromSupabase` function in `lib/businesses.ts`
> for a Firestore query returning `Business[]`. Everything else is unchanged.

---

## 📨 Lead capture

`POST /api/enquiry` validates submissions (with a honeypot for spam) and:

- forwards the lead to `ENQUIRY_WEBHOOK_URL` if set (email service, CRM, Slack,
  Zapier, Make…), **or**
- logs the structured lead server-side if no webhook is configured.

Either way the endpoint is fully functional out of the box.

---

## ☁️ Deploy to Vercel

1. Push this repo to GitHub.
2. Import it into Vercel (zero config — it's a standard Next.js app).
3. Set env vars: `NEXT_PUBLIC_SITE_URL` (your production URL) and, optionally,
   Supabase keys + `ENQUIRY_WEBHOOK_URL`.
4. Deploy.

For per-business custom domains, point each domain at the deployment and use a
lightweight middleware/rewrite from the domain to `/<slug>` (the architecture is
already domain-agnostic — every business is a self-contained site).

---

## 🔍 SEO checklist (built in)

- ✅ Title format: `Service in Warrington | Business Name`
- ✅ Unique, CTR-optimised meta descriptions per page
- ✅ One `<h1>` per page, structured `<h2>`/`<h3>`
- ✅ `LocalBusiness` + `AggregateRating` + `Review` + `BreadcrumbList` JSON-LD
- ✅ Internal linking between all pages
- ✅ Local-keyword image alt text (`Service in Warrington — Business`)
- ✅ `sitemap.xml` + `robots.txt` covering every business
- ✅ Canonical URLs, Open Graph + Twitter cards
- ✅ Statically generated, image-optimised, mobile-first
```
